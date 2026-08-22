//! media（FFmpeg）adapter：意图 → argv 纯函数。
//! 移植自旧前端 buildFfmpegArgs + outputPath（src/pages/MediaPage.tsx / src/lib/commands.ts），
//! 以及旧后端 run_pr_compatible 的参数编排（探测由 commands 层完成，此处保持纯函数）。
//! media 无敏感参数：argv_redacted == argv。

use super::types::{MediaIntent, Operation};
use crate::core::adapter::AdapterPlan;
use crate::core::task::types::{CwdPolicy, Pool, TaskIntent};

use super::policy;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq)]
pub enum AdapterError {
    MissingInput,
    InvalidIntent(String),
    EmptyArgv,
}

impl std::fmt::Display for AdapterError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AdapterError::MissingInput => {
                write!(f, "{}", rust_i18n::t!("backend.media.adapter.missingInput"))
            }
            AdapterError::InvalidIntent(e) => write!(
                f,
                "{}",
                rust_i18n::t!("backend.media.adapter.invalidIntent", error = e)
            ),
            AdapterError::EmptyArgv => {
                write!(f, "{}", rust_i18n::t!("backend.media.adapter.emptyArgv"))
            }
        }
    }
}

/// commands 层解析好的运行时上下文。
#[derive(Debug, Clone, Default)]
pub struct MediaCtx {
    /// copy + 滤镜冲突时的兜底视频编码器（从 ffmpeg -encoders 探测，优先 libx264 系）。
    pub encoder_fallback: Option<String>,
}

pub fn plan(intent: &TaskIntent, ctx: &MediaCtx) -> Result<AdapterPlan, AdapterError> {
    match intent {
        TaskIntent::Form(data) => {
            let form: MediaIntent = serde_json::from_value(data.clone())
                .map_err(|e| AdapterError::InvalidIntent(e.to_string()))?;
            plan_form(&form, ctx)
        }
        TaskIntent::Manual { argv } => {
            if argv.iter().all(|a| a.trim().is_empty()) {
                return Err(AdapterError::EmptyArgv);
            }
            let argv = argv.to_vec();
            Ok(AdapterPlan {
                tool: "ffmpeg",
                title: rust_i18n::t!("backend.media.adapter.manualCommandTitle").to_string(),
                argv_redacted: argv.clone(),
                argv,
                pool: Pool::Local,
                cwd: CwdPolicy::Inherit,
                output_paths: Vec::new(),
            })
        }
    }
}

fn plan_form(form: &MediaIntent, ctx: &MediaCtx) -> Result<AdapterPlan, AdapterError> {
    let input = form.input.trim();
    if input.is_empty() {
        return Err(AdapterError::MissingInput);
    }
    let output = output_path(input, form);
    let argv = build_argv(input, &output, form, ctx);
    let file_name = Path::new(input)
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| input.to_string());
    let output_paths = if form.operation == Operation::Frames {
        // 抽帧输出是 %06d 序列模板而非真实文件，锚定到输出目录
        Path::new(&output)
            .parent()
            .map(|p| vec![p.to_string_lossy().into_owned()])
            .unwrap_or_default()
    } else {
        vec![output.clone()]
    };
    Ok(AdapterPlan {
        tool: "ffmpeg",
        title: format!("{} {}", operation_verb(form.operation), file_name),
        argv_redacted: argv.clone(), // media 无敏感参数
        argv,
        pool: Pool::Local,
        cwd: CwdPolicy::Inherit,
        output_paths,
    })
}

fn operation_verb(operation: Operation) -> String {
    match operation {
        Operation::Remux => rust_i18n::t!("backend.media.operation.remux").to_string(),
        Operation::Transcode => rust_i18n::t!("backend.media.operation.transcode").to_string(),
        Operation::VideoExtract => {
            rust_i18n::t!("backend.media.operation.videoExtract").to_string()
        }
        Operation::Audio => rust_i18n::t!("backend.media.operation.audio").to_string(),
        Operation::SubtitleExtract => {
            rust_i18n::t!("backend.media.operation.subtitleExtract").to_string()
        }
        Operation::Thumbnail => rust_i18n::t!("backend.media.operation.thumbnail").to_string(),
        Operation::Gif => rust_i18n::t!("backend.media.operation.gif").to_string(),
        Operation::Frames => rust_i18n::t!("backend.media.operation.frames").to_string(),
    }
}

