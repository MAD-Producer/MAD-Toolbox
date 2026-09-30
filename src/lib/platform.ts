import { downloadDir, join } from "@tauri-apps/api/path";
import { t } from "../locale";

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

export const pipCommand = isWindows ? "py -m pip" : "python3 -m pip";
