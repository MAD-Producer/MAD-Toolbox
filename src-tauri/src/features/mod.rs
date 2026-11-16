//! 业务域垂直切片（架构文档 §3）。各 feature 互不引用，只依赖 core。

pub mod aria2;
pub mod bilibili;
pub mod media;
pub mod music;
pub mod network;
