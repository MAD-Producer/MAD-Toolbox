//! aria2 feature 的结构化意图。
//! uri 覆盖 HTTP(S)/FTP/SFTP/磁力；.torrent 文件路径非空时优先于 uri。

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Aria2Intent {
    pub uri: String,
    pub torrent_file: String,
    pub output_directory: String,
    /// `--all-proxy`（敏感：可能含账号密码）。
    pub all_proxy: String,
    pub max_overall_download_limit: String,
    pub max_download_limit: String,
    pub max_overall_upload_limit: String,
    pub user_agent: String,
    pub referer: String,
    /// 每行一条 `--header`（敏感：可能含 Authorization）。
    pub header: String,
    /// Cookie 文件路径（Netscape 格式，--load-cookies）。用户提供，主跑直接携带。
    pub cookies_file: String,
    /// `--split`（HTTP/FTP 分段数）。
    pub split: u32,
    /// `--max-connection-per-server`（HTTP/FTP，上限 16）。
    pub max_connection_per_server: u32,
    /// 向公开 BT 追加公共 tracker。
    pub inject_trackers: bool,
    pub dht: bool,
    pub peer_exchange: bool,
    pub lpd: bool,
    pub bt_max_peers: u32,
    /// 下载完成后做种；false 时传 `--seed-time=0` 下载完即退。
    pub seed_after_download: bool,
    /// `--seed-ratio`，0 = 不限（一直做种）。
    pub seed_ratio: f64,
    /// 做种时限（分钟）；0 = 不限时，只看 seed_ratio。
    pub seed_time_minutes: u32,
}

impl Default for Aria2Intent {
    fn default() -> Self {
        Aria2Intent {
            uri: String::new(),
            torrent_file: String::new(),
            output_directory: String::new(),
            all_proxy: String::new(),
            max_overall_download_limit: String::new(),
            max_download_limit: String::new(),
            max_overall_upload_limit: String::new(),
            user_agent: String::new(),
            referer: String::new(),
            header: String::new(),
            cookies_file: String::new(),
            split: 16,
            max_connection_per_server: 16,
            inject_trackers: true,
            dht: true,
            peer_exchange: true,
            lpd: false,
            bt_max_peers: 200,
            seed_after_download: false,
            seed_ratio: 1.0,
            seed_time_minutes: 0,
        }
    }
}
