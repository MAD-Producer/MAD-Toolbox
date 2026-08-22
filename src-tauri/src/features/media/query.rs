//! MediaInfo/ffprobe 即时查询与媒体输入展开。

use std::{
    collections::HashMap,
    fmt::Write as _,
    path::{Path, PathBuf},
    process::Output,
};

use serde::Serialize;
use tauri::AppHandle;
use tokio::{
    process::Command,
    sync::Semaphore,
    time::{timeout, Duration},
};

use crate::core::deps::{background_command, command_path, resolve_tool, ToolName};

const PROCESS_QUERY_CONCURRENCY: usize = 4;
const PROCESS_QUERY_TIMEOUT_SECONDS: u64 = 30;
const PROCESS_QUERY_TIMEOUT: Duration = Duration::from_secs(PROCESS_QUERY_TIMEOUT_SECONDS);
static PROCESS_QUERY_GATE: Semaphore = Semaphore::const_new(PROCESS_QUERY_CONCURRENCY);

#[derive(Serialize)]
pub(crate) struct MediaInspection {
    path: String,
    summary: String,
}

async fn run_external_query(mut command: Command, operation: &str) -> Result<Output, String> {
    let _permit = PROCESS_QUERY_GATE
        .acquire()
        .await
        .map_err(|_| rust_i18n::t!("backend.media.query.concurrencyClosed").to_string())?;
    command.kill_on_drop(true);
    timeout(PROCESS_QUERY_TIMEOUT, command.output())
        .await
        .map_err(|_| {
            rust_i18n::t!(
                "backend.media.query.timeout",
                operation = operation,
                seconds = PROCESS_QUERY_TIMEOUT_SECONDS
            )
            .to_string()
        })?
        .map_err(|error| {
            rust_i18n::t!(
                "backend.media.query.launchFailed",
                operation = operation,
                error = error
            )
            .to_string()
        })
}

fn media_info_value<'a>(track: &'a serde_json::Value, key: &str) -> Option<&'a str> {
    track
        .get(key)
        .and_then(|value| value.as_str())
        .filter(|value| !value.is_empty())
}

fn media_info_number(track: &serde_json::Value, key: &str) -> Option<f64> {
    track.get(key).and_then(|value| {
        value
            .as_f64()
            .or_else(|| value.as_str().and_then(|text| text.parse::<f64>().ok()))
    })
}

fn human_duration(seconds: f64) -> String {
    let total = seconds.max(0.0).round() as u64;
    let hours = total / 3600;
    let minutes = (total % 3600) / 60;
    let seconds = total % 60;
    if hours > 0 {
        format!("{hours:02}:{minutes:02}:{seconds:02}")
    } else {
        format!("{minutes:02}:{seconds:02}")
    }
}

