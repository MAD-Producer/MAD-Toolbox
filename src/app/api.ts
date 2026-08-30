import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export async function syncNativeWindowTheme(scheme: "light" | "dark" | "auto"): Promise<void> {
  try {
    await getCurrentWindow().setTheme(scheme === "auto" ? null : scheme);
  } catch {}
}

export function setAppLanguage(language: "auto" | "zh" | "en"): Promise<void> {
  return invoke<void>("set_language", { language });
}
