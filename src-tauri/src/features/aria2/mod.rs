//! aria2 垂直切片：意图/注册表/adapter/commands + 公共 tracker 列表。
//! 一次性任务语义（与 network/bilibili 一致）：每条下载一个 aria2c 进程，
//! 做种由 --seed-ratio/--seed-time 决定进程存活时长。

pub mod adapter;
pub mod commands;
pub mod registry;
pub mod trackers;
pub mod types;
