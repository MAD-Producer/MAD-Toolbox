//! 任务系统共享内核（架构文档 §4）。
//!
//! 结构：单 actor 枢纽——一个 async 任务独占全部可变状态，经 mpsc 收消息；
//! 循环体只调用纯函数（`state::transition` 与 `scheduler::select_dispatch`）。
//!
//! 纪律（§4.2）：枢纽不解开 intent、不解析工具 stdout——进度/输出路径/自定义事件
//! 由 feature 随 TaskSpec 附带的解析器产出，枢纽只转发。

pub mod commands;
pub mod logfile;
pub mod scheduler;
pub mod sink;
pub mod state;
pub mod store;
pub mod types;

use std::collections::HashMap;
use std::ffi::OsString;
use std::path::PathBuf;
use std::sync::Arc;

use chrono::Utc;
use tauri::AppHandle;
use tokio::sync::{mpsc, oneshot};

use crate::core::process::{spawn_tree, stream_lines, TreeKiller};
use crate::core::settings::load_app_settings;
use logfile::TaskLogWriter;
use scheduler::{select_dispatch, PoolCaps, PoolUsage, QueuedView};
use sink::EventSink;
use state::{transition, TransitionEvent};
use store::TaskStore;
use types::{
    Feature, LogStream, Pool, TaskEnvelope, TaskEvent, TaskIntent, TaskProgress, TaskStatus,
};

/// feature 提交的输出解析器：原始行 → 进度信号。枢纽据信号更新信封/转发事件。
pub type LineParser = Arc<dyn Fn(&str) -> Vec<TaskProgress> + Send + Sync>;

/// feature 提交任务的全部材料。工具路径/工作目录由 feature 侧解析完毕，
/// 枢纽不做任何工具特判。
pub struct TaskSpec {
    pub feature: Feature,
    pub pool: Pool,
    pub title: String,
    pub tool: String,
    pub tool_path: PathBuf,
    pub tool_version: Option<String>,
    /// 完整 argv：仅用于本次 spawn，不落库不上屏。
    pub argv: Vec<String>,
    pub argv_redacted: Vec<String>,
    pub cwd: Option<PathBuf>,
    pub env_path: Option<OsString>,
    /// 提交时已知的输出位置（feature 侧知识），作为"打开输出位置"的锚点。
    pub output_paths: Vec<String>,
    /// 已脱敏的意图（feature 侧负责 sanitize——落库前置条件，§4.5）。
    pub intent: TaskIntent,
    pub parser: Option<LineParser>,
    /// 任务独占的临时目录；排队取消、启动失败、进程终态或枢纽关闭时自动清理。
    pub cleanup_dir: Option<PathBuf>,
}

fn remove_cleanup_dir(path: &std::path::Path) {
    let Ok(metadata) = std::fs::symlink_metadata(path) else {
        return;
    };
    if metadata.file_type().is_symlink() || metadata.is_file() {
        let _ = std::fs::remove_file(path);
    } else if metadata.is_dir() {
        let _ = std::fs::remove_dir_all(path);
    }
}

struct CleanupDir(Option<PathBuf>);

impl Drop for CleanupDir {
    fn drop(&mut self) {
        if let Some(path) = self.0.take() {
            remove_cleanup_dir(&path);
        }
    }
}

enum HubMsg {
    Submit {
        id: String,
        spec: Box<TaskSpec>,
    },
    Cancel {
        id: String,
    },
    Promote {
        id: String,
    },
    Snapshot {
        reply: oneshot::Sender<Vec<TaskEnvelope>>,
    },
    Delete {
        ids: Vec<String>,
        reply: oneshot::Sender<Vec<String>>,
    },
    Line {
        id: String,
        stream: LogStream,
        line: String,
    },
    Exited {
        id: String,
        code: Option<i32>,
    },
}

#[derive(Clone)]
pub struct TaskHub {
    tx: mpsc::UnboundedSender<HubMsg>,
}

