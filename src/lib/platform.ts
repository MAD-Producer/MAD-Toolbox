import { downloadDir, join } from "@tauri-apps/api/path";
import { t } from "../locale";
import type { ToolName } from "../contracts/dependency";

export const isWindows = typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent);

/** 各功能页统一的默认输出目录名：系统「下载」目录下的 MADToolbox 文件夹 */
export const defaultOutputDirectoryName = "MADToolbox";

let defaultOutputDirectoryPromise: Promise<string | null> | null = null;

/**
 * 解析统一默认输出目录（Windows: C:\Users\<name>\Downloads\MADToolbox；macOS: /Users/<name>/Downloads/MADToolbox）。
 * 非 Tauri 环境解析失败时返回 null，调用方保持字段为空。
 */
export function resolveDefaultOutputDirectory(): Promise<string | null> {
  defaultOutputDirectoryPromise ??= downloadDir()
    .then((base) => join(base, defaultOutputDirectoryName))
    .catch(() => null);
  return defaultOutputDirectoryPromise;
}

export const platformLabel = isWindows ? "Windows x64" : "Apple Silicon";
/** 系统文件管理器名（Windows 资源管理器本地化，其余平台为专名）；函数形式避免模块期冻结译文 */
export function fileManagerName(): string {
  return isWindows ? t("platform.fileManager") : "Finder";
}
export function browserCookieOptions() {
  return isWindows
    ? [
        { value: "", label: t("platform.noBrowserCookie") },
        { value: "edge", label: "Microsoft Edge" },
        { value: "chrome", label: "Google Chrome" },
        { value: "firefox", label: "Firefox" },
        { value: "brave", label: "Brave" },
        { value: "vivaldi", label: "Vivaldi" },
        { value: "opera", label: "Opera" },
        { value: "chromium", label: "Chromium" }
      ]
    : [
        { value: "", label: t("platform.noBrowserCookie") },
        { value: "chrome", label: "Google Chrome" },
        { value: "safari", label: "Safari" },
        { value: "firefox", label: "Firefox" },
        { value: "brave", label: "Brave" },
        { value: "vivaldi", label: "Vivaldi" },
        { value: "opera", label: "Opera" },
        { value: "chromium", label: "Chromium" }
      ];
}
export const defaultOutputPlaceholder = isWindows
  ? "C:\\Users\\name\\Downloads"
  : "/Users/name/Downloads";
export const mediaOutputPlaceholder = isWindows
  ? "C:\\Users\\name\\Videos\\Output"
  : "/Users/name/Movies/Output";

const WINGET_ACCEPT = "--accept-package-agreements --accept-source-agreements";

export const musicdlInstallCommand = isWindows
  ? "winget install --id Python.Python.3.13 -e --accept-package-agreements --accept-source-agreements; py -m pip install --user --upgrade pipx; py -m pipx ensurepath; py -m pipx install musicdl"
  : "brew install python pipx && pipx ensurepath && pipx install musicdl";

export const pipCommand = isWindows ? "py -m pip" : "python3 -m pip";

/** 各依赖缺失时依赖设置页展示的安装命令；bbdown 仅认内置副本、ffprobe 随 FFmpeg 分发，均不设卡。 */
export const toolInstallCommands: Partial<Record<ToolName, string>> = {
  ffmpeg: isWindows ? `winget install --id Gyan.FFmpeg -e ${WINGET_ACCEPT}` : "brew install ffmpeg",
  "yt-dlp": isWindows
    ? `winget install --id yt-dlp.yt-dlp -e ${WINGET_ACCEPT}`
    : "brew install yt-dlp",
  mediainfo: isWindows
    ? `winget install --id MediaArea.MediaInfo -e ${WINGET_ACCEPT}`
    : "brew install media-info",
  deno: isWindows ? `winget install --id DenoLand.Deno -e ${WINGET_ACCEPT}` : "brew install deno",
  python: isWindows
    ? `winget install --id Python.Python.3.13 -e ${WINGET_ACCEPT}`
    : "brew install python",
  musicdl: musicdlInstallCommand
};
