//! bilibili adapter（架构文档 §2）：意图 → argv 的纯函数。
//! 移植自旧前端 buildBilibiliArgs（src/lib/commands.ts），argv 顺序与其保持一致。
//! 脱敏（§4.5）在此完成：AdapterPlan 同时携带完整与脱敏两份 argv，
//! 完整版仅供 spawn 瞬间消费，脱敏版供落库与展示。

use super::registry;
use super::types::{Api, BilibiliIntent, Mode};
use crate::core::adapter::AdapterPlan;
use crate::core::task::types::{CwdPolicy, Pool, TaskIntent};

#[derive(Debug, Clone, PartialEq)]
pub enum AdapterError {
    /// 表单意图缺少 URL。
    MissingUrl,
    /// 表单数据无法解析为 BilibiliIntent。
    InvalidIntent(String),
    /// 专家模式提交了空命令。
    EmptyArgv,
}

impl std::fmt::Display for AdapterError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AdapterError::MissingUrl => {
                write!(f, "{}", rust_i18n::t!("backend.bilibili.adapter.missing_url"))
            }
            AdapterError::InvalidIntent(e) => {
                write!(f, "{}", rust_i18n::t!("backend.bilibili.adapter.invalid_intent", e = e))
            }
            AdapterError::EmptyArgv => {
                write!(f, "{}", rust_i18n::t!("backend.bilibili.adapter.empty_argv"))
            }
        }
    }
}

pub fn plan(intent: &TaskIntent) -> Result<AdapterPlan, AdapterError> {
    match intent {
        TaskIntent::Form(data) => {
            let form: BilibiliIntent = serde_json::from_value(data.clone())
                .map_err(|e| AdapterError::InvalidIntent(e.to_string()))?;
            plan_form(&form)
        }
        TaskIntent::Manual { argv } => plan_manual(argv),
    }
}

fn plan_form(intent: &BilibiliIntent) -> Result<AdapterPlan, AdapterError> {
    let url = intent.url.trim();
    if url.is_empty() {
        return Err(AdapterError::MissingUrl);
    }

    let mut argv: Vec<String> = vec![url.to_string()];

    match intent.api {
        Api::Web => {}
        Api::Tv => argv.push("--use-tv-api".into()),
        Api::App => argv.push("--use-app-api".into()),
        Api::Intl => argv.push("--use-intl-api".into()),
    }

    match intent.mode {
        Mode::Video => {}
        Mode::VideoOnly => argv.push("--video-only".into()),
        Mode::Audio => argv.push("--audio-only".into()),
        Mode::Cover => argv.push("--cover-only".into()),
        Mode::Subtitle => argv.push("--sub-only".into()),
        Mode::Danmaku => argv.push("--danmaku-only".into()),
        Mode::Info => argv.push("--only-show-info".into()),
    }

    let mut push_value = |flag: &str, value: &str| {
        let value = value.trim();
        if !value.is_empty() {
            argv.push(flag.into());
            argv.push(value.into());
        }
    };
    push_value("--select-page", &intent.pages);
    push_value("--encoding-priority", &intent.encoding_priority);
    push_value("--dfn-priority", &intent.quality_priority);
    push_value("--file-pattern", &intent.file_pattern);
    push_value("--multi-file-pattern", &intent.multi_file_pattern);

    let switches: [(bool, &str); 17] = [
        (intent.use_mp4box, "--use-mp4box"),
        (intent.use_aria2c, "--use-aria2c"),
        (intent.show_all, "--show-all"),
        (intent.hide_streams, "--hide-streams"),
        (intent.skip_mux, "--skip-mux"),
        (intent.skip_subtitle, "--skip-subtitle"),
        (intent.skip_cover, "--skip-cover"),
        (intent.skip_ai, "--skip-ai"),
        (intent.multi_thread, "--multi-thread"),
        (intent.force_http, "--force-http"),
        (intent.download_danmaku, "--download-danmaku"),
        (intent.video_ascending, "--video-ascending"),
        (intent.audio_ascending, "--audio-ascending"),
        (intent.allow_pcdn, "--allow-pcdn"),
        (intent.force_replace_host, "--force-replace-host"),
        (intent.save_archive, "--save-archives-to-file"),
        (intent.debug, "--debug"),
    ];
    for (on, flag) in switches {
        if on {
            argv.push(flag.into());
        }
    }

    let mut push_value = |flag: &str, value: &str| {
        let value = value.trim();
        if !value.is_empty() {
            argv.push(flag.into());
            argv.push(value.into());
        }
    };
    push_value("--language", &intent.language);
    push_value("--user-agent", &intent.user_agent);
    push_value("--cookie", &intent.cookie);
    push_value("--access-token", &intent.access_token);
    push_value("--aria2c-args", &intent.aria2c_args);
    push_value("--mp4box-path", &intent.mp4box_path);
    push_value("--aria2c-path", &intent.aria2c_path);
    push_value("--upos-host", &intent.upos_host);
    push_value("--delay-per-page", &intent.delay_per_page);
    push_value("--host", &intent.host);
    push_value("--ep-host", &intent.ep_host);
    push_value("--area", &intent.area);
    push_value("--config-file", &intent.config_file);
    push_value("--work-dir", &intent.output_directory);

    for line in intent.extra_args.split(['\r', '\n']) {
        let line = line.trim();
        if !line.is_empty() {
            argv.push(line.into());
        }
    }

    let argv_redacted = redact_argv(&argv);
    let output_paths = known_output_dir(&intent.output_directory);
    Ok(AdapterPlan {
        tool: "bbdown",
        title: title_for(intent.mode, url),
        argv,
        argv_redacted,
        pool: Pool::Download,
        cwd: CwdPolicy::ExeDir,
        output_paths,
    })
}