impl TaskHub {
    /// 创建枢纽：先启动对账（遗留任务翻 interrupted，§4.3），再拉起 actor 循环。
    /// 必须在 tokio 运行时上下文内调用。
    pub fn new(
        store: TaskStore,
        sink: Arc<dyn EventSink>,
        caps: PoolCaps,
        logs_dir: PathBuf,
        app: AppHandle,
    ) -> Self {
        let _ = store.reconcile();
        let (tx, rx) = mpsc::unbounded_channel();
        let state = HubState {
            store,
            sink,
            caps,
            logs_dir,
            app,
            queue: Vec::new(),
            envelopes: HashMap::new(),
            pending: HashMap::new(),
            running: HashMap::new(),
            seqs: HashMap::new(),
        };
        tokio::spawn(hub_loop(state, rx, tx.clone()));
        TaskHub { tx }
    }

    /// 提交任务，立即返回任务 id（排队与执行异步进行）。
    pub fn submit(&self, spec: TaskSpec) -> String {
        let id = uuid::Uuid::new_v4().to_string();
        let cleanup_dir = spec.cleanup_dir.clone();
        if self
            .tx
            .send(HubMsg::Submit {
                id: id.clone(),
                spec: Box::new(spec),
            })
            .is_err()
        {
            if let Some(path) = cleanup_dir {
                remove_cleanup_dir(&path);
            }
        }
        id
    }

    pub fn cancel(&self, id: &str) {
        let _ = self.tx.send(HubMsg::Cancel { id: id.to_string() });
    }

    /// 置顶：移到全局队首（§4.4 的全局语义）。
    pub fn promote(&self, id: &str) {
        let _ = self.tx.send(HubMsg::Promote { id: id.to_string() });
    }

    /// 全量快照：库中历史 + 内存态（progress 等）合并，created_at 倒序。
    pub async fn snapshot(&self) -> Vec<TaskEnvelope> {
        let (reply, rx) = oneshot::channel();
        let _ = self.tx.send(HubMsg::Snapshot { reply });
        rx.await.unwrap_or_default()
    }

    /// 删除终态任务（信封 + 日志文件）；返回实际删除的 id，活动任务被跳过。
    pub async fn delete(&self, ids: Vec<String>) -> Vec<String> {
        let (reply, rx) = oneshot::channel();
        if self.tx.send(HubMsg::Delete { ids, reply }).is_err() {
            return Vec::new();
        }
        rx.await.unwrap_or_default()
    }
}

struct RunningTask {
    killer: TreeKiller,
    parser: Option<LineParser>,
    writer: Option<TaskLogWriter>,
    _cleanup_dir: CleanupDir,
}

struct HubState {
    store: TaskStore,
    sink: Arc<dyn EventSink>,
    caps: PoolCaps,
    logs_dir: PathBuf,
    /// spawn 时读取设置页的全局代理下发给工具进程。
    app: AppHandle,
    /// 有序队列：queued 任务的全局顺序（§4.4 单一队列）。
    queue: Vec<String>,
    /// 本会话任务的内存镜像（含 progress 等瞬态）。
    envelopes: HashMap<String, TaskEnvelope>,
    /// queued 任务待 spawn 的材料。
    pending: HashMap<String, PendingSpec>,
    running: HashMap<String, RunningTask>,
    seqs: HashMap<String, u64>,
}

struct PendingSpec {
    tool_path: PathBuf,
    argv: Vec<String>,
    cwd: Option<PathBuf>,
    env_path: Option<OsString>,
    parser: Option<LineParser>,
    cleanup_dir: CleanupDir,
}