/// 输出路径规则（移植自旧前端 outputPath）：`<目录><sep><原名>.mad.<扩展名>`，
/// 抽帧为 `.mad.%06d.png`。
pub fn output_path(input: &str, form: &MediaIntent) -> String {
    let sep = if input.contains('\\') { '\\' } else { '/' };
    let (directory, file) = match input.rfind(sep) {
        Some(pos) => (&input[..pos], &input[pos + 1..]),
        None => (".", input),
    };
    let base = match file.rfind('.') {
        Some(pos) if pos > 0 => &file[..pos],
        _ => file,
    };
    let output_directory = if form.output_directory.trim().is_empty() {
        directory
    } else {
        form.output_directory.trim()
    };
    let extension = match form.operation {
        Operation::Thumbnail => "jpg",
        Operation::Gif => "gif",
        Operation::Frames => "png",
        _ => form.container.as_str(),
    };
    let suffix = if form.operation == Operation::Frames {
        ".mad.%06d"
    } else {
        ".mad"
    };
    format!("{output_directory}{sep}{base}{suffix}.{extension}")
}

/// 音频提取时的容器兼容编码器归一（移植自旧前端 audioCodecForOutput）。
fn audio_codec_for_output(operation: Operation, container: &str, audio_codec: &str) -> String {
    if operation != Operation::Audio {
        return audio_codec.to_string();
    }
    match container {
        "m4a" => "aac".into(),
        "wav" | "aiff" => {
            if ["pcm_s16le", "pcm_s24le"].contains(&audio_codec) {
                audio_codec.into()
            } else {
                "pcm_s24le".into()
            }
        }
        "flac" => "flac".into(),
        "ogg" => "opus".into(),
        _ => audio_codec.into(),
    }
}

