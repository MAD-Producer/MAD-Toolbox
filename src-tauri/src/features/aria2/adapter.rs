//! aria2 adapter：意图 → argv 纯函数。
//! 默认值对齐 aria2 语义：--seed-ratio 默认 1.0；--seed-time=0 表示下载完即退，
//! 不传 --seed-time 时只受 ratio 约束；--bt-max-peers 默认 55。

use super::registry;
use super::types::Aria2Intent;
use crate::core::adapter::AdapterPlan;
use crate::core::redaction::{redact_output_line, redact_sensitive_urls};
use crate::core::task::types::{CwdPolicy, Pool, TaskIntent, TaskProgress};

/// commands.rs 解析好的运行时上下文（tracker 列表不属于纯函数翻译）。
#[derive(Debug, Clone, Default)]
pub struct Aria2Ctx {
    pub trackers: Vec<String>,
    /// 来自已解析的本地种子；None 表示尚未取得元数据。
    pub private_torrent: Option<bool>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum AdapterError {
    MissingUri,
    InvalidIntent(String),
    ManualUnsupported,
    PrivateTorrentRejected,
    UnsupportedUri,
}

impl std::fmt::Display for AdapterError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AdapterError::MissingUri => {
                write!(f, "{}", rust_i18n::t!("backend.aria2.adapter.missing_uri"))
            }
            AdapterError::InvalidIntent(e) => {
                write!(
                    f,
                    "{}",
                    rust_i18n::t!("backend.aria2.adapter.invalid_intent", e = e)
                )
            }
            AdapterError::ManualUnsupported => {
                write!(
                    f,
                    "{}",
                    rust_i18n::t!("backend.aria2.adapter.manual_unsupported")
                )
            }
            AdapterError::PrivateTorrentRejected => {
                write!(
                    f,
                    "{}",
                    rust_i18n::t!("backend.aria2.adapter.private_torrent_rejected")
                )
            }
            AdapterError::UnsupportedUri => {
                write!(
                    f,
                    "{}",
                    rust_i18n::t!("backend.aria2.adapter.unsupported_uri")
                )
            }
        }
    }
}

pub fn plan(intent: &TaskIntent, ctx: &Aria2Ctx) -> Result<AdapterPlan, AdapterError> {
    match intent {
        TaskIntent::Form(data) => {
            let form: Aria2Intent = serde_json::from_value(data.clone())
                .map_err(|e| AdapterError::InvalidIntent(e.to_string()))?;
            plan_form(&form, ctx)
        }
        TaskIntent::Manual { .. } => Err(AdapterError::ManualUnsupported),
    }
}

fn plan_form(intent: &Aria2Intent, ctx: &Aria2Ctx) -> Result<AdapterPlan, AdapterError> {
    let torrent = intent.torrent_file.trim();
    let uri = intent.uri.trim();
    if torrent.is_empty() && uri.is_empty() {
        return Err(AdapterError::MissingUri);
    }
    if ctx.private_torrent == Some(true) {
        return Err(AdapterError::PrivateTorrentRejected);
    }
    if torrent.is_empty() {
        let valid = reqwest::Url::parse(uri)
            .is_ok_and(|url| matches!(url.scheme(), "http" | "https" | "ftp" | "sftp" | "magnet"));
        if !valid {
            return Err(AdapterError::UnsupportedUri);
        }
    }
    let argv = build_argv(intent, ctx);
    let argv_redacted = redact_argv(&argv);
    // 输出目录即工作目录：--dir 未配置时按 cwd 落盘，同时作为"打开输出位置"锚点
    let cwd = if intent.output_directory.trim().is_empty() {
        CwdPolicy::Inherit
    } else {
        CwdPolicy::Explicit(intent.output_directory.trim().to_string())
    };
    let output_paths = if intent.output_directory.trim().is_empty() {
        Vec::new()
    } else {
        vec![intent.output_directory.trim().to_string()]
    };
    Ok(AdapterPlan {
        tool: "aria2c",
        argv,
        argv_redacted,
        title: title_for(intent),
        pool: Pool::Download,
        cwd,
        output_paths,
    })
}

/// 按用户设置为公开 BT 追加 tracker。
pub(crate) fn needs_trackers(intent: &TaskIntent, ctx: &Aria2Ctx) -> bool {
    match intent {
        TaskIntent::Form(data) => serde_json::from_value::<Aria2Intent>(data.clone())
            .map(|form| ctx.private_torrent != Some(true) && form.inject_trackers)
            .unwrap_or(false),
        TaskIntent::Manual { .. } => false,
    }
}

