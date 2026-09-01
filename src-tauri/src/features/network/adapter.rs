//! network（yt-dlp）adapter：意图 → argv 纯函数，移植自旧前端 buildYtDlpArgs。

use super::registry;
use super::types::{NetworkIntent, NetworkMode};
use crate::core::adapter::AdapterPlan;
use crate::core::task::types::{CwdPolicy, Pool, TaskIntent, TaskProgress};

/// commands.rs 解析好的运行时上下文（工具路径解析不属于纯函数翻译）。
#[derive(Debug, Clone, Default)]
pub struct NetworkCtx {
    /// deno 可执行文件路径（yt-dlp 的 --js-runtimes 注入，破解 YouTube 混淆脚本用）。
    pub deno_path: Option<String>,
    /// ffmpeg 位置（yt-dlp 合流需要；旧后端 run_tool 的注入逻辑归位至此）。
    pub ffmpeg_location: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum AdapterError {
    MissingUrl,
    InvalidIntent(String),
    EmptyArgv,
}

impl std::fmt::Display for AdapterError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AdapterError::MissingUrl => {
                write!(
                    f,
                    "{}",
                    rust_i18n::t!("backend.network.adapter.missing_url")
                )
            }
            AdapterError::InvalidIntent(e) => {
                write!(
                    f,
                    "{}",
                    rust_i18n::t!("backend.network.adapter.invalid_intent", e = e)
                )
            }
            AdapterError::EmptyArgv => {
                write!(f, "{}", rust_i18n::t!("backend.network.adapter.empty_argv"))
            }
        }
    }
}

pub fn plan(intent: &TaskIntent, ctx: &NetworkCtx) -> Result<AdapterPlan, AdapterError> {
    match intent {
        TaskIntent::Form(data) => {
            let form: NetworkIntent = serde_json::from_value(data.clone())
                .map_err(|e| AdapterError::InvalidIntent(e.to_string()))?;
            plan_form(&form, ctx)
        }
        TaskIntent::Manual { argv } => plan_manual(argv, ctx),
    }
}

fn plan_form(intent: &NetworkIntent, ctx: &NetworkCtx) -> Result<AdapterPlan, AdapterError> {
    let url = intent.url.trim();
    if url.is_empty() {
        return Err(AdapterError::MissingUrl);
    }
    let argv = build_argv(intent, ctx);
    let argv_redacted = redact_argv(&argv);
    // 输出目录即工作目录：yt-dlp 未配置 -P 时按 cwd 落盘，同时作为"打开输出位置"锚点
    let cwd = if intent.output_directory.trim().is_empty() {
        CwdPolicy::Inherit
    } else {
        CwdPolicy::Explicit(intent.output_directory.trim().to_string())
    };
    // -P 指定的下载目录提交时已知；精确文件名要等输出解析器接入
    let output_paths = if intent.output_directory.trim().is_empty() {
        Vec::new()
    } else {
        vec![intent.output_directory.trim().to_string()]
    };
    Ok(AdapterPlan {
        tool: "yt-dlp",
        argv,
        argv_redacted,
        title: title_for(intent.mode, url),
        pool: Pool::Download,
        cwd,
        output_paths,
    })
}

fn plan_manual(argv: &[String], ctx: &NetworkCtx) -> Result<AdapterPlan, AdapterError> {
    if argv.iter().all(|a| a.trim().is_empty()) {
        return Err(AdapterError::EmptyArgv);
    }
    let mut argv = argv.to_vec();
    append_ffmpeg_location(&mut argv, ctx);
    let argv_redacted = redact_argv(&argv);
    Ok(AdapterPlan {
        tool: "yt-dlp",
        title: rust_i18n::t!(
            "backend.network.adapter.manual_title",
            command = argv.first().map(String::as_str).unwrap_or("")
        )
        .to_string(),
        argv,
        argv_redacted,
        pool: Pool::Download,
        cwd: CwdPolicy::Inherit,
        output_paths: Vec::new(),
    })
}

/// 解析 yt-dlp 进度行：`[download]  45.2% of 10.55MiB at 2.35MiB/s ETA 00:03`。
/// 非 `[download] xx%` 形态（Destination/fragment 等）返回 None。
/// `\r` 刷新的多次更新共处一行时取最后一段——stream_lines 只按 `\n` 切分。
pub(crate) fn parse_progress(line: &str) -> Option<TaskProgress> {
    let line = line
        .split('\r')
        .filter(|s| !s.trim().is_empty())
        .next_back()?;
    let rest = line.trim().strip_prefix("[download] ")?.trim_start();
    let (percent, tail) = rest.split_once('%')?;
    let percent: f64 = percent.trim().parse().ok()?;
    let detail = tail
        .trim()
        .strip_prefix("of ")
        .map(|s| s.trim().to_string());
    Some(TaskProgress {
        percent: Some(percent),
        detail,
    })
}

