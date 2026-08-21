//! 横切基础设施共享内核（架构文档 §3）：任务系统、进程执行、依赖探测与设置持久化。

pub mod adapter;
pub mod deps;
pub mod process;
pub mod query;
pub mod redaction;
pub mod registry;
pub mod settings;
pub mod task;
pub mod update;
