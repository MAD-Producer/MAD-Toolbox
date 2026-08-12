import { Box, Check, ExternalLink, PackageOpen, Save } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { DirectoryInput } from "../components/DirectoryInput";
import type { AppSettings } from "../lib/types";
import {
  isWindows,
  liteInstallCommand,
  musicdlInstallCommand,
  platformLabel
} from "../lib/platform";

interface SettingsPageProps {
  settings: AppSettings;
  distributionMode: "Lite" | "Full";
  onSave: (settings: AppSettings) => Promise<AppSettings>;
}

export function SettingsPage({ settings, distributionMode, onSave }: SettingsPageProps) {
  const [directory, setDirectory] = useState(settings.defaultOutputDirectory || "");
  const [dependencyPreference, setDependencyPreference] = useState(settings.dependencyPreference);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [preferenceState, setPreferenceState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );

  useEffect(() => {
    setDirectory(settings.defaultOutputDirectory || "");
    setDependencyPreference(settings.dependencyPreference);
  }, [settings.defaultOutputDirectory, settings.dependencyPreference]);

  const save = async () => {
    setState("saving");
    try {
      await onSave({
        defaultOutputDirectory: directory || null,
        dependencyPreference: settings.dependencyPreference
      });
      setState("saved");
      window.setTimeout(() => setState("idle"), 1800);
    } catch {
      setState("error");
    }
  };

  const savePreference = async () => {
    setPreferenceState("saving");
    try {
      await onSave({
        defaultOutputDirectory: settings.defaultOutputDirectory,
        dependencyPreference
      });
      setPreferenceState("saved");
      window.setTimeout(() => setPreferenceState("idle"), 1800);
    } catch {
      setPreferenceState("error");
    }
  };

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">DISTRIBUTION</span>
          <h1>设置与分发</h1>
          <p>
            当前构建为 {platformLabel} {distributionMode === "Full" ? "全内置版" : "轻量版"}。
          </p>
        </div>
      </div>
      <section className="settings-section">
        <h2>默认导出目录</h2>
        <p>用于哔哩哔哩下载、网络视频下载和媒体处理；每个任务仍可单独覆盖。</p>
        <div className="setting-save-row">
          <DirectoryInput
            value={directory}
            onChange={(value) => {
              setDirectory(value);
              setState("idle");
            }}
            placeholder="留空使用各工具默认目录"
          />
          <button
            className="primary-button"
            type="button"
            onClick={() => void save()}
            disabled={state === "saving"}
          >
            {state === "saved" ? <Check size={15} /> : <Save size={15} />}
            {state === "saving" ? "保存中" : state === "saved" ? "已保存" : "保存"}
          </button>
        </div>
        {state === "error" && (
          <span className="setting-error">保存失败，请选择一个存在的目录。</span>
        )}
      </section>
      <section className="settings-section">
        <div className="settings-heading-row">
          <span>
            <h2>工具版本来源</h2>
            <p>决定运行任务时优先使用哪个版本；找不到首选版本时会自动回退。</p>
          </span>
          <button
            className="primary-button"
            type="button"
            disabled={
              preferenceState === "saving" || dependencyPreference === settings.dependencyPreference
            }
            onClick={() => void savePreference()}
          >
            {preferenceState === "saved" ? <Check size={15} /> : <Save size={15} />}
            {preferenceState === "saving"
              ? "切换中"
              : preferenceState === "saved"
                ? "已切换"
                : "应用设置"}
          </button>
        </div>
        <div className="distribution-grid source-selector">
          <button
            type="button"
            className={`distribution-card ${dependencyPreference === "system" ? "active" : ""}`}
            onClick={() => {
              setDependencyPreference("system");
              setPreferenceState("idle");
            }}
          >
            <PackageOpen size={24} />
            <div>
              <strong>{isWindows ? "系统安装版本优先" : "系统 / Homebrew 优先"}</strong>
              <p>优先使用自行安装的版本，适合希望及时使用最新版的用户。</p>
              <code>{liteInstallCommand}</code>
            </div>
          </button>
          <button
            type="button"
            className={`distribution-card ${dependencyPreference === "bundled" ? "active" : ""}`}
            onClick={() => {
              setDependencyPreference("bundled");
              setPreferenceState("idle");
            }}
          >
            <Box size={24} />
            <div>
              <strong>全内置版本优先（默认）</strong>
              <p>优先使用随应用审计和测试过的依赖，版本稳定且无需额外安装。</p>
              <span className="muted">
                {distributionMode === "Full"
                  ? "当前安装包已包含 FFmpeg、MediaInfo、yt-dlp、Deno 与 BBDown。"
                  : "当前轻量版会在缺少内置依赖时自动使用系统版本。"}
              </span>
            </div>
          </button>
        </div>
        {preferenceState === "error" && <span className="setting-error">来源设置保存失败。</span>}
      </section>
      <section className="settings-section">
        <h2>可选音乐下载依赖</h2>
        <p>
          musicdl 和 Python 不随 MAD Toolbox 分发。推荐通过{isWindows ? " winget" : " Homebrew"}安装
          Python， 再使用 pipx 隔离安装 musicdl；音乐下载页面提供 USTC/TUNA 换源向导。
        </p>
        <div className="link-list">
          <button
            type="button"
            onClick={() => void openUrl("https://github.com/CharlesPikachu/musicdl")}
          >
            musicdl 项目、安装说明与许可证
            <ExternalLink size={13} />
          </button>
          <button
            type="button"
            onClick={() => void openUrl("https://mirrors.ustc.edu.cn/help/pypi.html")}
          >
            USTC PyPI 镜像官方帮助
            <ExternalLink size={13} />
          </button>
          <button
            type="button"
            onClick={() => void openUrl("https://mirrors.tuna.tsinghua.edu.cn/help/pypi/")}
          >
            TUNA PyPI 镜像官方帮助
            <ExternalLink size={13} />
          </button>
        </div>
        <code>{musicdlInstallCommand}</code>
      </section>
      <section className="settings-section">
        <h2>{isWindows ? "Windows FFmpeg 构建与依赖来源" : "macOS FFmpeg 版本与构建"}</h2>
        <p>
          {isWindows
            ? "Full 版内置 BtbN Windows x64 LGPL 构建；也可切换到自行安装的最新版或旧主版本。"
            : "Apple Silicon 推荐 Homebrew 当前版；仅在旧项目或插件明确要求时安装旧主版本。"}
        </p>
        <div className="link-list">
          {(isWindows
            ? [
                ["FFmpeg 官方下载索引与历史源码", "https://ffmpeg.org/download.html"],
                [
                  "BtbN FFmpeg 8.1 Windows x64 LGPL",
                  "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n8.1-latest-win64-lgpl-8.1.zip"
                ],
                [
                  "BtbN FFmpeg 7.1 Windows x64 LGPL",
                  "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n7.1-latest-win64-lgpl-7.1.zip"
                ],
                [
                  "BtbN 最新开发版 Windows x64 LGPL",
                  "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-lgpl.zip"
                ],
                ["Gyan Windows 构建", "https://www.gyan.dev/ffmpeg/builds/"],
                ["yt-dlp Windows 发行版", "https://github.com/yt-dlp/yt-dlp/releases"],
                ["MediaInfo CLI Windows 版", "https://mediaarea.net/MediaInfo/Download/Windows"],
                ["Deno Windows 发行版", "https://github.com/denoland/deno/releases"]
              ]
            : [
                ["FFmpeg 8 当前稳定版（Homebrew）", "https://formulae.brew.sh/formula/ffmpeg"],
                ["FFmpeg 7（Homebrew）", "https://formulae.brew.sh/formula/ffmpeg%407"],
                ["FFmpeg 6（Homebrew）", "https://formulae.brew.sh/formula/ffmpeg%406"],
                ["FFmpeg 5（Homebrew）", "https://formulae.brew.sh/formula/ffmpeg%405"],
                ["FFmpeg 官方源码与历史版本", "https://ffmpeg.org/download.html"],
                ["Evermeet Intel 静态构建（需要 Rosetta）", "https://evermeet.cx/ffmpeg/"]
              ]
          ).map(([label, url]) => (
            <button type="button" onClick={() => void openUrl(url)} key={url}>
              {label}
              <ExternalLink size={13} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