fn build_argv(input: &str, output: &str, form: &MediaIntent, ctx: &MediaCtx) -> Vec<String> {
    let mut args: Vec<String> = Vec::new();
    let mut push = |values: &[&str]| {
        for v in values {
            args.push((*v).to_string());
        }
    };

    // 过滤冗余输出：banner/stats 是纯噪声，日志只留 warning 及以上
    push(&["-hide_banner", "-nostats", "-loglevel", "warning"]);
    push(&[if form.overwrite { "-y" } else { "-n" }]);
    let start_time = form.start_time.trim();
    if !start_time.is_empty() {
        push(&["-ss", start_time]);
    }
    push(&["-i", input]);
    let duration = form.duration.trim();
    if !duration.is_empty() {
        push(&["-t", duration]);
    }
    if form.map_all {
        if matches!(form.operation, Operation::Remux | Operation::Transcode) {
            push(&["-map", "0"]);
        }
        if matches!(
            form.operation,
            Operation::Thumbnail | Operation::Gif | Operation::Frames
        ) {
            push(&["-map", "0:v:0"]);
        }
    }
    match form.operation {
        Operation::Audio => {
            let idx = form.audio_stream_index.trim();
            args.push("-map".into());
            args.push(format!("0:a:{}", if idx.is_empty() { "0" } else { idx }));
        }
        Operation::VideoExtract => {
            let idx = form.video_stream_index.trim();
            args.push("-map".into());
            args.push(format!("0:v:{}", if idx.is_empty() { "0" } else { idx }));
        }
        Operation::SubtitleExtract => {
            let idx = form.subtitle_stream_index.trim();
            args.push("-map".into());
            args.push(format!("0:s:{}", if idx.is_empty() { "0" } else { idx }));
        }
        _ => {}
    }
    if form.preserve_metadata
        && !matches!(
            form.operation,
            Operation::VideoExtract | Operation::SubtitleExtract
        )
    {
        args.extend(["-map_metadata", "0", "-map_chapters", "0"].map(String::from));
    }

    // 滤镜链
    let mut video_filters: Vec<String> = Vec::new();
    let mut audio_filters: Vec<String> = Vec::new();
    if form.deinterlace {
        video_filters.push("yadif".into());
    }
    let crop = form.crop.trim();
    if !crop.is_empty() {
        video_filters.push(format!("crop={crop}"));
    }
    let width = form.width.trim();
    let height = form.height.trim();
    if !width.is_empty() || !height.is_empty() {
        video_filters.push(format!(
            "scale={}:{}:flags={}",
            if width.is_empty() { "-2" } else { width },
            if height.is_empty() { "-2" } else { height },
            form.scaling_algorithm
        ));
    }
    let frame_rate = form.frame_rate.trim();
    if !frame_rate.is_empty() {
        video_filters.push(format!("fps={frame_rate}"));
    }
    match form.rotation.as_str() {
        "90cw" => video_filters.push("transpose=clock".into()),
        "90ccw" => video_filters.push("transpose=cclock".into()),
        "180" => {
            video_filters.push("hflip".into());
            video_filters.push("vflip".into());
        }
        _ => {}
    }
    if form.flip_horizontal {
        video_filters.push("hflip".into());
    }
    if form.flip_vertical {
        video_filters.push("vflip".into());
    }
    let aspect = form.aspect_ratio.trim();
    if !aspect.is_empty() {
        video_filters.push(format!("setdar={aspect}"));
    }
    if form.speed != 1.0 {
        video_filters.push(format!("setpts={:.6}*PTS", 1.0 / form.speed));
        audio_filters.push(format!("atempo={:.3}", form.speed));
    }
    let volume = form.volume.trim();
    if !volume.is_empty() {
        audio_filters.push(format!("volume={volume}"));
    }
    if form.loudness_normalization {
        audio_filters.push("loudnorm=I=-16:LRA=11:TP=-1.5".into());
    }

    let must_encode_audio = !audio_filters.is_empty()
        || !form.sample_rate.trim().is_empty()
        || !form.channels.trim().is_empty();
    let mut resolved_audio_codec: Option<String> = None;

    match form.operation {
        Operation::Thumbnail => {
            if !video_filters.is_empty() {
                args.push("-vf".into());
                args.push(video_filters.join(","));
            }
            args.extend(["-frames:v", "1", "-q:v", "2"].map(String::from));
        }
        Operation::Gif => {
            args.push("-vf".into());
            args.push(format!(
                "fps={},scale={}:-2:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse",
                form.gif_fps, form.gif_width
            ));
            args.extend(["-loop", "0", "-an"].map(String::from));
        }
        Operation::Frames => {
            if !video_filters.is_empty() {
                args.push("-vf".into());
                args.push(video_filters.join(","));
            }
            args.extend(["-fps_mode", "passthrough", "-an"].map(String::from));
        }
        Operation::VideoExtract => {
            args.extend(["-c:v", "copy", "-an", "-sn"].map(String::from));
        }
        Operation::SubtitleExtract => {
            let codec = match form.container.as_str() {
                "srt" => "srt",
                "ass" => "ass",
                _ => "copy",
            };
            args.extend(["-vn", "-an", "-c:s", codec].map(String::from));
        }
        Operation::Audio => {
            let audio_codec = if form.audio_codec == "copy" && must_encode_audio {
                "aac".to_string()
            } else {
                audio_codec_for_output(form.operation, &form.container, &form.audio_codec)
            };
            args.push("-vn".into());
            args.push("-c:a".into());
            args.push(audio_codec.clone());
            if audio_codec == "opus" {
                args.extend(["-strict", "-2"].map(String::from));
            }
            if !audio_filters.is_empty() {
                args.push("-af".into());
                args.push(audio_filters.join(","));
            }
            resolved_audio_codec = Some(audio_codec);
        }
        Operation::Remux | Operation::Transcode => {
            let must_encode_video = !video_filters.is_empty();
            let video_codec = if form.video_codec == "copy" && must_encode_video {
                ctx.encoder_fallback
                    .clone()
                    .unwrap_or_else(|| "h264_videotoolbox".into())
            } else {
                form.video_codec.clone()
            };
            let audio_codec = if form.audio_codec == "copy" && must_encode_audio {
                "aac".to_string()
            } else {
                form.audio_codec.clone()
            };
            args.push("-c:v".into());
            args.push(video_codec.clone());
            args.push("-c:a".into());
            args.push(audio_codec.clone());
            if audio_codec == "opus" {
                args.extend(["-strict", "-2"].map(String::from));
            }
            if form.operation == Operation::Remux {
                let sub_codec = if ["mp4", "mov"].contains(&form.container.as_str()) {
                    "mov_text"
                } else {
                    "copy"
                };
                args.extend(["-c:s", sub_codec, "-c:d", "copy"].map(String::from));
            } else if form.map_all && ["mp4", "mov"].contains(&form.container.as_str()) {
                // MP4/MOV 无 SubRip/ASS 自动编码器：保留全部流时把文本字幕转 mov_text
                args.extend(["-c:s", "mov_text"].map(String::from));
            }
            if !video_filters.is_empty() {
                args.push("-vf".into());
                args.push(video_filters.join(","));
            }
            if !audio_filters.is_empty() {
                args.push("-af".into());
                args.push(audio_filters.join(","));
            }
            if video_codec == "prores_ks" {
                args.extend(["-profile:v", "2"].map(String::from));
            }
            if video_codec.contains("videotoolbox") {
                args.extend(["-allow_sw", "1"].map(String::from));
            }
            if video_codec != "copy" {
                let bitrate = form.video_bitrate.trim();
                if !bitrate.is_empty() {
                    args.push("-b:v".into());
                    args.push(bitrate.into());
                }
                let crf = form.crf.trim();
                if !crf.is_empty()
                    && ["libx264", "libx265", "libvpx-vp9", "libsvtav1"]
                        .contains(&video_codec.as_str())
                {
                    args.push("-crf".into());
                    args.push(crf.into());
                }
                let preset = form.preset.trim();
                if !preset.is_empty()
                    && ["libx264", "libx265", "libsvtav1"].contains(&video_codec.as_str())
                {
                    args.push("-preset".into());
                    args.push(preset.into());
                }
                let profile = form.video_profile.trim();
                if !profile.is_empty() && ["libx264", "libx265"].contains(&video_codec.as_str()) {
                    args.push("-profile:v".into());
                    args.push(profile.into());
                }
                let pix_fmt = form.pixel_format.trim();
                if !pix_fmt.is_empty() {
                    args.push("-pix_fmt".into());
                    args.push(pix_fmt.into());
                }
            }
            if form.fast_start && ["mp4", "mov", "m4a"].contains(&form.container.as_str()) {
                args.extend(["-movflags", "+faststart"].map(String::from));
            }
            resolved_audio_codec = Some(audio_codec);
        }
    }

    if !matches!(
        form.operation,
        Operation::Thumbnail | Operation::Gif | Operation::Frames
    ) {
        let audio_bitrate = form.audio_bitrate.trim();
        if !audio_bitrate.is_empty() && resolved_audio_codec.as_deref().is_some_and(|c| c != "copy")
        {
            args.push("-b:a".into());
            args.push(audio_bitrate.into());
        }
        let sample_rate = form.sample_rate.trim();
        if !sample_rate.is_empty() {
            args.push("-ar".into());
            args.push(sample_rate.into());
        }
        let channels = form.channels.trim();
        if !channels.is_empty() {
            args.push("-ac".into());
            args.push(channels.into());
        }
    }

    args.push(output.to_string());
    args
}

