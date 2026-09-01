//! network（yt-dlp）feature 的结构化意图。
//! 字段集与旧前端 `YtDlpOptions`（src/lib/commands.ts）一一对应。
//! formats/metadata 不是意图模式——按 §4.1 判据它们是查询，走独立的查询 command。

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum NetworkMode {
    #[default]
    Video,
    Audio,
    Thumbnail,
    Subtitles,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct NetworkIntent {
    pub url: String,
    pub mode: NetworkMode,
    pub output_template: String,
    pub output_directory: String,
    pub proxy: String,
    pub format: String,
    pub audio_format: String,
    pub subtitle_languages: String,
    /// Cookie 文件路径（Netscape 格式，--cookies）。用户提供，主跑直接携带。
    pub cookies_file: String,
    pub playlist_items: String,
    pub retries: u32,
    pub concurrent_fragments: u32,
    pub embed_metadata: bool,
    pub embed_thumbnail: bool,
    pub embed_subtitles: bool,
    pub write_info_json: bool,
    pub no_playlist: bool,
    pub verbose: bool,
}

impl Default for NetworkIntent {
    fn default() -> Self {
        // 与旧前端 initialOptions 一致的语义默认值
        NetworkIntent {
            url: String::new(),
            mode: NetworkMode::Video,
            output_template: "%(title)s [%(id)s].%(ext)s".into(),
            output_directory: String::new(),
            proxy: String::new(),
            format: String::new(),
            audio_format: "best".into(),
            subtitle_languages: "zh.*,en.*".into(),
            cookies_file: String::new(),
            playlist_items: String::new(),
            retries: 10,
            concurrent_fragments: 4,
            embed_metadata: true,
            embed_thumbnail: false,
            embed_subtitles: false,
            write_info_json: false,
            no_playlist: false,
            verbose: false,
        }
    }
}