/// spawn 子进程并拉起流读取 runner：全部行经 Line 消息回流枢纽，
/// 两条流读尽后才发 Exited（保证 Exited 排在所有 Line 之后）。
fn spawn_and_stream(
    id: &str,
    tool_path: &std::path::Path,
    argv: &[String],
    cwd: Option<&std::path::Path>,
    env_path: Option<&std::ffi::OsStr>,
    proxy: Option<&str>,
    tx: &mpsc::UnboundedSender<HubMsg>,
) -> std::io::Result<TreeKiller> {
    let mut child = spawn_tree(tool_path, argv, cwd, env_path, proxy)?;
    let killer = child.killer();
    let stdout = child.take_stdout();
    let stderr = child.take_stderr();
    let id_owned = id.to_string();
    let tx = tx.clone();
    tokio::spawn(async move {
        let out_task = stdout.map(|s| {
            let tx = tx.clone();
            let id = id_owned.clone();
            tokio::spawn(async move {
                stream_lines(s, |line| {
                    let _ = tx.send(HubMsg::Line {
                        id: id.clone(),
                        stream: LogStream::Stdout,
                        line,
                    });
                })
                .await;
            })
        });
        let err_task = stderr.map(|s| {
            let tx = tx.clone();
            let id = id_owned.clone();
            tokio::spawn(async move {
                stream_lines(s, |line| {
                    let _ = tx.send(HubMsg::Line {
                        id: id.clone(),
                        stream: LogStream::Stderr,
                        line,
                    });
                })
                .await;
            })
        });
        if let Some(t) = out_task {
            let _ = t.await;
        }
        if let Some(t) = err_task {
            let _ = t.await;
        }
        let code = child.wait().await.ok().and_then(|s| s.code());
        let _ = tx.send(HubMsg::Exited { id: id_owned, code });
    });
    Ok(killer)
}

async fn hub_loop(
    mut st: HubState,
    mut rx: mpsc::UnboundedReceiver<HubMsg>,
    tx: mpsc::UnboundedSender<HubMsg>,
) {
    while let Some(msg) = rx.recv().await {
        match msg {
            HubMsg::Submit { id, spec } => {
                st.handle_submit(id, *spec);
                st.try_dispatch(&tx);
            }
            HubMsg::Cancel { id } => st.handle_cancel(&id),
            HubMsg::Promote { id } => {
                if let Some(pos) = st.queue.iter().position(|q| q == &id) {
                    let item = st.queue.remove(pos);
                    st.queue.insert(0, item);
                }
            }
            HubMsg::Line { id, stream, line } => st.handle_line(&id, stream, &line),
            HubMsg::Exited { id, code } => {
                st.handle_exited(&id, code);
                st.try_dispatch(&tx);
            }
            HubMsg::Snapshot { reply } => {
                let _ = reply.send(st.snapshot());
            }
            HubMsg::Delete { ids, reply } => {
                let _ = reply.send(st.handle_delete(ids));
            }
        }
    }
}

impl HubState {
    fn persist_and_emit(&mut self, envelope: TaskEnvelope) {
        let _ = self.store.upsert(&envelope);
        self.sink.emit(&TaskEvent::Changed(envelope.clone()));
        self.envelopes.insert(envelope.id.clone(), envelope);
    }

    fn handle_submit(&mut self, id: String, spec: TaskSpec) {
        let envelope = TaskEnvelope {
            id: id.clone(),
            feature: spec.feature,
            pool: spec.pool,
            title: spec.title,
            status: TaskStatus::Queued,
            created_at: Utc::now(),
            started_at: None,
            finished_at: None,
            tool: spec.tool,
            tool_version: spec.tool_version,
            argv_redacted: spec.argv_redacted,
            // Inherit（cwd=None）时的真实落盘位置是进程 cwd，作为"打开输出位置"的兜底锚点
            working_dir: spec
                .cwd
                .as_ref()
                .map(|p| p.to_string_lossy().into_owned())
                .or_else(|| {
                    std::env::current_dir()
                        .ok()
                        .map(|p| p.to_string_lossy().into_owned())
                }),
            output_paths: spec.output_paths,
            exit_code: None,
            log_path: None,
            intent: spec.intent,
            progress: None,
        };
        self.pending.insert(
            id.clone(),
            PendingSpec {
                tool_path: spec.tool_path,
                argv: spec.argv,
                cwd: spec.cwd,
                env_path: spec.env_path,
                parser: spec.parser,
                cleanup_dir: CleanupDir(spec.cleanup_dir),
            },
        );
        self.queue.push(id);
        self.persist_and_emit(envelope);
    }

