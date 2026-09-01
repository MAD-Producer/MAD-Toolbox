//! network（yt-dlp）参数注册表（架构文档 §6）。
//! 字段→flag 映射记录 CLI 参数面；脱敏（§4.5）的敏感集合由此派生（唯一真相源）。

use crate::core::registry::ParamMeta;

const fn meta(field: &'static str, flag: &'static str) -> ParamMeta {
    ParamMeta {
        field,
        flag,
        sensitive: false,
    }
}

pub const REGISTRY: &[ParamMeta] = &[
    meta("url", ""),
    meta("mode", ""),
    meta("outputTemplate", "-o"),
    meta("outputDirectory", "-P"),
    ParamMeta {
        field: "proxy",
        flag: "--proxy",
        sensitive: true,
    },
    meta("format", "-f"),
    meta("audioFormat", "--audio-format"),
    meta("subtitleLanguages", "--sub-langs"),
    meta("cookiesFile", "--cookies"),
    meta("playlistItems", "-I"),
    meta("retries", "--retries"),
    meta("concurrentFragments", "--concurrent-fragments"),
    meta("noPlaylist", "--no-playlist"),
    meta("embedMetadata", "--embed-metadata"),
    meta("embedThumbnail", "--embed-thumbnail"),
    meta("embedSubtitles", "--embed-subs"),
    meta("writeInfoJson", "--write-info-json"),
    meta("verbose", "--verbose"),
];

/// 脱敏 flag 集合（§4.5）。
pub fn sensitive_flags() -> impl Iterator<Item = &'static str> {
    REGISTRY.iter().filter(|m| m.sensitive).map(|m| m.flag)
}