fn media_info_summary(document: &serde_json::Value, path: &str) -> Result<String, String> {
    let tracks = document
        .pointer("/media/track")
        .and_then(|value| value.as_array())
        .ok_or_else(|| rust_i18n::t!("backend.media.query.missingTracks").to_string())?;
    let mut summary = String::new();
    writeln!(summary, "{}", rust_i18n::t!("backend.media.inspect.fileInfo")).unwrap();
    writeln!(summary, "{}", rust_i18n::t!("backend.media.inspect.path", path = path)).unwrap();

    if let Some(general) = tracks
        .iter()
        .find(|track| media_info_value(track, "@type") == Some("General"))
    {
        if let Some(format) = media_info_value(general, "Format") {
            writeln!(
                summary,
                "{}",
                rust_i18n::t!("backend.media.inspect.containerFormat", format = format)
            )
            .unwrap();
        }
        if let Some(profile) = media_info_value(general, "Format_Profile") {
            writeln!(
                summary,
                "{}",
                rust_i18n::t!("backend.media.inspect.formatProfile", profile = profile)
            )
            .unwrap();
        }
        if let Some(size) = media_info_number(general, "FileSize") {
            let size_text = format!("{:.2} MiB", size / 1_048_576.0);
            writeln!(summary, "{}", rust_i18n::t!("backend.media.inspect.fileSize", size = size_text)).unwrap();
        }
        if let Some(duration) = media_info_number(general, "Duration") {
            writeln!(
                summary,
                "{}",
                rust_i18n::t!("backend.media.inspect.duration", value = human_duration(duration))
            )
            .unwrap();
        }
        if let Some(bitrate) = media_info_number(general, "OverallBitRate") {
            let bitrate_text = format!("{:.0} kb/s", bitrate / 1000.0);
            writeln!(summary, "{}", rust_i18n::t!("backend.media.inspect.overallBitrate", value = bitrate_text)).unwrap();
        }
        if let Some(title) = media_info_value(general, "Title") {
            writeln!(summary, "{}", rust_i18n::t!("backend.media.inspect.title", title = title)).unwrap();
        }
        if let Some(performer) = media_info_value(general, "Performer") {
            writeln!(summary, "{}", rust_i18n::t!("backend.media.inspect.performer", performer = performer)).unwrap();
        }
    }

    let mut counters: HashMap<&str, usize> = HashMap::new();
    for track in tracks {
        let kind = media_info_value(track, "@type").unwrap_or("Other");
        if kind == "General" {
            continue;
        }
        let counter = counters.entry(kind).or_insert(0);
        *counter += 1;
        let localized = match kind {
            "Video" => rust_i18n::t!("backend.media.inspect.trackVideo"),
            "Audio" => rust_i18n::t!("backend.media.inspect.trackAudio"),
            "Text" => rust_i18n::t!("backend.media.inspect.trackSubtitle"),
            "Image" => rust_i18n::t!("backend.media.inspect.trackImage"),
            "Menu" => rust_i18n::t!("backend.media.inspect.trackMenu"),
            _ => rust_i18n::t!("backend.media.inspect.trackOther"),
        };
        writeln!(summary, "\n{localized} {}", *counter).unwrap();
        if let Some(format) = media_info_value(track, "Format") {
            let profile = media_info_value(track, "Format_Profile")
                .map(|value| format!(" / {value}"))
                .unwrap_or_default();
            writeln!(
                summary,
                "{}",
                rust_i18n::t!("backend.media.inspect.codecFormat", format = format, profile = profile)
            )
            .unwrap();
        }
        if let Some(codec) = media_info_value(track, "CodecID") {
            writeln!(summary, "{}", rust_i18n::t!("backend.media.inspect.codecId", codec = codec)).unwrap();
        }
        if let (Some(width), Some(height)) = (
            media_info_number(track, "Width"),
            media_info_number(track, "Height"),
        ) {
            writeln!(
                summary,
                "{}",
                rust_i18n::t!(
                    "backend.media.inspect.resolution",
                    width = width as u64,
                    height = height as u64
                )
            )
            .unwrap();
        }
        if let Some(frame_rate) = media_info_number(track, "FrameRate") {
            let frame_rate_text = format!("{:.3} fps", frame_rate);
            writeln!(summary, "{}", rust_i18n::t!("backend.media.inspect.frameRate", value = frame_rate_text)).unwrap();
        }
        if let Some(bitrate) = media_info_number(track, "BitRate") {
            let bitrate_text = format!("{:.0} kb/s", bitrate / 1000.0);
            writeln!(summary, "{}", rust_i18n::t!("backend.media.inspect.bitrate", value = bitrate_text)).unwrap();
        }
        if let Some(bit_depth) = media_info_number(track, "BitDepth") {
            writeln!(
                summary,
                "{}",
                rust_i18n::t!("backend.media.inspect.bitDepth", value = bit_depth as u64)
            )
            .unwrap();
        }
        if let Some(color) = media_info_value(track, "ColorSpace") {
            let chroma = media_info_value(track, "ChromaSubsampling")
                .map(|value| format!(" / {value}"))
                .unwrap_or_default();
            writeln!(
                summary,
                "{}",
                rust_i18n::t!("backend.media.inspect.colorSpace", color = color, chroma = chroma)
            )
            .unwrap();
        }
        if let Some(channels) = media_info_number(track, "Channels") {
            writeln!(
                summary,
                "{}",
                rust_i18n::t!("backend.media.inspect.channels", value = channels as u64)
            )
            .unwrap();
        }
        if let Some(layout) = media_info_value(track, "ChannelLayout") {
            writeln!(
                summary,
                "{}",
                rust_i18n::t!("backend.media.inspect.channelLayout", layout = layout)
            )
            .unwrap();
        }
        if let Some(sample_rate) = media_info_number(track, "SamplingRate") {
            let sample_rate_text = format!("{:.1} kHz", sample_rate / 1000.0);
            writeln!(summary, "{}", rust_i18n::t!("backend.media.inspect.sampleRate", value = sample_rate_text)).unwrap();
        }
        if let Some(language) = media_info_value(track, "Language") {
            writeln!(
                summary,
                "{}",
                rust_i18n::t!("backend.media.inspect.language", language = language)
            )
            .unwrap();
        }
        if let Some(title) = media_info_value(track, "Title") {
            writeln!(
                summary,
                "{}",
                rust_i18n::t!("backend.media.inspect.trackTitle", title = title)
            )
            .unwrap();
        }
    }
    Ok(summary.trim().to_string())
}