fn build_argv(intent: &NetworkIntent, ctx: &NetworkCtx) -> Vec<String> {
    let mut argv: Vec<String> = Vec::new();
    if let Some(deno) = ctx.deno_path.as_deref().filter(|p| !p.is_empty()) {
        argv.push("--js-runtimes".into());
        argv.push(format!("deno:{deno}"));
    }
    let mut push_value = |flag: &str, value: &str| {
        let value = value.trim();
        if !value.is_empty() {
            argv.push(flag.into());
            argv.push(value.into());
        }
    };
    push_value("--proxy", &intent.proxy);
    push_value("--cookies", &intent.cookies_file);
    push_value("-P", &intent.output_directory);
    push_value("-o", &intent.output_template);
    push_value("-f", &intent.format);
    push_value("-I", &intent.playlist_items);

    argv.push("--retries".into());
    argv.push(intent.retries.to_string());
    argv.push("--concurrent-fragments".into());
    argv.push(intent.concurrent_fragments.to_string());

    let switches: [(bool, &str); 6] = [
        (intent.no_playlist, "--no-playlist"),
        (intent.embed_metadata, "--embed-metadata"),
        (intent.embed_thumbnail, "--embed-thumbnail"),
        (intent.embed_subtitles, "--embed-subs"),
        (intent.write_info_json, "--write-info-json"),
        (intent.verbose, "--verbose"),
    ];
    for (on, flag) in switches {
        if on {
            argv.push(flag.into());
        }
    }

    match intent.mode {
        NetworkMode::Video => {}
        NetworkMode::Audio => {
            argv.push("-x".into());
            argv.push("--audio-format".into());
            let format = intent.audio_format.trim();
            argv.push(if format.is_empty() {
                "best".into()
            } else {
                format.to_string()
            });
        }
        NetworkMode::Thumbnail => {
            argv.push("--skip-download".into());
            argv.push("--write-thumbnail".into());
        }
        NetworkMode::Subtitles => {
            argv.push("--skip-download".into());
            argv.push("--write-subs".into());
            let langs = intent.subtitle_languages.trim();
            if !langs.is_empty() {
                argv.push("--sub-langs".into());
                argv.push(langs.into());
            }
        }
    }

    argv.push(intent.url.trim().to_string());
    append_ffmpeg_location(&mut argv, ctx);
    argv
}

/// 旧 run_tool 的 --ffmpeg-location 注入归位：已含该 flag 则不重复（专家模式可能手写了）。
fn append_ffmpeg_location(argv: &mut Vec<String>, ctx: &NetworkCtx) {
    let Some(location) = ctx.ffmpeg_location.as_deref().filter(|p| !p.is_empty()) else {
        return;
    };
    let already = argv
        .iter()
        .any(|a| a == "--ffmpeg-location" || a.starts_with("--ffmpeg-location="));
    if !already {
        argv.push("--ffmpeg-location".into());
        argv.push(location.into());
    }
}

/// 查询种类（§4.1）：formats / metadata 是查询不是作业——结果由页面即时消费、不产出文件。
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProbeKind {
    Formats,
    Metadata,
}

/// 查询 argv：复用表单翻译，剥离下载模式 flag，追加查询 flag；不注入 ffmpeg（无合流）。
pub fn probe_argv(
    intent: &TaskIntent,
    ctx: &NetworkCtx,
    kind: ProbeKind,
) -> Result<Vec<String>, AdapterError> {
    let TaskIntent::Form(data) = intent else {
        return Err(AdapterError::InvalidIntent(
            rust_i18n::t!("backend.network.adapter.probe_form_only").to_string(),
        ));
    };
    let mut form: NetworkIntent = serde_json::from_value(data.clone())
        .map_err(|e| AdapterError::InvalidIntent(e.to_string()))?;
    if form.url.trim().is_empty() {
        return Err(AdapterError::MissingUrl);
    }
    form.mode = NetworkMode::Video;
    let probe_ctx = NetworkCtx {
        deno_path: ctx.deno_path.clone(),
        ffmpeg_location: None,
    };
    let mut argv = build_argv(&form, &probe_ctx);
    match kind {
        ProbeKind::Formats => argv.push("--list-formats".into()),
        ProbeKind::Metadata => {
            argv.push("--skip-download".into());
            argv.push("--dump-single-json".into());
        }
    }
    Ok(argv)
}

