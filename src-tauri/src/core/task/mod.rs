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

pub type Preparation = Box<
    dyn FnOnce(
            Arc<dyn Fn(String) + Send + Sync>,
        ) -> std::pin::Pin<
            Box<
                dyn std::future::Future<
                        Output = Result<
                            (Vec<String>, Vec<String>, Option<tempfile::TempDir>),
                            String,
                        >,
                    > + Send,
            >,
        > + Send,
>;

async fn run_preparation(
    prepare: Preparation,
    log: Arc<dyn Fn(String) + Send + Sync>,
    canceled: oneshot::Receiver<()>,
) -> Result<(Vec<String>, Vec<String>, Option<tempfile::TempDir>), String> {
    tokio::select! {
        biased;
        _ = canceled => Err("Preparation canceled".into()),
        result = async { prepare(log).await } => result,
    }
}

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
    /// 调度后执行的准备步骤，与下载共用队列槽位，可取消。
    pub prepare: Option<Preparation>,
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
    CancelAll,
    /// 应用退出流程的第一步：之后到达的 Submit 一律落为 canceled，
    /// 防止取消窗口之后又spawn 新进程（macOS 无 Job Object 兜底）。
    BeginShutdown,
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
    Prepared {
        id: String,
        pending: Box<PendingSpec>,
        result: Result<(Vec<String>, Vec<String>, Option<tempfile::TempDir>), String>,
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
            shutdown: false,
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

    /// 尽力取消全部活动任务（queued/running）：应用退出前的收尾动作。
    /// 每个任务的取消路径与单任务取消一致；退出方自行等待终态。
    pub fn cancel_all(&self) {
        let _ = self.tx.send(HubMsg::CancelAll);
    }

    /// 进入退出状态：此后提交的任务不再执行（直接落 canceled）。
    /// 必须先于 cancel_all 发送，堵住「取消后又提交」的竞态窗口。
    pub fn begin_shutdown(&self) {
        let _ = self.tx.send(HubMsg::BeginShutdown);
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
    killer: Option<TreeKiller>,
    prepare_cancel: Option<oneshot::Sender<()>>,
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
    /// 退出状态：true 后新 Submit 不再 spawn，只落为 canceled。
    shutdown: bool,
}

struct PendingSpec {
    tool_path: PathBuf,
    argv: Vec<String>,
    cwd: Option<PathBuf>,
    env_path: Option<OsString>,
    parser: Option<LineParser>,
    prepare: Option<Preparation>,
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
                // 关闭屏障：占位任务先落库再立即取消（复用 CancelAll 同一条取消路径），
                // 不派发 spawn——退出期间不产生新进程
                let cancel_after_submit = st.shutdown;
                if cancel_after_submit {
                    st.handle_submit(id.clone(), *spec);
                    st.handle_cancel(&id);
                } else {
                    st.handle_submit(id, *spec);
                    st.try_dispatch(&tx);
                }
            }
            HubMsg::BeginShutdown => st.shutdown = true,
            HubMsg::Cancel { id } => st.handle_cancel(&id),
            HubMsg::CancelAll => {
                let ids: Vec<String> = st
                    .envelopes
                    .values()
                    .filter(|envelope| !envelope.status.is_terminal())
                    .map(|envelope| envelope.id.clone())
                    .collect();
                for id in ids {
                    st.handle_cancel(&id);
                }
            }
            HubMsg::Promote { id } => {
                if let Some(pos) = st.queue.iter().position(|q| q == &id) {
                    let item = st.queue.remove(pos);
                    st.queue.insert(0, item);
                }
            }
            HubMsg::Line { id, stream, line } => st.handle_line(&id, stream, &line),
            HubMsg::Prepared {
                id,
                mut pending,
                result,
            } => {
                if st
                    .envelopes
                    .get(&id)
                    .is_some_and(|e| e.status == TaskStatus::Running)
                {
                    match result {
                        Ok((argv, argv_redacted, directory)) => {
                            if let Some(mut envelope) = st.envelopes.get(&id).cloned() {
                                envelope.argv_redacted = argv_redacted;
                                envelope.progress = None;
                                st.persist_and_emit(envelope);
                            }
                            pending.argv = argv;
                            if let Some(directory) = directory {
                                pending.cleanup_dir = CleanupDir(Some(directory.keep()));
                            }
                            st.start_process(&id, *pending, &tx);
                        }
                        Err(error) => {
                            st.handle_line(&id, LogStream::System, &error);
                            st.handle_exited(&id, Some(1));
                        }
                    }
                } else {
                    st.handle_exited(&id, None);
                }
                st.try_dispatch(&tx);
            }
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
                prepare: spec.prepare,
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
        let Some(mut pending) = self.pending.remove(id) else {
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

        let prepare = pending.prepare.take();
        let (cancel, canceled) = oneshot::channel();
        self.running.insert(
            id.to_string(),
            RunningTask {
                killer: None,
                prepare_cancel: prepare.as_ref().map(|_| cancel),
                parser: pending.parser.clone(),
                writer,
                _cleanup_dir: CleanupDir(None),
            },
        );
        self.persist_and_emit(envelope);
        if let Some(prepare) = prepare {
            let id = id.to_string();
            let tx = tx.clone();
            let log_id = id.clone();
            let log_tx = tx.clone();
            let log = Arc::new(move |line| {
                let _ = log_tx.send(HubMsg::Line {
                    id: log_id.clone(),
                    stream: LogStream::Stdout,
                    line,
                });
            });
            tokio::spawn(async move {
                let result = run_preparation(prepare, log, canceled).await;
                let _ = tx.send(HubMsg::Prepared {
                    id,
                    pending: Box::new(pending),
                    result,
                });
            });
        } else {
            self.start_process(id, pending, tx);
        }
    }

    fn start_process(
        &mut self,
        id: &str,
        pending: PendingSpec,
        tx: &mpsc::UnboundedSender<HubMsg>,
    ) {
        let result = pending
            .cwd
            .as_ref()
            .map(std::fs::create_dir_all)
            .transpose()
            .and_then(|_| {
                spawn_and_stream(
                    id,
                    &pending.tool_path,
                    &pending.argv,
                    pending.cwd.as_deref(),
                    pending.env_path.as_deref(),
                    load_app_settings(&self.app).proxy.as_deref(),
                    tx,
                )
            });
        match result {
            Ok(killer) => {
                if let Some(run) = self.running.get_mut(id) {
                    run.killer = Some(killer);
                    run.prepare_cancel = None;
                    run._cleanup_dir = pending.cleanup_dir;
                }
            }
            Err(error) => {
                self.handle_line(
                    id,
                    LogStream::System,
                    &rust_i18n::t!("backend.task.startFailed", error = error),
                );
                let _ = tx.send(HubMsg::Exited {
                    id: id.to_string(),
                    code: None,
                });
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
                if let Some(run) = self.running.get_mut(id) {
                    if let Some(killer) = &run.killer {
                        killer.kill_tree();
                    }
                    if let Some(cancel) = run.prepare_cancel.take() {
                        let _ = cancel.send(());
                    }
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
        let mut redacted = super::redaction::redact_output_line(line);
        if self
            .envelopes
            .get(id)
            .is_some_and(|e| e.feature == Feature::Aria2)
        {
            redacted = super::redaction::redact_sensitive_urls(&redacted);
        }

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

#[cfg(test)]
mod preparation_tests {
    use super::*;

    #[tokio::test]
    async fn canceled_queue_work_never_runs_preparation() {
        let (cancel, canceled) = oneshot::channel();
        cancel.send(()).unwrap();
        let prepare: Preparation = Box::new(|_| panic!("canceled work must not start"));
        assert!(run_preparation(prepare, Arc::new(|_| {}), canceled)
            .await
            .is_err());
    }

    #[tokio::test]
    async fn cancel_drops_active_preparation_and_its_temporary_files() {
        let (cancel, canceled) = oneshot::channel();
        let (started, ready) = oneshot::channel();
        let prepare: Preparation = Box::new(move |_| {
            Box::pin(async move {
                let directory = tempfile::tempdir().unwrap();
                started.send(directory.path().to_path_buf()).unwrap();
                std::future::pending::<()>().await;
                Ok((vec![], vec![], Some(directory)))
            })
        });
        let running = tokio::spawn(run_preparation(prepare, Arc::new(|_| {}), canceled));
        let path = ready.await.unwrap();
        assert!(path.exists());
        cancel.send(()).unwrap();
        assert!(running.await.unwrap().is_err());
        assert!(!path.exists());
    }
}
