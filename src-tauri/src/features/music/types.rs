use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MusicdlSearchRequest {
    pub(crate) keyword: String,
    pub(crate) music_sources: Vec<String>,
    pub(crate) init_music_clients_cfg: serde_json::Value,
    pub(crate) requests_overrides: serde_json::Value,
    pub(crate) clients_threadings: serde_json::Value,
    pub(crate) search_rules: serde_json::Value,
    pub(crate) output_directory: Option<String>,
    pub(crate) search_size_per_source: usize,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MusicdlPlaylistRequest {
    pub(crate) playlist_url: String,
    pub(crate) music_sources: Vec<String>,
    pub(crate) init_music_clients_cfg: serde_json::Value,
    pub(crate) requests_overrides: serde_json::Value,
    pub(crate) clients_threadings: serde_json::Value,
    pub(crate) search_rules: serde_json::Value,
    pub(crate) output_directory: Option<String>,
    #[serde(default)]
    pub(crate) downsample: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MusicdlSearchResult {
    index: usize,
    song_name: String,
    singers: String,
    album: String,
    extension: String,
    file_size: String,
    file_size_bytes: Option<f64>,
    duration: String,
    bitrate: Option<u64>,
    codec: String,
    sample_rate: Option<u64>,
    channels: Option<u64>,
    source: String,
    root_source: String,
    cover_url: Option<String>,
    lossless: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MusicdlSearchResponse {
    pub(crate) session_id: String,
    pub(crate) results: Vec<MusicdlSearchResult>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct MusicdlAdapterOutput {
    pub(crate) results: Vec<MusicdlSearchResult>,
}

/// 前端 `MusicdlCliOptions` 的后端镜像，仅用于生成等效 musicdl CLI 预览。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MusicdlPreviewRequest {
    pub(crate) keyword: String,
    pub(crate) playlist_url: String,
    pub(crate) music_sources: Vec<String>,
    pub(crate) init_music_clients_cfg: serde_json::Map<String, serde_json::Value>,
    pub(crate) requests_overrides: serde_json::Map<String, serde_json::Value>,
    pub(crate) clients_threadings: serde_json::Map<String, serde_json::Value>,
    pub(crate) search_rules: serde_json::Map<String, serde_json::Value>,
}