fn build_argv(intent: &Aria2Intent, ctx: &Aria2Ctx) -> Vec<String> {
    // 断点续传 + 可预期的重复提交（重名文件报错而非改写为 .1，靠 .aria2 控制文件续传）；
    // Windows 官方构建把 TTY 判断硬编码为 true，每秒读出行只发 \r 不发 \n，
    // 按 \n 切行的流读取要等 60s 汇总才有事件；关掉读出行、改用每秒汇总行驱动进度
    // （汇总行同样以 [#gid ...] 形式输出，parse_progress 兼容）；
    // --no-conf 隔离用户 aria2.conf——rpc/seed-time/额外 tracker 会改写一次性任务语义
    let mut argv: Vec<String> = vec![
        "--continue=true".into(),
        "--auto-file-renaming=false".into(),
        "--show-console-readout=false".into(),
        "--summary-interval=1".into(),
        "--no-conf=true".into(),
        "--follow-torrent=false".into(),
        "--follow-metalink=false".into(),
    ];

    let mut push_value = |flag: &str, value: &str| {
        let value = value.trim();
        if !value.is_empty() {
            argv.push(flag.into());
            argv.push(value.into());
        }
    };
    // 不传 --dir：输出目录即进程 cwd（见 plan_form），aria2 默认落盘到 cwd；
    // 显式传相对 --dir 会被按 cwd 再解析一次，产生 dir/dir 双重拼接
    push_value("--all-proxy", &intent.all_proxy);
    push_value(
        "--max-overall-download-limit",
        &intent.max_overall_download_limit,
    );
    push_value("--max-download-limit", &intent.max_download_limit);
    push_value(
        "--max-overall-upload-limit",
        &intent.max_overall_upload_limit,
    );
    push_value("--user-agent", &intent.user_agent);
    push_value("--referer", &intent.referer);
    for line in intent.header.lines() {
        push_value("--header", line);
    }
    push_value("--load-cookies", &intent.cookies_file);
    argv.push("--split".into());
    argv.push(intent.split.max(1).to_string());
    argv.push("--max-connection-per-server".into());
    argv.push(intent.max_connection_per_server.clamp(1, 16).to_string());

    // HTTP 响应也可能被 aria2 跟随为种子，BT 设置必须覆盖该路径。
    if intent.seed_after_download {
        let ratio = intent.seed_ratio.clamp(0.0, 10_000.0);
        argv.extend(["--seed-ratio".into(), format!("{ratio:.2}")]);
        if intent.seed_time_minutes > 0 {
            argv.extend(["--seed-time".into(), intent.seed_time_minutes.to_string()]);
        }
    } else {
        argv.extend(["--seed-time".into(), "0".into()]);
    }
    if !intent.dht {
        argv.push("--enable-dht=false".into());
        argv.push("--enable-dht6=false".into());
    }
    if !intent.peer_exchange {
        argv.push("--enable-peer-exchange=false".into());
    }
    if intent.lpd {
        argv.push("--bt-enable-lpd=true".into());
    }
    if intent.inject_trackers && !ctx.trackers.is_empty() {
        argv.extend(["--bt-tracker".into(), ctx.trackers.join(",")]);
    }
    if intent.bt_max_peers != 55 {
        argv.extend(["--bt-max-peers".into(), intent.bt_max_peers.to_string()]);
    }

    let torrent = intent.torrent_file.trim();
    // -- 结束选项解析：URI/路径以 '-' 开头也不会被 aria2 当成 flag（选项注入防护）
    argv.push("--".into());
    if torrent.is_empty() {
        argv.push(intent.uri.trim().to_string());
    } else {
        argv.push(torrent.to_string());
    }
    argv
}

