/**
 * 应用级窗口控制与语言设置封装。
 */

import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export async function syncNativeWindowTheme(scheme: "light" | "dark" | "auto"): Promise<void> {
  try {
    await getCurrentWindow().setTheme(scheme === "auto" ? null : scheme);
  } catch {
    // 非 Tauri 环境忽略
  }
}

/** 持久化语言选择到后端设置（后端据此本地化错误消息等），并立即生效 */
export function setAppLanguage(language: "auto" | "zh" | "en"): Promise<void> {
  return invoke<void>("set_language", { language });
}