#[tauri::command]
pub(crate) async fn inspect_media(app: AppHandle, path: String) -> Result<MediaInspection, String> {
    let input = PathBuf::from(&path);
    if input.is_dir() {
        let count = media_files_in(&input)?.len();
        return Ok(MediaInspection {
            path,
            summary: rust_i18n::t!("backend.media.inspect.directorySummary", count = count).to_string(),
        });
    }
    if !input.is_file() {
        return Err(rust_i18n::t!("backend.media.query.fileNotFound").to_string());
    }
    let (executable, args, use_media_info_json) =
        if let Some((mediainfo, _)) = resolve_tool(&app, &ToolName::Mediainfo) {
            (
                mediainfo,
                vec!["--Output=JSON".to_string(), path.clone()],
                true,
            )
        } else if let Some((ffprobe, _)) = resolve_tool(&app, &ToolName::Ffprobe) {
            (
                ffprobe,
                vec![
                    "-hide_banner".into(),
                    "-of".into(),
                    "json".into(),
                    "-show_format".into(),
                    "-show_streams".into(),
                    path.clone(),
                ],
                false,
            )
        } else {
            return Err(rust_i18n::t!("backend.media.query.toolMissing").to_string());
        };
    let mut command = background_command(executable);
    command.args(args).env("PATH", command_path());
    let output = run_external_query(command, &rust_i18n::t!("backend.media.query.readOperation")).await?;
    if !output.status.success() {
        let reason = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(rust_i18n::t!("backend.media.query.readFailed", reason = reason).to_string());
    }
    let mut summary = String::from_utf8_lossy(&output.stdout).into_owned();
    if summary.trim().is_empty() {
        summary = String::from_utf8_lossy(&output.stderr).into_owned();
    } else if use_media_info_json {
        let document: serde_json::Value = serde_json::from_slice(&output.stdout)
            .map_err(|error| {
                rust_i18n::t!("backend.media.query.parseMediaInfoFailed", error = error).to_string()
            })?;
        summary = media_info_summary(&document, &path)?;
    }
    Ok(MediaInspection { path, summary })
}

pub(crate) fn media_files_in(directory: &Path) -> Result<Vec<PathBuf>, String> {
    const EXTENSIONS: &[&str] = &[
        // Video containers and elementary streams commonly handled by FFmpeg.
        "mp4", "mkv", "mov", "avi", "webm", "flv", "f4v", "m4v", "3gp", "3g2", "asf", "wmv", "vob",
        "ogv", "rm", "rmvb", "divx", "mpg", "mpeg", "mpe", "m1v", "m2v", "ts", "mts", "m2ts",
        "m2t", "mxf", "mod", "tod", "dat", "y4m", "ivf", "roq", "nsv", "nut", "dv", "qt", "ogm",
        "wtv", "dvr-ms", "gxf", "lxf", "evo", "m2p", "ps", "trp", "tp", "amv", "bik", "smk", "swf",
        "mve", "mvi", "svi", "viv", "vivo", "h264", "264", "avc", "h265", "265", "hevc", "av1",
        "vp8", "vp9", "mjpg", "mjpeg",
        // Lossless, lossy and professional audio formats.
        "mp3", "mp2", "mpa", "m4a", "aac", "flac", "wav", "wave", "ogg", "oga", "opus", "aiff",
        "aif", "aifc", "alac", "ape", "wv", "wma", "ac3", "eac3", "dts", "mka", "amr", "au", "snd",
        "caf", "tta", "dsf", "dff", "mlp", "thd", "spx", "ra", "ram", "voc", "gsm", "tak", "shn",
        "xm", "it", "s3m",
        // Text subtitle formats that FFmpeg can normally convert to SubRip.
        "srt", "ass", "ssa", "vtt", "webvtt", "sub", "mpl2", "jss", "rt", "sbv", "smi", "sami",
        "ttml", "dfxp", "lrc",
    ];
    fn visit(directory: &Path, output: &mut Vec<PathBuf>) -> Result<(), String> {
        let entries = std::fs::read_dir(directory).map_err(|error| {
            rust_i18n::t!(
                "backend.media.query.readDirFailed",
                directory = directory.to_string_lossy(),
                error = error
            )
            .to_string()
        })?;
        for entry in entries {
            let entry = entry.map_err(|error| {
                rust_i18n::t!(
                    "backend.media.query.readDirEntryFailed",
                    directory = directory.to_string_lossy(),
                    error = error
                )
                .to_string()
            })?;
            let path = entry.path();
            let hidden = path
                .file_name()
                .and_then(|name| name.to_str())
                .map(|name| name.starts_with('.'))
                .unwrap_or(false);
            if hidden || path.is_symlink() {
                continue;
            }
            if path.is_dir() {
                visit(&path, output)?;
            } else if path
                .extension()
                .and_then(|extension| extension.to_str())
                .map(|extension| EXTENSIONS.contains(&extension.to_ascii_lowercase().as_str()))
                .unwrap_or(false)
            {
                output.push(path);
            }
        }
        Ok(())
    }
    let mut output = Vec::new();
    visit(directory, &mut output)?;
    Ok(output)
}

