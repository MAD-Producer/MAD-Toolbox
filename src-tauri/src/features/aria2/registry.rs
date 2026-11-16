//! aria2 参数注册表（架构文档 §6）。
//! 字段→flag 映射记录 CLI 参数面；脱敏（§4.5）的敏感集合由此派生（唯一真相源）。

use crate::core::registry::ParamMeta;

const fn meta(field: &'static str, flag: &'static str) -> ParamMeta {
    ParamMeta {
        field,
        flag,
        sensitive: false,
    }
}

const fn sensitive(field: &'static str, flag: &'static str) -> ParamMeta {
    ParamMeta {
        field,
        flag,
        sensitive: true,
    }
}

pub const REGISTRY: &[ParamMeta] = &[
    // uri / torrentFile 是位置参数，无 flag
    sensitive("uri", ""),
    meta("torrentFile", ""),
    meta("outputDirectory", "--dir"),
    sensitive("allProxy", "--all-proxy"),
    meta("maxOverallDownloadLimit", "--max-overall-download-limit"),
    meta("maxDownloadLimit", "--max-download-limit"),
    meta("maxOverallUploadLimit", "--max-overall-upload-limit"),
    meta("userAgent", "--user-agent"),
    sensitive("referer", "--referer"),
    sensitive("header", "--header"),
    meta("cookiesFile", "--load-cookies"),
    meta("split", "--split"),
    meta("maxConnectionPerServer", "--max-connection-per-server"),
    meta("ptMode", ""),
    meta("trackerSource", ""),
    meta("injectTrackers", "--bt-tracker"),
    meta("dht", "--enable-dht"),
    meta("peerExchange", "--enable-peer-exchange"),
    meta("lpd", "--bt-enable-lpd"),
    meta("btMaxPeers", "--bt-max-peers"),
    meta("seedAfterDownload", "--seed-time"),
    meta("seedRatio", "--seed-ratio"),
    meta("seedTimeMinutes", "--seed-time"),
];

/// 仅手工命令可能出现的凭据 flag：不在表单字段里，但专家模式原样执行用户
/// argv，脱敏必须一并覆盖，防止密码经任务卡/日志泄漏。
const MANUAL_SENSITIVE_FLAGS: &[&str] = &[
    "--http-passwd",
    "--https-passwd",
    "--ftp-passwd",
    "--all-proxy-passwd",
    "--http-proxy-passwd",
    "--https-proxy-passwd",
    "--ftp-proxy-passwd",
    "--rpc-secret",
    "--rpc-passwd",
];

/// 脱敏 flag 集合（§4.5）：表单敏感字段 + 手工模式凭据 flag。
pub fn sensitive_flags() -> Vec<String> {
    REGISTRY
        .iter()
        .filter(|m| m.sensitive)
        .map(|m| m.flag.to_string())
        .chain(MANUAL_SENSITIVE_FLAGS.iter().map(|f| f.to_string()))
        .filter(|f| !f.is_empty())
        .collect()
}
