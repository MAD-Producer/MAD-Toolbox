import type { ToolName } from "./types";

const SECRET_FLAGS = new Set([
  "--cookie",
  "-c",
  "--access-token",
  "-token",
  "--proxy",
  "--username",
  "--password",
  "--video-password",
  "--cookies-from-browser"
]);

export function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function redactProxy(value: string): string {
  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password) {
      parsed.username = "***";
      parsed.password = "***";
      return parsed.toString();
    }
  } catch {
    // Keep non-URL proxy strings visible.
  }
  return value;
}

export function commandPreview(tool: ToolName, args: string[]): string {
  const shown: string[] = [];
  let redactNext = false;

  for (const arg of args) {
    if (redactNext) {
      shown.push(shellQuote("***"));
      redactNext = false;
      continue;
    }
    const secretFlag =
      tool === "musicdl"
        ? ["-i", "--init-music-clients-cfg", "-r", "--requests-overrides"].includes(arg)
        : SECRET_FLAGS.has(arg);
    if (secretFlag) {
      shown.push(arg);
      redactNext = true;
      continue;
    }
    if (arg.startsWith("--proxy=")) {
      shown.push(shellQuote(`--proxy=${redactProxy(arg.slice(8))}`));
      continue;
    }
    shown.push(shellQuote(arg));
  }

  return [tool, ...shown].join(" ");
}

export interface MusicdlCliOptions {
  keyword: string;
  playlistUrl: string;
  musicSources: string[];
  initMusicClientsCfg: Record<string, unknown>;
  requestsOverrides: Record<string, unknown>;
  clientsThreadings: Record<string, unknown>;
  searchRules: Record<string, unknown>;
}

function hasKeys(value: Record<string, unknown>) {
  return Object.keys(value).length > 0;
}

export function buildMusicdlArgs(options: MusicdlCliOptions): string[] {
  const args: string[] = [];
  if (options.keyword.trim()) args.push("-k", options.keyword.trim());
  if (options.playlistUrl.trim()) args.push("-p", options.playlistUrl.trim());
  if (options.musicSources.length) args.push("-m", options.musicSources.join(","));
  if (hasKeys(options.initMusicClientsCfg)) {
    args.push("-i", JSON.stringify(options.initMusicClientsCfg));
  }
  if (hasKeys(options.requestsOverrides)) {
    args.push("-r", JSON.stringify(options.requestsOverrides));
  }
  if (hasKeys(options.clientsThreadings)) {
    args.push("-c", JSON.stringify(options.clientsThreadings));
  }
  if (hasKeys(options.searchRules)) {
    args.push("-s", JSON.stringify(options.searchRules));
  }
  return args;
}

export interface BilibiliOptions {
  url: string;
  mode: "video" | "video-only" | "audio" | "cover" | "subtitle" | "danmaku" | "info";
  api: "web" | "tv" | "app" | "intl";
  pages: string;
  encodingPriority: string;
  qualityPriority: string;
  filePattern: string;
  multiFilePattern: string;
  outputDirectory: string;
  useMp4box: boolean;
  useAria2c: boolean;
  showAll: boolean;
  hideStreams: boolean;
  skipMux: boolean;
  skipSubtitle: boolean;
  skipCover: boolean;
  skipAi: boolean;
  multiThread: boolean;
  forceHttp: boolean;
  downloadDanmaku: boolean;
  videoAscending: boolean;
  audioAscending: boolean;
  allowPcdn: boolean;
  forceReplaceHost: boolean;
  saveArchive: boolean;
  debug: boolean;
  language: string;
  userAgent: string;
  cookie: string;
  accessToken: string;
  aria2cArgs: string;
  mp4boxPath: string;
  aria2cPath: string;
  uposHost: string;
  delayPerPage: string;
  host: string;
  epHost: string;
  area: "" | "hk" | "tw" | "th";
  configFile: string;
  extraArgs: string;
}