fn is_text_subtitle_file(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            [
                "srt", "ass", "ssa", "vtt", "webvtt", "sub", "mpl2", "jss", "rt", "sbv", "smi",
                "sami", "ttml", "dfxp", "lrc",
            ]
            .iter()
            .any(|candidate| extension.eq_ignore_ascii_case(candidate))
        })
}

pub(crate) fn expand_media_inputs(
    paths: Vec<String>,
    include_subtitles: Option<bool>,
) -> Result<Vec<String>, String> {
    let include_subtitles = include_subtitles.unwrap_or(false);
    let mut output = Vec::new();
    for value in paths {
        let path = PathBuf::from(value);
        if path.is_dir() {
            output.extend(
                media_files_in(&path)?
                    .into_iter()
                    .filter(|item| include_subtitles || !is_text_subtitle_file(item))
                    .map(|item| item.to_string_lossy().into_owned()),
            );
        } else if path.is_file() {
            if is_text_subtitle_file(&path) && !include_subtitles {
                return Err(
                    rust_i18n::t!("backend.media.query.subtitleHint").to_string(),
                );
            }
            output.push(path.to_string_lossy().into_owned());
        } else {
            return Err(rust_i18n::t!(
                "backend.media.query.inputNotFound",
                path = path.to_string_lossy()
            )
            .to_string());
        }
    }
    output.sort();
    output.dedup();
    Ok(output)
}

pub(crate) async fn probe_streams(
    ffprobe: &Path,
    input: &Path,
) -> Result<(Vec<String>, Vec<String>, Vec<String>), String> {
    let mut command = background_command(ffprobe);
    command
        .args([
            "-v",
            "error",
            "-show_entries",
            "stream=codec_type,codec_name:stream_disposition=attached_pic",
            "-of",
            "json",
        ])
        .arg(input)
        .env("PATH", command_path());
    let operation = rust_i18n::t!(
        "backend.media.query.probeOperation",
        path = input.to_string_lossy()
    )
    .to_string();
    let output = run_external_query(command, &operation).await?;
    if !output.status.success() {
        return Err(rust_i18n::t!(
            "backend.media.query.probeFailed",
            path = input.to_string_lossy(),
            reason = String::from_utf8_lossy(&output.stderr).trim()
        )
        .to_string());
    }
    let value: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|error| {
            rust_i18n::t!("backend.media.query.probeParseFailed", error = error).to_string()
        })?;
    Ok(streams_from_probe(&value))
}

fn streams_from_probe(value: &serde_json::Value) -> (Vec<String>, Vec<String>, Vec<String>) {
    let mut video = Vec::new();
    let mut audio = Vec::new();
    let mut subtitles = Vec::new();
    if let Some(streams) = value["streams"].as_array() {
        for stream in streams {
            let codec_type = stream["codec_type"].as_str().unwrap_or_default();
            let codec = stream["codec_name"]
                .as_str()
                .unwrap_or_default()
                .to_string();
            let attached_picture = stream["disposition"]["attached_pic"].as_i64() == Some(1);
            if codec_type == "video" && !attached_picture && video.is_empty() {
                video.push(codec);
            } else if codec_type == "audio" {
                audio.push(codec);
            } else if codec_type == "subtitle" {
                subtitles.push(codec);
            }
        }
    }
    (video, audio, subtitles)
}