// ---- PR 兼容编排（移植自旧后端 run_pr_compatible 的参数决策，探测由 commands 层完成） ----

#[derive(Debug, Clone, Default)]
pub struct PrProbe {
    pub video: Vec<String>,
    pub audio: Vec<String>,
    pub subtitles: Vec<String>,
}

/// 单文件的 PR 兼容转码计划。返回 (计划, 输出路径)。
pub fn pr_plan(
    input: &Path,
    probe: &PrProbe,
    output_directory: Option<&str>,
) -> Result<(AdapterPlan, PathBuf), String> {
    let audio_only = probe.video.is_empty() && !probe.audio.is_empty();
    let subtitle_only =
        probe.video.is_empty() && probe.audio.is_empty() && !probe.subtitles.is_empty();
    if probe.video.is_empty() && probe.audio.is_empty() && probe.subtitles.is_empty() {
        return Err(rust_i18n::t!(
            "backend.media.adapter.prNoStreams",
            path = input.to_string_lossy()
        )
        .to_string());
    }
    if subtitle_only
        && probe.subtitles.iter().any(|codec| {
            ["hdmv_pgs_subtitle", "dvd_subtitle", "dvb_subtitle", "xsub"].contains(&codec.as_str())
        })
    {
        return Err(rust_i18n::t!(
            "backend.media.adapter.prImageSubtitle",
            path = input.to_string_lossy()
        )
        .to_string());
    }

    let lossless_audio = audio_only && policy::is_lossless_audio(&probe.audio);
    let mov_video_copy = probe.video.iter().all(|codec| {
        ["h264", "hevc", "prores", "dnxhd", "dvvideo", "mpeg2video"].contains(&codec.as_str())
    });
    let mov_audio_copy = probe.audio.iter().all(|codec| {
        [
            "aac",
            "mp3",
            "pcm_s16le",
            "pcm_s24le",
            "pcm_s32le",
            "pcm_f32le",
        ]
        .contains(&codec.as_str())
    });
    let mp4_audio_copy = probe
        .audio
        .iter()
        .all(|codec| ["aac", "mp3"].contains(&codec.as_str()));
    let container = if subtitle_only {
        "srt"
    } else if audio_only {
        policy::audio_container(&probe.audio)
    } else {
        policy::container(&probe.video, false)
    };
    let output = policy::output_path(input, output_directory, container);

    let mut args: Vec<String> = vec![
        "-hide_banner".into(),
        "-nostats".into(),
        "-loglevel".into(),
        "warning".into(),
        "-n".into(),
        "-i".into(),
        input.to_string_lossy().into_owned(),
    ];
    if subtitle_only {
        args.extend(["-map", "0:s:0", "-c:s", "srt"].map(String::from));
    } else if audio_only {
        args.extend(["-map", "0:a", "-vn"].map(String::from));
        if lossless_audio {
            args.extend(["-c:a", "pcm_s24le"].map(String::from));
        } else if container == "mp3" || probe.audio.iter().all(|codec| codec == "aac") {
            args.extend(["-c:a", "copy"].map(String::from));
        } else {
            args.extend(["-c:a", "aac", "-b:a", "320k"].map(String::from));
        }
    } else {
        args.extend(
            [
                "-map",
                "0:V:0?",
                "-map",
                "0:a?",
                "-map_metadata",
                "0",
                "-map_chapters",
                "0",
            ]
            .map(String::from),
        );
    }
    if !audio_only && !subtitle_only && container == "mp4" {
        args.extend(["-c:v", "copy"].map(String::from));
        if mp4_audio_copy {
            args.extend(["-c:a", "copy"].map(String::from));
        } else {
            args.extend(["-c:a", "aac", "-b:a", "320k"].map(String::from));
        }
        if probe.video.iter().any(|codec| codec == "hevc") {
            args.extend(["-tag:v", "hvc1"].map(String::from));
        }
        args.extend(["-movflags", "+faststart"].map(String::from));
    } else if !audio_only && !subtitle_only && mov_video_copy {
        args.extend(["-c:v", "copy"].map(String::from));
        args.push("-c:a".into());
        args.push(if mov_audio_copy { "copy" } else { "pcm_s24le" }.into());
    } else if !audio_only && !subtitle_only {
        args.extend(
            [
                "-c:v",
                "prores_ks",
                "-profile:v",
                "2",
                "-pix_fmt",
                "yuv422p10le",
                "-c:a",
                "pcm_s24le",
            ]
            .map(String::from),
        );
    }
    args.push(output.to_string_lossy().into_owned());

    let file_name = input
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| input.to_string_lossy().into_owned());
    let plan = AdapterPlan {
        tool: "ffmpeg",
        title: rust_i18n::t!("backend.media.adapter.prTitle", file = file_name).to_string(),
        argv_redacted: args.clone(),
        argv: args,
        pool: Pool::Local,
        cwd: CwdPolicy::Inherit,
        output_paths: vec![output.to_string_lossy().into_owned()],
    };
    Ok((plan, output))
}
