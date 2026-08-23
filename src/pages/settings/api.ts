/**
 * 设置页后端契约的类型化 invoke 封装：应用设置、依赖检测/安装与更新检查为跨 feature 应用级命令。
 */

import { invoke } from "@tauri-apps/api/core";
import type { DependencyStatus, ToolName } from "../../contracts/dependency";

export interface AppSettings {
  defaultOutputDirectory: string | null;
  dependencyPreference: "bundled" | "system";
  proxy: string | null;
  /** 界面与后端消息语言；auto = 跟随系统（zh 系 → 中文，其余 → 英文） */
  language: "auto" | "zh" | "en";
}

export interface UpdateCheck {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseUrl: string;
}

export function fetchAppSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("app_settings");
}

export function saveAppSettings(settings: AppSettings): Promise<AppSettings> {
  return invoke<AppSettings>("save_app_settings", { settings });
}

export function checkForUpdate(): Promise<UpdateCheck> {
  return invoke<UpdateCheck>("check_for_update");
}

export function fetchDependencyStatus(): Promise<DependencyStatus[]> {
  return invoke<DependencyStatus[]>("dependency_status");
}

export function installDependency(tool: ToolName): Promise<void> {
  return invoke<void>("dependency_install", { tool });
}