/// 解析 aria2 控制台读出行：`[#a1b2c3 10MiB/100MiB(10%) CN:4 DL:2.5MiB ETA:35s]`。
/// 元数据与做种阶段通过 detail 展示；任务成功仍以进程退出为准。
/// `\r` 刷新的多次更新共处一行时取最后一段——stream_lines 只按 `\n` 切分。
pub(crate) fn parse_progress(line: &str) -> Option<TaskProgress> {
    let segment = line.split('\r').rfind(|s| !s.trim().is_empty())?;
    let segment = segment.trim();
    if segment.starts_with("FILE: [MEMORY][METADATA]") {
        return Some(TaskProgress {
            percent: None,
            detail: Some(rust_i18n::t!("backend.aria2.progress.metadata").to_string()),
        });
    }
    let rest = segment.strip_prefix("[#")?.trim_start();
    let (_gid, rest) = rest.split_once(' ')?;
    if rest.starts_with("SEED(") {
        return Some(TaskProgress {
            percent: Some(100.0),
            detail: Some(rust_i18n::t!("backend.aria2.progress.seeding").to_string()),
        });
    }
    let (done, rest) = rest.split_once('/')?;
    let (total, pct) = rest.split_once('(')?;
    // 读出行括号后还有 CN:/DL:/ETA: 等字段，百分比只取到首个 ')' 为止
    let pct: f64 = pct
        .split(')')
        .next()?
        .trim_end_matches('%')
        .trim()
        .parse()
        .ok()?;
    let detail = rust_i18n::t!(
        "backend.aria2.progress.downloading",
        done = done,
        total = total
    )
    .to_string();
    Some(TaskProgress {
        percent: Some(pct.clamp(0.0, 100.0)),
        detail: Some(detail),
    })
}