export function buildBilibiliArgs(options: BilibiliOptions): string[] {
  const args: string[] = [];
  if (options.url.trim()) args.push(options.url.trim());
  const apiFlags = { web: "", tv: "--use-tv-api", app: "--use-app-api", intl: "--use-intl-api" };
  if (apiFlags[options.api]) args.push(apiFlags[options.api]);

  const modeFlags: Record<BilibiliOptions["mode"], string[]> = {
    video: [],
    "video-only": ["--video-only"],
    audio: ["--audio-only"],
    cover: ["--cover-only"],
    subtitle: ["--sub-only"],
    danmaku: ["--danmaku-only"],
    info: ["--only-show-info"]
  };
  args.push(...modeFlags[options.mode]);

  if (options.pages.trim()) args.push("--select-page", options.pages.trim());
  if (options.encodingPriority.trim()) {
    args.push("--encoding-priority", options.encodingPriority.trim());
  }
  if (options.qualityPriority.trim()) {
    args.push("--dfn-priority", options.qualityPriority.trim());
  }
  if (options.filePattern.trim()) args.push("--file-pattern", options.filePattern.trim());
  if (options.multiFilePattern.trim()) {
    args.push("--multi-file-pattern", options.multiFilePattern.trim());
  }
  if (options.useMp4box) args.push("--use-mp4box");
  if (options.useAria2c) args.push("--use-aria2c");
  if (options.showAll) args.push("--show-all");
  if (options.hideStreams) args.push("--hide-streams");
  if (options.skipMux) args.push("--skip-mux");
  if (options.skipSubtitle) args.push("--skip-subtitle");
  if (options.skipCover) args.push("--skip-cover");
  if (options.skipAi) args.push("--skip-ai");
  if (options.multiThread) args.push("--multi-thread");
  if (options.forceHttp) args.push("--force-http");
  if (options.downloadDanmaku) args.push("--download-danmaku");
  if (options.videoAscending) args.push("--video-ascending");
  if (options.audioAscending) args.push("--audio-ascending");
  if (options.allowPcdn) args.push("--allow-pcdn");
  if (options.forceReplaceHost) args.push("--force-replace-host");
  if (options.saveArchive) args.push("--save-archives-to-file");
  if (options.debug) args.push("--debug");
  const values: Array<[string, string]> = [
    ["--language", options.language],
    ["--user-agent", options.userAgent],
    ["--cookie", options.cookie],
    ["--access-token", options.accessToken],
    ["--aria2c-args", options.aria2cArgs],
    ["--mp4box-path", options.mp4boxPath],
    ["--aria2c-path", options.aria2cPath],
    ["--upos-host", options.uposHost],
    ["--delay-per-page", options.delayPerPage],
    ["--host", options.host],
    ["--ep-host", options.epHost],
    ["--area", options.area],
    ["--config-file", options.configFile],
    ["--work-dir", options.outputDirectory]
  ];
  for (const [flag, value] of values) {
    if (value.trim()) args.push(flag, value.trim());
  }
  for (const line of options.extraArgs.split(/\r?\n/)) {
    if (line.trim()) args.push(line.trim());
  }
  return args;
}

export interface YtDlpOptions {
  url: string;
  mode: "video" | "audio" | "thumbnail" | "subtitles" | "formats" | "metadata";
  outputTemplate: string;
  outputDirectory: string;
  proxy: string;
  format: string;
  audioFormat: string;
  subtitleLanguages: string;
  cookiesBrowser: string;
  playlistItems: string;
  retries: number;
  concurrentFragments: number;
  embedMetadata: boolean;
  embedThumbnail: boolean;
  embedSubtitles: boolean;
  writeInfoJson: boolean;
  noPlaylist: boolean;
  verbose: boolean;
}

