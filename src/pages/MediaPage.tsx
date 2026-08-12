import { FilePlus2, Files, FolderOpen, Info, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { buildFfmpegArgs, commandPreview, type MediaOptions } from "../lib/commands";
import type { MediaInspection, RunRequest } from "../lib/types";
import { CommandBar } from "../components/CommandBar";
import { Field, SelectInput, TextInput, Toggle } from "../components/Field";
import { DirectoryInput } from "../components/DirectoryInput";
import { TemplateManager } from "../components/TemplateManager";
import { fileManagerName, mediaOutputPlaceholder } from "../lib/platform";

interface MediaPageProps {
  pageMode: "media" | "streams";
  ffmpegAvailable: boolean;
  ffmpegEncoders: string[];
  defaultOutputDirectory: string | null;
  onRun: (request: RunRequest) => Promise<unknown>;
  onRunPrCompatible: (input: string, outputDirectory: string) => Promise<unknown>;
  onInspect: (path: string) => Promise<MediaInspection>;
  onExpandInputs: (paths: string[], includeSubtitles: boolean) => Promise<string[]>;
}

const initialOptions: MediaOptions = {
  inputs: [],
  outputDirectory: "",
  operation: "pr-compatible",
  container: "mov",
  videoCodec: "copy",
  audioCodec: "copy",
  mapAll: true,
  preserveMetadata: true,
  overwrite: false,
  startTime: "",
  duration: "",
  videoStreamIndex: "0",
  audioStreamIndex: "0",
  subtitleStreamIndex: "0",
  videoBitrate: "",
  crf: "20",
  frameRate: "",
  width: "",
  height: "",
  scalingAlgorithm: "lanczos",
  pixelFormat: "",
  preset: "medium",
  videoProfile: "",
  aspectRatio: "",
  crop: "",
  rotation: "none",
  flipHorizontal: false,
  flipVertical: false,
  deinterlace: false,
  fastStart: true,
  speed: 1,
  audioBitrate: "192k",
  sampleRate: "",
  channels: "",
  volume: "",
  loudnessNormalization: false,
  gifFps: 12,
  gifWidth: 720
};

function splitPath(path: string) {
  const separator = path.includes("\\") ? "\\" : "/";
  const parts = path.split(separator);
  const file = parts.pop() || "output";
  const directory = parts.join(separator) || ".";
  const base = file.includes(".") ? file.slice(0, file.lastIndexOf(".")) : file;
  return { directory, base, separator };
}

function outputPath(input: string, options: MediaOptions) {
  const { directory, base, separator } = splitPath(input);
  const outputDirectory = options.outputDirectory.trim() || directory;
  const extension =
    options.operation === "thumbnail"
      ? "jpg"
      : options.operation === "gif"
        ? "gif"
        : options.operation === "frames"
          ? "png"
          : options.container;
  const suffix = options.operation === "frames" ? ".mad.%06d" : ".mad";
  return `${outputDirectory}${separator}${base}${suffix}.${extension}`;
}

export function MediaPage({
  pageMode,
  ffmpegAvailable,
  ffmpegEncoders,
  defaultOutputDirectory,
  onRun,
  onRunPrCompatible,
  onInspect,
  onExpandInputs
}: MediaPageProps) {
  const [options, setOptions] = useState<MediaOptions>(() => ({
    ...initialOptions,
    operation: pageMode === "streams" ? ("remux" as const) : ("pr-compatible" as const),
    container: pageMode === "streams" ? ("mkv" as const) : ("mov" as const)
  }));
  const [inspection, setInspection] = useState<MediaInspection | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const update = <K extends keyof MediaOptions>(key: K, value: MediaOptions[K]) => {
    setOptions((current) => ({ ...current, [key]: value }));
  };
  const selectOperation = (operation: MediaOptions["operation"]) => {
    const suggestedContainer: Partial<
      Record<MediaOptions["operation"], MediaOptions["container"]>
    > = {
      remux: "mkv",
      transcode: "mov",
      "video-extract": "mkv",
      audio: "m4a",
      "subtitle-extract": "srt"
    };
    setOptions((current) => ({
      ...current,
      operation,
      container: suggestedContainer[operation] ?? current.container
    }));
  };

  const addPaths = (paths: string[]) => {
    setOptions((current) => ({
      ...current,
      inputs: [...new Set([...current.inputs, ...paths])]
    }));
  };

  useEffect(() => {
    let dispose: (() => void) | undefined;
    void getCurrentWebviewWindow()
      .onDragDropEvent((event) => {
        if (event.payload.type === "drop") addPaths(event.payload.paths);
      })
      .then((unlisten) => {
        dispose = unlisten;
      });
    return () => dispose?.();
  }, []);

  useEffect(() => {
    if (defaultOutputDirectory) {
      setOptions((current) =>
        current.outputDirectory.trim()
          ? current
          : { ...current, outputDirectory: defaultOutputDirectory }
      );
    }
  }, [defaultOutputDirectory]);

  useEffect(() => {
    if (ffmpegEncoders.length === 0) return;
    setOptions((current) => ({
      ...current,
      videoCodec:
        current.videoCodec === "copy" || ffmpegEncoders.includes(current.videoCodec)
          ? current.videoCodec
          : "copy",
      audioCodec:
        current.audioCodec === "copy" || ffmpegEncoders.includes(current.audioCodec)
          ? current.audioCodec
          : "copy"
    }));
  }, [ffmpegEncoders]);

  const firstInput = options.inputs[0] || "";
  const output = firstInput ? outputPath(firstInput, options) : "";
  const videoEncoderFallback = [
    "libx264",
    "libopenh264",
    "h264_videotoolbox",
    "h264_amf",
    "h264_nvenc",
    "h264_qsv",
    "mpeg4"
  ].find((encoder) => ffmpegEncoders.includes(encoder)) as MediaOptions["videoCodec"] | undefined;
  const args = useMemo(
    () =>
      firstInput && options.operation !== "pr-compatible"
        ? buildFfmpegArgs(firstInput, output, {
            ...options,
            videoEncoderFallback
          })
        : [],
    [firstInput, output, options, videoEncoderFallback]
  );
  const preview =
    options.operation === "pr-compatible" && firstInput
      ? `PR 兼容处理：${firstInput}`
      : commandPreview("ffmpeg", args);
  const templateOptions = useMemo(() => {
    const { inputs: _inputs, ...settings } = options;
    return settings;
  }, [options]);

  const chooseFiles = async () => {
    const selected = await open({ multiple: true, directory: false });
    if (Array.isArray(selected)) addPaths(selected);
    else if (selected) addPaths([selected]);
  };

  const chooseDirectory = async () => {
    const selected = await open({ multiple: false, directory: true });
    if (typeof selected === "string") addPaths([selected]);
  };

  const inspectFirst = async () => {
    if (!firstInput) return;
    setInspecting(true);
    try {
      setInspection(await onInspect(firstInput));
    } finally {
      setInspecting(false);
    }
  };

  const run = async () => {
    const inputs =
      options.operation === "pr-compatible"
        ? options.inputs
        : await onExpandInputs(options.inputs, options.operation === "subtitle-extract");
    for (const input of inputs) {
      if (options.operation === "pr-compatible") {
        await onRunPrCompatible(input, options.outputDirectory);
      } else {
        const nextOutput = outputPath(input, options);
        await onRun({
          tool: "ffmpeg",
          args: buildFfmpegArgs(input, nextOutput, options)
        });
      }
    }
  };

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">FFMPEG + FFPROBE + MEDIAINFO</span>
          <h1>{pageMode === "streams" ? "封装与抽流" : "媒体转换"}</h1>
          <p>
            {pageMode === "streams"
              ? "重新封装或提取视频、音频和字幕流；默认直接复制，不进行重编码。"
              : "智能 PR 兼容转码，以及常用视频、音频和图像处理。"}
          </p>
        </div>
      </div>

      <TemplateManager
        featureKey={pageMode}
        value={templateOptions}
        onApply={(template) =>
          setOptions((current) => ({ ...current, ...template, inputs: current.inputs }))
        }
      />

      <section className="drop-zone">
        <Files size={28} />
        <strong>拖入文件或目录</strong>
        <span>目录会由任务队列安全遍历，不执行 Shell for 循环。</span>
        <div>
          <button className="secondary-button" type="button" onClick={() => void chooseFiles()}>
            <FilePlus2 size={15} />
            选择文件
          </button>
          <button className="secondary-button" type="button" onClick={() => void chooseDirectory()}>
            <FolderOpen size={15} />
            选择目录
          </button>
        </div>
      </section>

      {options.inputs.length > 0 && (
        <div className="file-list">
          {options.inputs.map((path) => (
            <div className="file-row" key={path}>
              <span>{path}</span>
              <button
                type="button"
                title="移除"
                onClick={() =>
                  update(
                    "inputs",
                    options.inputs.filter((item) => item !== path)
                  )
                }
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <section className="tool-panel">
        <div className="operation-tabs">
          {(pageMode === "streams"
            ? [
                ["remux", "重新封装", Files],
                ["video-extract", "提取视频流", Files],
                ["audio", "提取音频流", Files],
                ["subtitle-extract", "提取字幕流", Files]
              ]
            : [
                ["pr-compatible", "PR 原生兼容", Sparkles],
                ["transcode", "视频转换", Files],
                ["audio", "音频转换", Files],
                ["thumbnail", "提取画面", Files],
                ["gif", "制作 GIF", Files],
                ["frames", "导出序列帧", Files]
              ]
          ).map(([value, label, Icon]) => (
            <button
              type="button"
              key={value as string}
              className={options.operation === value ? "active" : ""}
              onClick={() => selectOperation(value as MediaOptions["operation"])}
            >
              <Icon size={15} />
              {label as string}
            </button>
          ))}
        </div>

        {options.operation === "pr-compatible" && (
          <div className="notice info">
            <Sparkles size={18} />
            <div>
              <strong>视频、音频与字幕自动兼容</strong>
              <p>
                FLV、WebM、MKV、AVI 等视频会自动封装或转为 PR 兼容的 MP4/MOV；无损音频转
                WAV，有损音频输出 MP3 或 AAC/M4A，文字字幕统一转 SRT。
              </p>
            </div>
          </div>
        )}

        {pageMode === "streams" && (
          <div className="notice info">
            <Files size={18} />
            <div>
              <strong>无损复制流</strong>
              <p>重新封装会保留全部轨道；抽流默认选择第一条对应轨道，使用 copy 直接复制。</p>
            </div>
          </div>
        )}

        {options.operation === "subtitle-extract" && (
          <div className="notice warning">
            <Info size={18} />
            <div>
              <strong>支持 SRT 与 ASS 文字字幕</strong>
              <p>
                可导入、识别并导出 SRT/ASS；PGS、VobSub 等图片字幕需要 OCR，FFmpeg
                无法直接转成文字字幕。
              </p>
            </div>
          </div>
        )}

        <div className="form-grid single-leading">
          <Field
            label="输出目录"
            hint={`留空时输出到原文件目录；可直接输入或在${fileManagerName}中选择。`}
          >
            <DirectoryInput
              value={options.outputDirectory}
              onChange={(value) => update("outputDirectory", value)}
              placeholder={mediaOutputPlaceholder}
            />
          </Field>
        </div>

        {options.operation !== "pr-compatible" && (
          <>
            <section className="parameter-section">
              <h3>基础输出</h3>
              <div className="form-grid">
                <Field
                  label={options.operation === "subtitle-extract" ? "字幕输出格式" : "输出封装"}
                >
                  <SelectInput
                    value={options.container}
                    onChange={(event) =>
                      update("container", event.target.value as MediaOptions["container"])
                    }
                    disabled={["thumbnail", "gif", "frames"].includes(options.operation)}
                  >
                    {["remux", "transcode", "video-extract"].includes(options.operation) && (
                      <>
                        <option value="mov">MOV</option>
                        <option value="mp4">MP4</option>
                        <option value="mkv">MKV</option>
                        <option value="webm">WebM</option>
                      </>
                    )}
                    {options.operation === "audio" && (
                      <>
                        <option value="m4a">M4A</option>
                        <option value="wav">WAV</option>
                        <option value="mp3">MP3</option>
                        <option value="flac">FLAC</option>
                        <option value="aiff">AIFF</option>
                        <option value="ogg">OGG</option>
                        <option value="mkv">MKV/MKA</option>
                      </>
                    )}
                    {options.operation === "subtitle-extract" && (
                      <>
                        <option value="srt">SRT（转换字幕）</option>
                        <option value="ass">ASS（保留高级样式）</option>
                        <option value="mkv">MKV（原样复制字幕流）</option>
                      </>
                    )}
                  </SelectInput>
                </Field>
                <Field label="开始时间" hint="例如 00:01:23.500">
                  <TextInput
                    value={options.startTime}
                    onChange={(event) => update("startTime", event.target.value)}
                  />
                </Field>
                <Field label="持续时间" hint="留空处理到文件末尾">
                  <TextInput
                    value={options.duration}
                    onChange={(event) => update("duration", event.target.value)}
                  />
                </Field>
                {pageMode === "media" && (
                  <Field label="播放速度" hint="0.5–2.0，1 表示原速">
                    <TextInput
                      type="number"
                      min={0.5}
                      max={2}
                      step={0.05}
                      value={options.speed}
                      onChange={(e) => update("speed", Number(e.target.value))}
                    />
                  </Field>
                )}
              </div>
            </section>

            {pageMode === "streams" && options.operation !== "remux" && (
              <section className="parameter-section">
                <h3>轨道选择</h3>
                <div className="form-grid">
                  {options.operation === "video-extract" && (
                    <Field label="视频轨道索引" hint="从 0 开始；可先查看文件信息确认轨道。">
                      <TextInput
                        type="number"
                        min={0}
                        value={options.videoStreamIndex}
                        onChange={(event) => update("videoStreamIndex", event.target.value)}
                      />
                    </Field>
                  )}
                  {options.operation === "audio" && (
                    <Field label="音频轨道索引" hint="从 0 开始，例如第二条音轨填写 1。">
                      <TextInput
                        type="number"
                        min={0}
                        value={options.audioStreamIndex}
                        onChange={(event) => update("audioStreamIndex", event.target.value)}
                      />
                    </Field>
                  )}
                  {options.operation === "subtitle-extract" && (
                    <Field label="字幕轨道索引" hint="从 0 开始，例如第二条字幕填写 1。">
                      <TextInput
                        type="number"
                        min={0}
                        value={options.subtitleStreamIndex}
                        onChange={(event) => update("subtitleStreamIndex", event.target.value)}
                      />
                    </Field>
                  )}
                </div>
              </section>
            )}

            {pageMode === "media" &&
              !["audio", "gif", "frames", "thumbnail"].includes(options.operation) && (
                <section className="parameter-section">
                  <h3>视频编码与质量</h3>
                  <div className="form-grid">
                    <Field label="视频编码">
                      <SelectInput
                        value={options.videoCodec}
                        onChange={(event) =>
                          update("videoCodec", event.target.value as MediaOptions["videoCodec"])
                        }
                      >
                        <option value="copy">复制原视频流</option>
                        {ffmpegEncoders.includes("prores_ks") && (
                          <option value="prores_ks">Apple ProRes 422</option>
                        )}
                        {ffmpegEncoders.includes("h264_videotoolbox") && (
                          <option value="h264_videotoolbox">H.264 VideoToolbox</option>
                        )}
                        {ffmpegEncoders.includes("hevc_videotoolbox") && (
                          <option value="hevc_videotoolbox">HEVC VideoToolbox</option>
                        )}
                        {ffmpegEncoders.includes("h264_amf") && (
                          <option value="h264_amf">H.264 AMD AMF</option>
                        )}
                        {ffmpegEncoders.includes("hevc_amf") && (
                          <option value="hevc_amf">HEVC AMD AMF</option>
                        )}
                        {ffmpegEncoders.includes("h264_nvenc") && (
                          <option value="h264_nvenc">H.264 NVIDIA NVENC</option>
                        )}
                        {ffmpegEncoders.includes("hevc_nvenc") && (
                          <option value="hevc_nvenc">HEVC NVIDIA NVENC</option>
                        )}
                        {ffmpegEncoders.includes("h264_qsv") && (
                          <option value="h264_qsv">H.264 Intel QSV</option>
                        )}
                        {ffmpegEncoders.includes("hevc_qsv") && (
                          <option value="hevc_qsv">HEVC Intel QSV</option>
                        )}
                        {ffmpegEncoders.includes("libopenh264") && (
                          <option value="libopenh264">H.264 OpenH264 软件编码</option>
                        )}
                        {ffmpegEncoders.includes("libx264") && (
                          <option value="libx264">H.264 软件编码</option>
                        )}
                        {ffmpegEncoders.includes("libx265") && (
                          <option value="libx265">HEVC 软件编码</option>
                        )}
                        {ffmpegEncoders.includes("mpeg4") && (
                          <option value="mpeg4">MPEG-4 Part 2 软件编码</option>
                        )}
                        {ffmpegEncoders.includes("libvpx-vp9") && (
                          <option value="libvpx-vp9">VP9</option>
                        )}
                        {ffmpegEncoders.includes("libsvtav1") && (
                          <option value="libsvtav1">AV1 (SVT-AV1)</option>
                        )}
                      </SelectInput>
                    </Field>
                    <Field label="视频码率" hint="例如 8M、2500k；留空自动">
                      <TextInput
                        value={options.videoBitrate}
                        onChange={(e) => update("videoBitrate", e.target.value)}
                        placeholder="8M"
                      />
                    </Field>
                    <Field label="恒定质量 CRF" hint="仅软件编码有效；数值越小质量越高">
                      <TextInput
                        type="number"
                        min={0}
                        max={63}
                        value={options.crf}
                        onChange={(e) => update("crf", e.target.value)}
                      />
                    </Field>
                    <Field label="编码速度预设">
                      <SelectInput
                        value={options.preset}
                        onChange={(e) => update("preset", e.target.value)}
                      >
                        {[
                          "ultrafast",
                          "veryfast",
                          "faster",
                          "fast",
                          "medium",
                          "slow",
                          "slower",
                          "veryslow"
                        ].map((preset) => (
                          <option value={preset} key={preset}>
                            {preset}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>
                    <Field label="编码 Profile" hint="例如 high、main、main10">
                      <TextInput
                        value={options.videoProfile}
                        onChange={(e) => update("videoProfile", e.target.value)}
                      />
                    </Field>
                    <Field label="像素格式" hint="例如 yuv420p、yuv422p10le">
                      <SelectInput
                        value={options.pixelFormat}
                        onChange={(e) => update("pixelFormat", e.target.value)}
                      >
                        <option value="">自动</option>
                        <option value="yuv420p">yuv420p</option>
                        <option value="yuv420p10le">yuv420p10le</option>
                        <option value="yuv422p10le">yuv422p10le</option>
                        <option value="yuva420p">yuva420p</option>
                      </SelectInput>
                    </Field>
                  </div>
                </section>
              )}

            {pageMode === "media" && options.operation !== "audio" && (
              <section className="parameter-section">
                <h3>画面、尺寸与帧率</h3>
                <div className="form-grid">
                  <Field label="输出帧率" hint="例如 23.976、25、30、60；留空保持">
                    <TextInput
                      value={options.frameRate}
                      onChange={(e) => update("frameRate", e.target.value)}
                    />
                  </Field>
                  <Field label="宽度" hint="只填一边时自动保持比例">
                    <TextInput
                      type="number"
                      min={2}
                      value={options.width}
                      onChange={(e) => update("width", e.target.value)}
                      placeholder="1920"
                    />
                  </Field>
                  <Field label="高度">
                    <TextInput
                      type="number"
                      min={2}
                      value={options.height}
                      onChange={(e) => update("height", e.target.value)}
                      placeholder="1080"
                    />
                  </Field>
                  <Field label="缩放算法">
                    <SelectInput
                      value={options.scalingAlgorithm}
                      onChange={(e) =>
                        update(
                          "scalingAlgorithm",
                          e.target.value as MediaOptions["scalingAlgorithm"]
                        )
                      }
                    >
                      <option value="lanczos">Lanczos（高质量）</option>
                      <option value="bicubic">Bicubic</option>
                      <option value="bilinear">Bilinear（快速）</option>
                      <option value="neighbor">Nearest（像素画）</option>
                    </SelectInput>
                  </Field>
                  <Field label="裁剪表达式" hint="宽:高:x:y，例如 1920:800:0:140">
                    <TextInput
                      value={options.crop}
                      onChange={(e) => update("crop", e.target.value)}
                    />
                  </Field>
                  <Field label="显示宽高比" hint="例如 16/9、4/3">
                    <TextInput
                      value={options.aspectRatio}
                      onChange={(e) => update("aspectRatio", e.target.value)}
                    />
                  </Field>
                  <Field label="旋转">
                    <SelectInput
                      value={options.rotation}
                      onChange={(e) =>
                        update("rotation", e.target.value as MediaOptions["rotation"])
                      }
                    >
                      <option value="none">不旋转</option>
                      <option value="90cw">顺时针 90°</option>
                      <option value="90ccw">逆时针 90°</option>
                      <option value="180">180°</option>
                    </SelectInput>
                  </Field>
                </div>
                <div className="toggle-grid">
                  <Toggle
                    checked={options.flipHorizontal}
                    onChange={(v) => update("flipHorizontal", v)}
                    label="水平翻转"
                  />
                  <Toggle
                    checked={options.flipVertical}
                    onChange={(v) => update("flipVertical", v)}
                    label="垂直翻转"
                  />
                  <Toggle
                    checked={options.deinterlace}
                    onChange={(v) => update("deinterlace", v)}
                    label="YADIF 去隔行"
                  />
                </div>
              </section>
            )}

            {(pageMode === "media" || options.operation === "audio") &&
              !["gif", "frames", "thumbnail"].includes(options.operation) && (
                <section className="parameter-section">
                  <h3>音频编码与响度</h3>
                  <div className="form-grid">
                    <Field label="音频编码">
                      <SelectInput
                        value={options.audioCodec}
                        onChange={(event) =>
                          update("audioCodec", event.target.value as MediaOptions["audioCodec"])
                        }
                      >
                        <option value="copy">自动选择兼容编码</option>
                        {ffmpegEncoders.includes("pcm_s24le") && (
                          <option value="pcm_s24le">PCM 24-bit</option>
                        )}
                        {ffmpegEncoders.includes("pcm_s16le") && (
                          <option value="pcm_s16le">PCM 16-bit</option>
                        )}
                        {ffmpegEncoders.includes("aac") && <option value="aac">AAC</option>}
                        {ffmpegEncoders.includes("libmp3lame") && (
                          <option value="libmp3lame">MP3</option>
                        )}
                        {ffmpegEncoders.includes("flac") && <option value="flac">FLAC</option>}
                        {ffmpegEncoders.includes("libopus") && (
                          <option value="libopus">Opus</option>
                        )}
                        {!ffmpegEncoders.includes("libopus") && ffmpegEncoders.includes("opus") && (
                          <option value="opus">Opus（内置实验编码器）</option>
                        )}
                      </SelectInput>
                    </Field>
                    <Field label="音频码率" hint="例如 192k、320k">
                      <TextInput
                        value={options.audioBitrate}
                        onChange={(e) => update("audioBitrate", e.target.value)}
                      />
                    </Field>
                    <Field label="采样率" hint="例如 44100、48000、96000">
                      <TextInput
                        value={options.sampleRate}
                        onChange={(e) => update("sampleRate", e.target.value)}
                      />
                    </Field>
                    <Field label="声道数" hint="1 单声道、2 立体声、6 为 5.1">
                      <TextInput
                        type="number"
                        min={1}
                        max={16}
                        value={options.channels}
                        onChange={(e) => update("channels", e.target.value)}
                      />
                    </Field>
                    <Field label="音量" hint="例如 1.2、-3dB；留空保持">
                      <TextInput
                        value={options.volume}
                        onChange={(e) => update("volume", e.target.value)}
                      />
                    </Field>
                  </div>
                  <div className="toggle-grid">
                    <Toggle
                      checked={options.loudnessNormalization}
                      onChange={(v) => update("loudnessNormalization", v)}
                      label="响度标准化（-16 LUFS）"
                    />
                  </div>
                  {options.container === "mp3" && !ffmpegEncoders.includes("libmp3lame") && (
                    <div className="notice warning">
                      <Info size={16} />
                      <div>
                        当前内置 FFmpeg 未包含 MP3 编码器；只有输入本身是 MP3
                        时才能直接复制，其他音频请改用 M4A、WAV、FLAC 或 OGG。
                      </div>
                    </div>
                  )}
                </section>
              )}

            {options.operation === "gif" && (
              <section className="parameter-section">
                <h3>GIF 参数</h3>
                <div className="form-grid">
                  <Field label="GIF 帧率">
                    <TextInput
                      type="number"
                      min={1}
                      max={60}
                      value={options.gifFps}
                      onChange={(e) => update("gifFps", Number(e.target.value))}
                    />
                  </Field>
                  <Field label="GIF 宽度">
                    <TextInput
                      type="number"
                      min={64}
                      value={options.gifWidth}
                      onChange={(e) => update("gifWidth", Number(e.target.value))}
                    />
                  </Field>
                </div>
              </section>
            )}
          </>
        )}

        <div className="toggle-grid">
          {(pageMode === "media" || options.operation === "remux") && (
            <Toggle
              checked={options.mapAll}
              onChange={(v) => update("mapAll", v)}
              label="保留全部媒体流"
            />
          )}
          <Toggle
            checked={options.preserveMetadata}
            onChange={(v) => update("preserveMetadata", v)}
            label="保留元数据与章节"
          />
          <Toggle
            checked={options.overwrite}
            onChange={(v) => update("overwrite", v)}
            label="覆盖已有文件"
          />
          {options.operation !== "pr-compatible" && (
            <Toggle
              checked={options.fastStart}
              onChange={(v) => update("fastStart", v)}
              label="网页快速播放（faststart）"
            />
          )}
        </div>
        <button
          className="secondary-button inspect-button"
          type="button"
          disabled={!firstInput || inspecting}
          onClick={() => void inspectFirst()}
        >
          <Info size={15} />
          {inspecting ? "识别中…" : "查看首个文件信息"}
        </button>
      </section>

      {inspection && (
        <section className="inspection-card">
          <header>
            <strong>媒体信息</strong>
            <button type="button" onClick={() => setInspection(null)}>
              <X size={14} />
            </button>
          </header>
          <pre>{inspection.summary}</pre>
        </section>
      )}

      <CommandBar
        command={preview}
        onRun={() => void run()}
        disabled={options.inputs.length === 0 || !ffmpegAvailable}
        disabledReason={!ffmpegAvailable ? "未找到 FFmpeg" : "请添加文件"}
      />
    </div>
  );
}