fn plan_manual(argv: &[String]) -> Result<AdapterPlan, AdapterError> {
    if argv.iter().all(|a| a.trim().is_empty()) {
        return Err(AdapterError::EmptyArgv);
    }
    let argv: Vec<String> = argv.to_vec();
    let argv_redacted = redact_argv(&argv);
    Ok(AdapterPlan {
        tool: "bbdown",
        title: rust_i18n::t!(
            "backend.bilibili.adapter.manual_title",
            command = argv.first().map(String::as_str).unwrap_or("")
        )
        .to_string(),
        argv,
        argv_redacted,
        pool: Pool::Download,
        cwd: CwdPolicy::ExeDir,
        output_paths: Vec::new(),
    })
}

/// --work-dir 指定的下载目录（提交时已知；精确文件名要等输出解析器接入）。
fn known_output_dir(directory: &str) -> Vec<String> {
    let trimmed = directory.trim();
    if trimmed.is_empty() {
        Vec::new()
    } else {
        vec![trimmed.to_string()]
    }
}

fn title_for(mode: Mode, url: &str) -> String {
    let verb = match mode {
        Mode::Video => rust_i18n::t!("backend.bilibili.adapter.title_video"),
        Mode::VideoOnly => rust_i18n::t!("backend.bilibili.adapter.title_video_track"),
        Mode::Audio => rust_i18n::t!("backend.bilibili.adapter.title_audio"),
        Mode::Cover => rust_i18n::t!("backend.bilibili.adapter.title_cover"),
        Mode::Subtitle => rust_i18n::t!("backend.bilibili.adapter.title_subtitle"),
        Mode::Danmaku => rust_i18n::t!("backend.bilibili.adapter.title_danmaku"),
        Mode::Info => rust_i18n::t!("backend.bilibili.adapter.title_info"),
    };
    format!("{verb} {url}")
}

/// 落库前的意图脱敏（§4.5 的推论，实现期发现的设计洞）：
/// intent 双存供重跑，但表单原文含敏感字段值（cookie 等），照原样落库即明文泄漏。
/// - Form：敏感注册表字段清空——重跑时由当前登录态/设置补充（旧凭证大概率已过期，
///   取当前值语义反而更正确）；
/// - Manual：argv 存脱敏版——手改命令中的敏感值不保存，重跑需重填（UI 应提示）。
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

/// 按注册表的敏感 flag 集合遮蔽 argv 中的秘密值。
/// 覆盖三种形态：`--cookie value`（独立两参）、`--cookie=value`、
/// `--cookie value`（同一 arg 内，来自专家模式/extraArgs 的整行原文）。
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