/// 持久化与展示使用相同的凭据脱敏规则，保留可复用的普通参数。
pub fn sanitize_intent(intent: &TaskIntent) -> TaskIntent {
    match intent {
        TaskIntent::Form(data) => {
            let mut data = data.clone();
            if let Some(map) = data.as_object_mut() {
                for meta in registry::REGISTRY.iter().filter(|m| m.sensitive) {
                    if map.contains_key(meta.field) {
                        if let Some(value) = map[meta.field].as_str() {
                            let value = redact_value(meta.flag, value);
                            map.insert(meta.field.to_string(), serde_json::Value::String(value));
                        }
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

fn redact_value(flag: &str, value: &str) -> String {
    match flag {
        "" | "--referer" => redact_sensitive_urls(value),
        "--header" => value
            .lines()
            .map(|line| redact_sensitive_urls(&redact_output_line(line)))
            .collect::<Vec<_>>()
            .join("\n"),
        "--all-proxy" => {
            if value.contains("://") || !value.contains('@') {
                redact_sensitive_urls(value)
            } else {
                redact_sensitive_urls(&format!("http://{value}"))
                    .trim_start_matches("http://")
                    .trim_end_matches('/')
                    .to_string()
            }
        }
        _ => "***".into(),
    }
}

fn redact_argv(argv: &[String]) -> Vec<String> {
    let sensitive = registry::sensitive_flags();
    let mut out = Vec::with_capacity(argv.len());
    let mut next_flag: Option<&str> = None;
    for arg in argv {
        if let Some(flag) = next_flag.take() {
            out.push(redact_value(flag, arg));
            continue;
        }
        let (name, value) = arg
            .split_once('=')
            .map_or((arg.as_str(), None), |(n, v)| (n, Some(v)));
        // getopt_long 接受无歧义缩写，脱敏与完整 flag 使用同一规则。
        let flag = sensitive.iter().find(|f| f.as_str() == name).or_else(|| {
            sensitive
                .iter()
                .find(|f| name.starts_with("--") && name.len() >= 5 && f.starts_with(name))
        });
        if let Some(flag) = flag {
            if let Some(value) = value {
                out.push(format!("{name}={}", redact_value(flag, value)));
            } else {
                out.push(arg.clone());
                next_flag = Some(flag);
            }
        } else {
            out.push(redact_sensitive_urls(arg));
        }
    }
    out
}

fn title_for(intent: &Aria2Intent) -> String {
    let torrent = intent.torrent_file.trim();
    if !torrent.is_empty() {
        let name = std::path::Path::new(torrent)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("");
        return rust_i18n::t!("backend.aria2.adapter.title_torrent", name = name).to_string();
    }
    let uri = intent.uri.trim();
    if let Some(hash) = magnet_btih(uri) {
        return rust_i18n::t!("backend.aria2.adapter.title_magnet", hash = hash).to_string();
    }
    rust_i18n::t!(
        "backend.aria2.adapter.title_uri",
        uri = redact_sensitive_urls(uri)
    )
    .to_string()
}

/// 提取磁力链的 v1 info hash（`magnet:?xt=urn:btih:<HASH>`），供任务标题展示。
fn magnet_btih(uri: &str) -> Option<String> {
    if !uri.to_ascii_lowercase().starts_with("magnet:") {
        return None;
    }
    let lower = uri.to_ascii_lowercase();
    let marker = "xt=urn:btih:";
    let start = lower.find(marker)? + marker.len();
    let hash = uri[start..].split('&').next()?;
    let valid = (hash.len() == 40 && hash.bytes().all(|c| c.is_ascii_hexdigit()))
        || (hash.len() == 32
            && hash
                .bytes()
                .all(|c| c.is_ascii_alphabetic() || (b'2'..=b'7').contains(&c)));
    valid.then(|| hash.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn form() -> Aria2Intent {
        Aria2Intent {
            uri: "https://example.com/file.zip".into(),
            ..Default::default()
        }
    }

    #[test]
    fn http_form_includes_resume_split_and_positional_uri() {
        let argv = build_argv(&form(), &Aria2Ctx::default());
        assert!(argv.contains(&"--continue=true".to_string()));
        assert!(argv.contains(&"--auto-file-renaming=false".to_string()));
        // Windows 下进度事件依赖每秒汇总行（读出行不带 \n，见 build_argv 注释）
        assert!(argv.contains(&"--show-console-readout=false".to_string()));
        assert!(argv.contains(&"--summary-interval=1".to_string()));
        let split_at = argv.iter().position(|a| a == "--split").unwrap();
        assert_eq!(argv[split_at + 1], "16");
        assert_eq!(argv.last().unwrap(), "https://example.com/file.zip");
        assert!(argv.contains(&"--seed-time".to_string()));
        assert!(!argv.contains(&"--bt-tracker".to_string()));
    }

    #[test]
    fn public_torrent_disables_seeding_by_default_and_injects_trackers() {
        let mut intent = form();
        intent.torrent_file = "public.torrent".into();
        let ctx = Aria2Ctx {
            trackers: vec!["udp://a:80/announce".into(), "http://b/announce".into()],
            private_torrent: Some(false),
        };
        let argv = build_argv(&intent, &ctx);
        let find = |flag: &str| {
            let i = argv.iter().position(|a| a == flag).unwrap();
            argv[i + 1].clone()
        };
        assert_eq!(find("--seed-time"), "0");
        assert_eq!(find("--split"), "16");
        assert_eq!(find("--max-connection-per-server"), "16");
        assert_eq!(find("--bt-max-peers"), "200");
        assert!(!argv.contains(&"--seed-ratio".to_string()));
        assert_eq!(
            find("--bt-tracker"),
            "udp://a:80/announce,http://b/announce"
        );
        intent.seed_after_download = true;
        let argv = build_argv(&intent, &ctx);
        let ratio = argv.iter().position(|arg| arg == "--seed-ratio").unwrap();
        assert_eq!(argv[ratio + 1], "1.00");
        assert!(!argv.contains(&"--seed-time".to_string()));
    }

    #[test]
    fn local_torrents_cannot_bypass_validation_through_uri_input() {
        for uri in [
            "private.torrent",
            "C:/Downloads/private.torrent",
            "file:///tmp/private.torrent",
        ] {
            let intent = Aria2Intent {
                uri: uri.into(),
                ..Default::default()
            };
            assert_eq!(
                plan_form(&intent, &Aria2Ctx::default()).unwrap_err(),
                AdapterError::UnsupportedUri
            );
        }
    }

    #[test]
    fn private_torrents_and_manual_commands_are_rejected() {
        let ctx = Aria2Ctx {
            private_torrent: Some(true),
            ..Default::default()
        };
        assert_eq!(
            plan_form(&form(), &ctx).unwrap_err(),
            AdapterError::PrivateTorrentRejected
        );
        assert_eq!(
            plan(
                &TaskIntent::Manual {
                    argv: vec!["private.torrent".into()]
                },
                &Aria2Ctx::default()
            )
            .unwrap_err(),
            AdapterError::ManualUnsupported
        );
        let argv = build_argv(&form(), &Aria2Ctx::default());
        assert!(argv.contains(&"--follow-torrent=false".into()));
        assert!(argv.contains(&"--follow-metalink=false".into()));
    }

    #[test]
    fn downloads_respect_seed_and_discovery_settings() {
        for torrent_file in ["", "local.torrent"] {
            let intent = Aria2Intent {
                torrent_file: torrent_file.into(),
                uri: "https://example.com/download.php?id=1".into(),
                seed_after_download: false,
                dht: false,
                peer_exchange: false,
                ..Default::default()
            };
            let argv = plan_form(&intent, &Aria2Ctx::default()).unwrap().argv;
            let seed = argv.iter().position(|a| a == "--seed-time").unwrap();
            assert_eq!(argv[seed + 1], "0");
            assert!(!argv.contains(&"--seed-ratio".into()));
            assert!(argv.contains(&"--enable-dht=false".into()));
            assert!(argv.contains(&"--enable-dht6=false".into()));
            assert!(argv.contains(&"--enable-peer-exchange=false".into()));
            assert!(!argv.contains(&"--bt-tracker".into()));
        }
    }

    #[test]
    fn empty_input_is_rejected() {
        let intent = Aria2Intent::default();
        let error = plan_form(&intent, &Aria2Ctx::default()).unwrap_err();
        assert_eq!(error, AdapterError::MissingUri);
    }

    #[test]
    fn sensitive_flags_are_redacted() {
        let mut intent = form();
        intent.all_proxy = "http://user:pass@proxy:8080".into();
        intent.header = "Authorization: Bearer token".into();
        let plan = plan_form(&intent, &Aria2Ctx::default()).unwrap();
        assert!(plan
            .argv
            .contains(&"http://user:pass@proxy:8080".to_string()));
        assert!(!plan
            .argv_redacted
            .contains(&"http://user:pass@proxy:8080".to_string()));
        assert!(plan.argv_redacted.contains(&"--all-proxy".to_string()));
        assert!(plan
            .argv_redacted
            .iter()
            .any(|arg| arg.contains("proxy:8080")));
        assert!(!plan
            .argv_redacted
            .iter()
            .any(|a| a.contains("Bearer token")));
    }

    #[test]
    fn parse_progress_reads_console_readout() {
        let progress =
            parse_progress("[#a1b2c3 10MiB/100MiB(10%) CN:4 DL:2.5MiB ETA:35s]").unwrap();
        assert_eq!(progress.percent, Some(10.0));
        assert!(progress.detail.unwrap().contains("10MiB / 100MiB"));
        let starting = parse_progress("[#a1b2c3 1MiB/279MiB(0%) CN:4 DL:1MiB]").unwrap();
        assert_eq!(starting.percent, Some(0.0));
    }

    #[test]
    fn parse_progress_takes_last_carriage_return_segment() {
        let progress = parse_progress("\r[#a 1MiB/2MiB(50%) CN:1]\r[#a 2MiB/2MiB(100%)]").unwrap();
        assert_eq!(progress.percent, Some(100.0));
    }

    #[test]
    fn parse_progress_recognizes_metadata_and_seeding() {
        let metadata = parse_progress("FILE: [MEMORY][METADATA]ac19fa07").unwrap();
        assert_eq!(metadata.percent, None);
        assert!(metadata.detail.is_some());
        let seeding = parse_progress("[#e4e639 SEED(0.0) CN:44 SD:4 UL:80KiB(2.2MiB)]").unwrap();
        assert_eq!(seeding.percent, Some(100.0));
        assert!(seeding.detail.is_some());
        let seeding_without_upload = parse_progress("[#448811 SEED(0.0) CN:41 SD:5]").unwrap();
        assert_eq!(seeding_without_upload.percent, Some(100.0));
        assert_eq!(seeding_without_upload.detail, seeding.detail);
        assert!(parse_progress("[#a 0B/0B CN:0 SD:0 DL:0B]").is_none());
        assert!(parse_progress("Download complete: /tmp/x").is_none());
        assert!(parse_progress("Download Results:").is_none());
    }

    #[test]
    fn positional_source_is_separated_by_double_dash() {
        // URI 以 '-' 开头时不得被 aria2 当成选项（-- 结束选项解析）
        let mut intent = form();
        intent.uri = "--enable-rpc=true".into();
        let argv = build_argv(&intent, &Aria2Ctx::default());
        let last = argv.last().unwrap();
        assert_eq!(last, "--enable-rpc=true");
        assert_eq!(argv[argv.len() - 2], "--");
    }

    #[test]
    fn output_directory_is_cwd_only_not_explicit_dir() {
        // 相对输出目录不能同时进 cwd 和 --dir，否则 aria2 按 cwd 再解析一次（dir/dir）
        let mut intent = form();
        intent.output_directory = "downloads".into();
        let plan = plan_form(&intent, &Aria2Ctx::default()).unwrap();
        assert!(!plan.argv.contains(&"--dir".to_string()));
        assert_eq!(plan.cwd, CwdPolicy::Explicit("downloads".into()));
        assert_eq!(plan.output_paths, vec!["downloads".to_string()]);
    }

    #[test]
    fn tracker_lookup_supports_magnets_remote_and_local_torrents() {
        let mut intent = form();
        let mut ctx = Aria2Ctx {
            trackers: vec!["udp://public.invalid/announce".into()],
            ..Default::default()
        };
        for uri in [
            "https://example.com/file.torrent",
            "magnet:?xt=urn:btih:ABC",
        ] {
            intent.uri = uri.into();
            assert!(needs_trackers(
                &TaskIntent::Form(serde_json::to_value(&intent).unwrap()),
                &ctx
            ));
            assert!(build_argv(&intent, &ctx).contains(&"--bt-tracker".into()));
        }
        intent.torrent_file = "public.torrent".into();
        assert!(needs_trackers(
            &TaskIntent::Form(serde_json::to_value(&intent).unwrap()),
            &ctx
        ));
        ctx.private_torrent = Some(false);
        assert!(needs_trackers(
            &TaskIntent::Form(serde_json::to_value(&intent).unwrap()),
            &ctx
        ));
        intent.inject_trackers = false;
        assert!(!needs_trackers(
            &TaskIntent::Form(serde_json::to_value(&intent).unwrap()),
            &ctx
        ));
        assert!(!build_argv(&intent, &ctx).contains(&"--bt-tracker".into()));
        intent.inject_trackers = true;
        assert!(!needs_trackers(
            &TaskIntent::Manual {
                argv: vec!["--version".into()]
            },
            &ctx
        ));
    }

    #[test]
    fn credentials_never_enter_persisted_intent_title_or_argv() {
        for uri in [
            "https://user:REVIEW_SECRET@example.com/download?passkey=REVIEW_SECRET",
            "https://example.com/announce?passkey=REVIEW_SECRET",
            "magnet:?xt=urn:btih:0123456789012345678901234567890123456789&tr=https%3A%2F%2Fexample.com%2Fannounce%3Fpasskey%3DREVIEW_SECRET",
        ] {
            let intent = Aria2Intent { uri: uri.into(), referer: uri.into(), ..Default::default() };
            let plan = plan_form(&intent, &Aria2Ctx::default()).unwrap();
            assert!(!plan.title.contains("REVIEW_SECRET"));
            assert!(!plan.argv_redacted.join(" ").contains("REVIEW_SECRET"));
            assert!(plan.argv.join(" ").contains("REVIEW_SECRET"));
            let saved = sanitize_intent(&TaskIntent::Form(serde_json::to_value(&intent).unwrap()));
            assert!(!serde_json::to_string(&saved).unwrap().contains("REVIEW_SECRET"));
            let saved = sanitize_intent(&TaskIntent::Manual { argv: vec![uri.into()] });
            assert!(!serde_json::to_string(&saved).unwrap().contains("REVIEW_SECRET"));
        }
    }

    #[test]
    fn ordinary_configuration_survives_preview_and_persistence() {
        for uri in [
            "https://example.com/file.torrent?id=42",
            "magnet:?xt=urn:btih:0123456789012345678901234567890123456789&dn=example",
        ] {
            let intent = Aria2Intent {
                uri: uri.into(),
                all_proxy: "http://127.0.0.1:7890".into(),
                header: "Accept: application/octet-stream\nAuthorization: Bearer SECRET\nX-Client: toolbox".into(),
                split: 12,
                ..Default::default()
            };
            let plan = plan_form(&intent, &Aria2Ctx::default()).unwrap();
            assert_eq!(plan.argv_redacted.len(), plan.argv.len());
            assert_eq!(plan.argv_redacted.last().unwrap(), uri);
            assert!(plan.argv_redacted.contains(&intent.all_proxy));
            assert!(plan.argv_redacted.contains(&"12".into()));
            let TaskIntent::Form(saved) =
                sanitize_intent(&TaskIntent::Form(serde_json::to_value(&intent).unwrap()))
            else {
                panic!("expected form")
            };
            assert_eq!(saved["uri"], uri);
            assert_eq!(saved["allProxy"], intent.all_proxy);
            assert_eq!(saved["split"], 12);
            assert_eq!(
                saved["header"],
                "Accept: application/octet-stream\nAuthorization: ***\nX-Client: toolbox"
            );
        }
    }
}
