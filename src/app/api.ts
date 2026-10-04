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
