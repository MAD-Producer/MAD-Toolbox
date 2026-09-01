import { downloadDir, join } from "@tauri-apps/api/path";
import { t } from "../locale";
import type { ToolName } from "../contracts/dependency";

export const isWindows = typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent);

export const defaultOutputDirectoryName = "MADToolbox";

let defaultOutputDirectoryPromise: Promise<string | null> | null = null;

export function resolveDefaultOutputDirectory(): Promise<string | null> {
  defaultOutputDirectoryPromise ??= downloadDir()
    .then((base) => join(base, defaultOutputDirectoryName))
    .catch(() => null);
  return defaultOutputDirectoryPromise;
}

export const platformLabel = isWindows ? "Windows x64" : "Apple Silicon";
export function fileManagerName(): string {
  return isWindows ? t("platform.fileManager") : "Finder";
}
export const defaultOutputPlaceholder = isWindows
  ? "C:\\Users\\name\\Downloads"
  : "/Users/name/Downloads";
export const mediaOutputPlaceholder = isWindows
  ? "C:\\Users\\name\\Videos\\Output"
  : "/Users/name/Movies/Output";

const WINGET_ACCEPT = "--accept-package-agreements --accept-source-agreements";
const WINDOWS_PYTHON313 = '& "$env:LOCALAPPDATA\\Programs\\Python\\Python313\\python.exe"';

export const musicdlInstallCommand = isWindows
  ? `winget install --id Python.Python.3.13 -e --scope user ${WINGET_ACCEPT}; ${WINDOWS_PYTHON313} -m pip install --user --upgrade pipx; ${WINDOWS_PYTHON313} -m pipx ensurepath; ${WINDOWS_PYTHON313} -m pipx install musicdl`
  : "brew install python pipx && pipx ensurepath && pipx install musicdl";

export const pipCommand = isWindows ? "py -m pip" : "python3 -m pip";

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
    ? `winget install --id Python.Python.3.13 -e --scope user ${WINGET_ACCEPT}`
    : "brew install python",
  musicdl: musicdlInstallCommand
};