export function buildYtDlpArgs(
  options: YtDlpOptions,
  denoPath?: string | null,
  includeBrowserCookies = true
): string[] {
  const args: string[] = [];
  if (denoPath) args.push("--js-runtimes", `deno:${denoPath}`);
  if (options.proxy.trim()) args.push("--proxy", options.proxy.trim());
  if (options.outputDirectory.trim()) args.push("-P", options.outputDirectory.trim());
  if (options.outputTemplate.trim()) args.push("-o", options.outputTemplate.trim());
  if (options.format.trim()) args.push("-f", options.format.trim());
  if (includeBrowserCookies && options.cookiesBrowser.trim()) {
    args.push("--cookies-from-browser", options.cookiesBrowser.trim());
  }
  if (options.playlistItems.trim()) args.push("-I", options.playlistItems.trim());
  args.push("--retries", String(options.retries));
  args.push("--concurrent-fragments", String(options.concurrentFragments));
  if (options.noPlaylist) args.push("--no-playlist");
  if (options.embedMetadata) args.push("--embed-metadata");
  if (options.embedThumbnail) args.push("--embed-thumbnail");
  if (options.embedSubtitles) args.push("--embed-subs");
  if (options.writeInfoJson) args.push("--write-info-json");
  if (options.verbose) args.push("--verbose");

  if (options.mode === "audio") {
    args.push("-x", "--audio-format", options.audioFormat || "best");
  } else if (options.mode === "thumbnail") {
    args.push("--skip-download", "--write-thumbnail");
  } else if (options.mode === "subtitles") {
    args.push("--skip-download", "--write-subs");
    if (options.subtitleLanguages.trim()) {
      args.push("--sub-langs", options.subtitleLanguages.trim());
    }
  } else if (options.mode === "formats") {
    args.push("--list-formats");
  } else if (options.mode === "metadata") {
    args.push("--skip-download", "--dump-single-json");
  }
  if (options.url.trim()) args.push(options.url.trim());
  return args;
}

export interface MediaOptions {
  inputs: string[];
  outputDirectory: string;
  operation:
    | "pr-compatible"
    | "remux"
    | "transcode"
    | "video-extract"
    | "audio"
    | "subtitle-extract"
    | "thumbnail"
    | "gif"
    | "frames";
  container:
    | "mov"
    | "mp4"
    | "mkv"
    | "webm"
    | "wav"
    | "mp3"
    | "m4a"
    | "flac"
    | "aiff"
    | "ogg"
    | "srt"
    | "ass";
  videoCodec:
    | "copy"
    | "prores_ks"
    | "h264_videotoolbox"
    | "hevc_videotoolbox"
    | "h264_amf"
    | "hevc_amf"
    | "h264_nvenc"
    | "hevc_nvenc"
    | "h264_qsv"
    | "hevc_qsv"
    | "libopenh264"
    | "libx264"
    | "libx265"
    | "mpeg4"
    | "libvpx-vp9"
    | "libsvtav1";
  videoEncoderFallback?: MediaOptions["videoCodec"];
  audioCodec:
    "copy" | "pcm_s24le" | "pcm_s16le" | "aac" | "libmp3lame" | "flac" | "libopus" | "opus";
  mapAll: boolean;
  preserveMetadata: boolean;
  overwrite: boolean;
  startTime: string;
  duration: string;
  videoStreamIndex: string;
  audioStreamIndex: string;
  subtitleStreamIndex: string;
  videoBitrate: string;
  crf: string;
  frameRate: string;
  width: string;
  height: string;
  scalingAlgorithm: "lanczos" | "bicubic" | "bilinear" | "neighbor";
  pixelFormat: string;
  preset: string;
  videoProfile: string;
  aspectRatio: string;
  crop: string;
  rotation: "none" | "90cw" | "90ccw" | "180";
  flipHorizontal: boolean;
  flipVertical: boolean;
  deinterlace: boolean;
  fastStart: boolean;
  speed: number;
  audioBitrate: string;
  sampleRate: string;
  channels: string;
  volume: string;
  loudnessNormalization: boolean;
  gifFps: number;
  gifWidth: number;
}