    fn current_usage(&self) -> PoolUsage {
        let mut usage = PoolUsage::default();
        for envelope in self.envelopes.values() {
            // canceling 仍占用槽位：进程未退出前资源未释放
            if matches!(envelope.status, TaskStatus::Running | TaskStatus::Canceling) {
                usage.add(envelope.pool);
            }
        }
        usage
    }

    fn try_dispatch(&mut self, tx: &mpsc::UnboundedSender<HubMsg>) {
        let views: Vec<QueuedView> = self
            .queue
            .iter()
            .filter_map(|id| {
                self.envelopes.get(id).map(|e| QueuedView {
                    id: id.clone(),
                    pool: e.pool,
                })
            })
            .collect();
        for id in select_dispatch(&views, self.caps, self.current_usage()) {
            self.queue.retain(|q| q != &id);
            self.start_task(&id, tx);
        }
    }

    fn start_task(&mut self, id: &str, tx: &mpsc::UnboundedSender<HubMsg>) {
        let Some(pending) = self.pending.remove(id) else {
            return;
        };
        let Some(mut envelope) = self.envelopes.get(id).cloned() else {
            return;
        };
        let Ok(next) = transition(envelope.status, TransitionEvent::Dispatch) else {
            return;
        };
        envelope.status = next;
        envelope.started_at = Some(Utc::now());

        let mut writer = match TaskLogWriter::create(&self.logs_dir, id) {
            Ok(writer) => {
                envelope.log_path = Some(writer.path.to_string_lossy().into_owned());
                Some(writer)
            }
            Err(_) => None,
        };
        if let Some(w) = writer.as_mut() {
            // 头行用脱敏 argv——日志文件同样是持久化面
            w.write_line(
                LogStream::System,
                &format!("$ {} {}", envelope.tool, envelope.argv_redacted.join(" ")),
            );
        }

        match spawn_and_stream(
            id,
            &pending.tool_path,
            &pending.argv,
            pending.cwd.as_deref(),
            pending.env_path.as_deref(),
            load_app_settings(&self.app).proxy.as_deref(),
            tx,
        ) {
            Ok(killer) => {
                self.running.insert(
                    id.to_string(),
                    RunningTask {
                        killer,
                        parser: pending.parser,
                        writer,
                        _cleanup_dir: pending.cleanup_dir,
                    },
                );
                self.persist_and_emit(envelope);
            }
            Err(err) => {
                // spawn 失败即失败终态，不占用池
                if let Some(w) = writer.as_mut() {
                    w.write_line(
                        LogStream::System,
                        &rust_i18n::t!("backend.task.startFailed", error = err),
                    );
                }
                envelope.status = TaskStatus::Failed;
                envelope.finished_at = Some(Utc::now());
                let seq = self.next_seq(id);
                self.sink.emit(&TaskEvent::Log {
                    task_id: id.to_string(),
                    stream: LogStream::System,
                    line: rust_i18n::t!("backend.task.startFailed", error = err).to_string(),
                    seq,
                });
                self.persist_and_emit(envelope);
            }
        }
    }

    fn handle_cancel(&mut self, id: &str) {
        let Some(envelope) = self.envelopes.get(id).cloned() else {
            return;
        };
        let Ok(next) = transition(envelope.status, TransitionEvent::Cancel) else {
            return;
        };
        if next == envelope.status {
            return; // 终态/canceling 上的幂等 no-op，不重复发事件
        }
        let mut envelope = envelope;
        match envelope.status {
            TaskStatus::Queued => {
                self.queue.retain(|q| q != id);
                self.pending.remove(id);
                envelope.status = next; // canceled
                envelope.finished_at = Some(Utc::now());
                self.persist_and_emit(envelope);
            }
            TaskStatus::Running => {
                if let Some(run) = self.running.get(id) {
                    run.killer.kill_tree();
                }
                envelope.status = next; // canceling；退出确认由 Exited 消息完成
                self.persist_and_emit(envelope);
            }
            _ => {}
        }
    }

