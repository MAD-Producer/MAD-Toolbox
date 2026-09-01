//! 任务系统契约类型（架构文档 §4.2）。
//! `TaskEnvelope` 一份 struct 三处使用：运行时调度对象、SQLite `tasks` 表行、前端事件载荷。
//! 完整（未脱敏）argv 不属于信封——它只存在于 AdapterPlan/TaskSpec，spawn 瞬间消费一次。

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Feature {
    Bilibili,
    Network,
    Media,
    Music,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Pool {
    Download,
    Local,
}

/// 状态机的七个状态（§4.3）。序列化字符串即 SQLite 行值与 TS 判别式，
/// 改动会破坏持久化与前端契约兼容。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TaskStatus {
    Queued,
    Running,
    Canceling,
    Success,
    Failed,
    Canceled,
    Interrupted,
}

impl TaskStatus {
    /// 终态：不再发生任何转移。
    pub fn is_terminal(self) -> bool {
        matches!(
            self,
            TaskStatus::Success
                | TaskStatus::Failed
                | TaskStatus::Canceled
                | TaskStatus::Interrupted
        )
    }
}

/// 表单/手改二态标志位（§4.2）：[基于此任务新建] 据此决定灌回表单还是专家文本框。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", content = "data", rename_all = "lowercase")]
pub enum TaskIntent {
    /// 表单提交的结构化意图，schema 归属各 feature，枢纽不解开。
    Form(serde_json::Value),
    /// 专家模式手改的命令原文。
    Manual { argv: Vec<String> },
}

/// 运行期内存态进度，不落库（§4.2）。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TaskProgress {
    pub percent: Option<f64>,
    pub detail: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskEnvelope {
    pub id: String,
    pub feature: Feature,
    pub pool: Pool,
    pub title: String,
    pub status: TaskStatus,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub started_at: Option<chrono::DateTime<chrono::Utc>>,
    pub finished_at: Option<chrono::DateTime<chrono::Utc>>,
    pub tool: String,
    pub tool_version: Option<String>,
    /// 脱敏后的 argv——落库与展示的唯一版本（§4.5）。
    pub argv_redacted: Vec<String>,
    pub working_dir: Option<String>,
    pub output_paths: Vec<String>,
    pub exit_code: Option<i32>,
    pub log_path: Option<String>,
    pub intent: TaskIntent,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub progress: Option<TaskProgress>,
}

/// 推给前端的任务事件
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(
    tag = "type",
    content = "data",
    rename_all = "lowercase",
    rename_all_fields = "camelCase"
)]
pub enum TaskEvent {
    Changed(TaskEnvelope),
    Log {
        task_id: String,
        stream: LogStream,
        line: String,
        seq: u64,
    },
    Progress {
        task_id: String,
        progress: TaskProgress,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogStream {
    Stdout,
    Stderr,
    System,
}

/// 子进程工作目录策略，由 adapter 声明。
#[derive(Debug, Clone, PartialEq)]
pub enum CwdPolicy {
    /// 继承应用当前目录。
    Inherit,
    /// 强制为工具可执行文件所在目录（BBDown：BBDown.data/配置/存档须与 exe 同目录）。
    ExeDir,
    /// 显式目录：下载类工具的输出目录。产物落点即工作目录，
    /// 落入信封 working_dir 后同时作为任务卡"打开输出位置"的锚点。
    Explicit(String),
}