function audioCodecForOutput(
  operation: MediaOptions["operation"],
  container: MediaOptions["container"],
  audioCodec: MediaOptions["audioCodec"]
): MediaOptions["audioCodec"] {
  if (operation !== "audio") return audioCodec;
  // The GUI does not probe every source before building the command. Choose
  // a broadly supported encoder for the common extraction containers instead
  // of producing a guaranteed header error (for example Opus/MP3 copied into
  // M4A). Explicit codecs that are incompatible with the selected container
  // are normalized for the same reason.
  if (container === "m4a") return "aac";
  if (container === "wav" || container === "aiff") {
    return ["pcm_s16le", "pcm_s24le"].includes(audioCodec) ? audioCodec : "pcm_s24le";
  }
  if (container === "flac") return audioCodec === "flac" ? audioCodec : "flac";
  if (container === "ogg") return audioCodec === "opus" ? audioCodec : "opus";
  return audioCodec;
}

export function buildFfmpegArgs(input: string, output: string, options: MediaOptions): string[] {
  const args: string[] = [];
  if (options.overwrite) args.push("-y");
  else args.push("-n");
  if (options.startTime.trim()) args.push("-ss", options.startTime.trim());
  args.push("-i", input);
  if (options.duration.trim()) args.push("-t", options.duration.trim());
  if (options.mapAll) {
    if (["remux", "transcode"].includes(options.operation)) args.push("-map", "0");
    if (["thumbnail", "gif", "frames"].includes(options.operation)) args.push("-map", "0:v:0");
  }
  if (options.operation === "audio") {
    args.push("-map", `0:a:${options.audioStreamIndex.trim() || "0"}`);
  }
  if (options.operation === "video-extract") {
    args.push("-map", `0:v:${options.videoStreamIndex.trim() || "0"}`);
  }
  if (options.operation === "subtitle-extract") {
    args.push("-map", `0:s:${options.subtitleStreamIndex.trim() || "0"}`);
  }
  if (
    options.preserveMetadata &&
    !["video-extract", "subtitle-extract"].includes(options.operation)
  ) {
    args.push("-map_metadata", "0", "-map_chapters", "0");
  }

  const videoFilters: string[] = [];
  const audioFilters: string[] = [];
  if (options.deinterlace) videoFilters.push("yadif");
  if (options.crop.trim()) videoFilters.push(`crop=${options.crop.trim()}`);
  if (options.width.trim() || options.height.trim()) {
    videoFilters.push(
      `scale=${options.width.trim() || "-2"}:${options.height.trim() || "-2"}:flags=${options.scalingAlgorithm}`
    );
  }
  if (options.frameRate.trim()) videoFilters.push(`fps=${options.frameRate.trim()}`);
  if (options.rotation === "90cw") videoFilters.push("transpose=clock");
  if (options.rotation === "90ccw") videoFilters.push("transpose=cclock");
  if (options.rotation === "180") videoFilters.push("hflip", "vflip");
  if (options.flipHorizontal) videoFilters.push("hflip");
  if (options.flipVertical) videoFilters.push("vflip");
  if (options.aspectRatio.trim()) videoFilters.push(`setdar=${options.aspectRatio.trim()}`);
  if (options.speed !== 1) {
    videoFilters.push(`setpts=${(1 / options.speed).toFixed(6)}*PTS`);
    audioFilters.push(`atempo=${options.speed.toFixed(3)}`);
  }
  if (options.volume.trim()) audioFilters.push(`volume=${options.volume.trim()}`);
  if (options.loudnessNormalization) audioFilters.push("loudnorm=I=-16:LRA=11:TP=-1.5");

  let resolvedAudioCodec: MediaOptions["audioCodec"] | null = null;
  if (options.operation === "thumbnail") {
    if (videoFilters.length) args.push("-vf", videoFilters.join(","));
    args.push("-frames:v", "1", "-q:v", "2");
  } else if (options.operation === "gif") {
    const gifFilters = [
      `fps=${options.gifFps}`,
      `scale=${options.gifWidth}:-2:flags=lanczos`,
      "split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse"
    ];
    args.push("-vf", gifFilters.join(","), "-loop", "0", "-an");
  } else if (options.operation === "frames") {
    if (videoFilters.length) args.push("-vf", videoFilters.join(","));
    args.push("-fps_mode", "passthrough", "-an");
  } else if (options.operation === "video-extract") {
    args.push("-c:v", "copy", "-an", "-sn");
  } else if (options.operation === "subtitle-extract") {
    const subtitleCodec =
      options.container === "srt" ? "srt" : options.container === "ass" ? "ass" : "copy";
    args.push("-vn", "-an", "-c:s", subtitleCodec);
  } else if (options.operation === "audio") {
    const mustEncodeAudio =
      audioFilters.length > 0 ||
      Boolean(options.sampleRate.trim()) ||
      Boolean(options.channels.trim());
    const audioCodec =
      options.audioCodec === "copy" && mustEncodeAudio
        ? "aac"
        : audioCodecForOutput(options.operation, options.container, options.audioCodec);
    resolvedAudioCodec = audioCodec;
    args.push("-vn", "-c:a", audioCodec);
    if (audioCodec === "opus") args.push("-strict", "-2");
    if (audioFilters.length) args.push("-af", audioFilters.join(","));
  } else {
    const mustEncodeVideo = videoFilters.length > 0;
    const mustEncodeAudio =
      audioFilters.length > 0 ||
      Boolean(options.sampleRate.trim()) ||
      Boolean(options.channels.trim());
    const videoCodec =
      options.videoCodec === "copy" && mustEncodeVideo
        ? options.videoEncoderFallback || "h264_videotoolbox"
        : options.videoCodec;
    const audioCodec =
      options.audioCodec === "copy" && mustEncodeAudio ? "aac" : options.audioCodec;
    resolvedAudioCodec = audioCodec;
    args.push("-c:v", videoCodec, "-c:a", audioCodec);
    if (audioCodec === "opus") args.push("-strict", "-2");
    if (options.operation === "remux") {
      args.push(
        "-c:s",
        ["mp4", "mov"].includes(options.container) ? "mov_text" : "copy",
        "-c:d",
        "copy"
      );
    } else if (options.mapAll && ["mp4", "mov"].includes(options.container)) {
      // MP4/MOV have no automatic encoder for SubRip/ASS streams. Convert
      // text subtitles to QuickTime text when all streams are retained.
      args.push("-c:s", "mov_text");
    }
    if (videoFilters.length) args.push("-vf", videoFilters.join(","));
    if (audioFilters.length) args.push("-af", audioFilters.join(","));
    if (videoCodec === "prores_ks") args.push("-profile:v", "2");
    if (videoCodec.includes("videotoolbox")) {
      args.push("-allow_sw", "1");
    }
    if (videoCodec !== "copy") {
      if (options.videoBitrate.trim()) args.push("-b:v", options.videoBitrate.trim());
      if (
        options.crf.trim() &&
        ["libx264", "libx265", "libvpx-vp9", "libsvtav1"].includes(videoCodec)
      ) {
        args.push("-crf", options.crf.trim());
      }
      if (options.preset.trim() && ["libx264", "libx265", "libsvtav1"].includes(videoCodec)) {
        args.push("-preset", options.preset.trim());
      }
      if (options.videoProfile.trim() && ["libx264", "libx265"].includes(videoCodec)) {
        args.push("-profile:v", options.videoProfile.trim());
      }
      if (options.pixelFormat.trim()) args.push("-pix_fmt", options.pixelFormat.trim());
    }
    if (options.fastStart && ["mp4", "mov", "m4a"].includes(options.container)) {
      args.push("-movflags", "+faststart");
    }
  }
  if (
    options.operation !== "thumbnail" &&
    options.operation !== "gif" &&
    options.operation !== "frames"
  ) {
    if (options.audioBitrate.trim() && resolvedAudioCodec && resolvedAudioCodec !== "copy") {
      args.push("-b:a", options.audioBitrate.trim());
    }
    if (options.sampleRate.trim()) args.push("-ar", options.sampleRate.trim());
    if (options.channels.trim()) args.push("-ac", options.channels.trim());
  }
  args.push(output);
  return args;
}
