import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { AppSettings } from "../pages/settings/api";

export async function syncNativeWindowTheme(scheme: "light" | "dark" | "auto"): Promise<void> {
  try {
    await getCurrentWindow().setTheme(scheme === "auto" ? null : scheme);
  } catch {}
}

export function setAppLanguage(language: AppSettings["language"]): Promise<AppSettings> {
  return invoke<AppSettings>("set_language", { language });
}

/** 关窗确认后的退出：后端先取消全部任务、等待终态，再退出进程（shutdown_app）。 */
export function shutdownApp(): Promise<void> {
  return invoke<void>("shutdown_app");
}