    /// 删除终态任务：活动任务（queued/running/canceling）不可删——先取消再删。
    /// 内存镜像只有本会话提交的任务，历史任务回退查库（快照即两源合并）；
    /// 删除 = 清日志文件 + 库行 + 内存条目，返回实际删除的 id。
    fn handle_delete(&mut self, ids: Vec<String>) -> Vec<String> {
        let mut deleted = Vec::new();
        for id in ids {
            let envelope = self
                .envelopes
                .get(&id)
                .cloned()
                .or_else(|| self.store.get(&id).ok().flatten());
            let Some(envelope) = envelope else {
                continue;
            };
            if !envelope.status.is_terminal() {
                continue;
            }
            if let Some(log_path) = &envelope.log_path {
                let _ = std::fs::remove_file(log_path);
            }
            if self.store.delete(&id).is_ok() {
                self.seqs.remove(&id);
                self.envelopes.remove(&id);
                deleted.push(id);
            }
        }
        deleted
    }

    fn next_seq(&mut self, id: &str) -> u64 {
        let seq = self.seqs.entry(id.to_string()).or_insert(0);
        *seq += 1;
        *seq
    }

    fn handle_line(&mut self, id: &str, stream: LogStream, line: &str) {
        // 脱敏是持久化与展示的前置条件（§4.5）：日志文件与事件一律用脱敏行
        let redacted = super::redaction::redact_output_line(line);

        // 解析器消费原始行（进度数字等不受脱敏影响）
        let mut signals: Vec<TaskProgress> = Vec::new();
        if let Some(run) = self.running.get_mut(id) {
            if let Some(w) = run.writer.as_mut() {
                w.write_line(stream, &redacted);
            }
            if let Some(parser) = &run.parser {
                signals = parser(line);
            }
        }

        for progress in signals {
            if let Some(envelope) = self.envelopes.get_mut(id) {
                envelope.progress = Some(progress.clone());
            }
            self.sink.emit(&TaskEvent::Progress {
                task_id: id.to_string(),
                progress,
            });
        }

        let seq = self.next_seq(id);
        self.sink.emit(&TaskEvent::Log {
            task_id: id.to_string(),
            stream,
            line: redacted,
            seq,
        });
    }

    fn handle_exited(&mut self, id: &str, code: Option<i32>) {
        let Some(mut run) = self.running.remove(id) else {
            return;
        };
        let Some(mut envelope) = self.envelopes.get(id).cloned() else {
            return;
        };
        let Ok(next) = transition(envelope.status, TransitionEvent::Exit(code)) else {
            return;
        };
        envelope.status = next;
        envelope.exit_code = code;
        envelope.finished_at = Some(Utc::now());
        envelope.progress = None;
        if let Some(w) = run.writer.as_mut() {
            w.write_line(
                LogStream::System,
                &rust_i18n::t!(
                    "backend.task.processExited",
                    code = format!("{code:?}"),
                    status = status_label(next)
                ),
            );
        }
        self.persist_and_emit(envelope);
        self.seqs.remove(id);
    }

    fn snapshot(&self) -> Vec<TaskEnvelope> {
        let mut all = self.store.all().unwrap_or_default();
        for envelope in all.iter_mut() {
            if let Some(live) = self.envelopes.get(&envelope.id) {
                *envelope = live.clone(); // 内存态更新鲜（含 progress）
            }
        }
        all.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        all
    }
}

fn status_label(status: TaskStatus) -> &'static str {
    match status {
        TaskStatus::Queued => "queued",
        TaskStatus::Running => "running",
        TaskStatus::Canceling => "canceling",
        TaskStatus::Success => "success",
        TaskStatus::Failed => "failed",
        TaskStatus::Canceled => "canceled",
        TaskStatus::Interrupted => "interrupted",
    }
}