/// 落库前的意图脱敏（§4.5）：Form 清空敏感字段（proxy 可能含账号密码）；Manual 存脱敏 argv。
pub fn sanitize_intent(intent: &TaskIntent) -> TaskIntent {
    match intent {
        TaskIntent::Form(data) => {
            let mut data = data.clone();
            if let Some(map) = data.as_object_mut() {
                for meta in registry::REGISTRY.iter().filter(|m| m.sensitive) {
                    if map.contains_key(meta.field) {
                        map.insert(
                            meta.field.to_string(),
                            serde_json::Value::String(String::new()),
                        );
                    }
                }
            }
            TaskIntent::Form(data)
        }
        TaskIntent::Manual { argv } => TaskIntent::Manual {
            argv: redact_argv(argv),
        },
    }
}

fn redact_argv(argv: &[String]) -> Vec<String> {
    let sensitive: Vec<&str> = registry::sensitive_flags().collect();
    let mut out = Vec::with_capacity(argv.len());
    let mut mask_next = false;
    for arg in argv {
        if mask_next {
            out.push("***".to_string());
            mask_next = false;
            continue;
        }
        if sensitive.iter().any(|f| arg == f) {
            out.push(arg.clone());
            mask_next = true;
            continue;
        }
        if let Some(flag) = sensitive.iter().find(|f| {
            arg.len() > f.len()
                && arg.starts_with(*f)
                && matches!(arg.as_bytes()[f.len()], b'=' | b' ')
        }) {
            let sep = arg.as_bytes()[flag.len()] as char;
            out.push(format!("{flag}{sep}***"));
            continue;
        }
        out.push(arg.clone());
    }
    out
}

fn title_for(mode: NetworkMode, url: &str) -> String {
    if let Some(id) = youtube_video_id(url) {
        return match mode {
            NetworkMode::Video => {
                rust_i18n::t!("backend.network.adapter.title_youtube_video", id = id)
            }
            NetworkMode::Audio => {
                rust_i18n::t!("backend.network.adapter.title_youtube_audio", id = id)
            }
            NetworkMode::Thumbnail => {
                rust_i18n::t!("backend.network.adapter.title_youtube_thumbnail", id = id)
            }
            NetworkMode::Subtitles => {
                rust_i18n::t!("backend.network.adapter.title_youtube_subtitle", id = id)
            }
        }
        .to_string();
    }
    let verb = match mode {
        NetworkMode::Video => rust_i18n::t!("backend.network.adapter.title_video"),
        NetworkMode::Audio => rust_i18n::t!("backend.network.adapter.title_audio"),
        NetworkMode::Thumbnail => rust_i18n::t!("backend.network.adapter.title_thumbnail"),
        NetworkMode::Subtitles => rust_i18n::t!("backend.network.adapter.title_subtitle"),
    };
    format!("{verb} {url}")
}

/// 解析 YouTube 链接的 11 位视频 ID（watch?v=、youtu.be、shorts/live/embed/v 路径形态）；
/// 非 YouTube 站点与无视频 ID 的链接（纯播放列表等）返回 None，标题保持"动词 + 原始 URL"。
fn youtube_video_id(url: &str) -> Option<String> {
    let rest = url
        .trim()
        .trim_start_matches("https://")
        .trim_start_matches("http://");
    let without_fragment = rest.split('#').next().unwrap_or_default();
    let (location, query) = without_fragment
        .split_once('?')
        .unwrap_or((without_fragment, ""));
    let mut segments = location.split('/');
    let host = segments.next().unwrap_or_default().to_ascii_lowercase();
    let is_youtube = host == "youtube.com"
        || host.ends_with(".youtube.com")
        || host == "youtu.be"
        || host.ends_with(".youtu.be")
        || host == "youtube-nocookie.com"
        || host.ends_with(".youtube-nocookie.com");
    if !is_youtube {
        return None;
    }
    if host == "youtu.be" || host.ends_with(".youtu.be") {
        return segments
            .find(|segment| !segment.trim().is_empty())
            .and_then(|segment| valid_youtube_id(segment.trim()));
    }
    for pair in query.split('&') {
        if let Some((key, value)) = pair.split_once('=') {
            if key.trim() == "v" {
                if let Some(id) = valid_youtube_id(value.trim()) {
                    return Some(id);
                }
            }
        }
    }
    let mut expect_id = false;
    for segment in segments {
        let segment = segment.trim();
        if expect_id {
            if let Some(id) = valid_youtube_id(segment) {
                return Some(id);
            }
            expect_id = false;
        }
        if matches!(segment, "shorts" | "live" | "embed" | "v") {
            expect_id = true;
        }
    }
    None
}

/// YouTube 视频 ID 固定 11 位，字符集为字母数字与 -_。
fn valid_youtube_id(token: &str) -> Option<String> {
    (token.len() == 11
        && token
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_'))
    .then(|| token.to_string())
}
