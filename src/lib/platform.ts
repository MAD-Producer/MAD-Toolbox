import { downloadDir, join } from "@tauri-apps/api/path";

export const isWindows = typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent);

export const defaultOutputDirectoryName = "MADToolbox";

let defaultOutputDirectoryPromise: Promise<string | null> | null = null;

export function resolveDefaultOutputDirectory(): Promise<string | null> {
  defaultOutputDirectoryPromise ??= downloadDir()
    .then((base) => join(base, defaultOutputDirectoryName))
    .catch(() => null);
  return defaultOutputDirectoryPromise;
}
