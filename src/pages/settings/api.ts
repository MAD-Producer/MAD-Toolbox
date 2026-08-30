import { invoke } from "@tauri-apps/api/core";
import type { DependencyStatus, ToolName } from "../../contracts/dependency";

export interface AppSettings {
  defaultOutputDirectory: string | null;
  dependencyPreference: "bundled" | "system";
  proxy: string | null;
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

export function installUpdate(useMirror: boolean): Promise<void> {
  return invoke<void>("install_update", { useMirror });
}

export function fetchDependencyStatus(): Promise<DependencyStatus[]> {
  return invoke<DependencyStatus[]>("dependency_status");
}

export function installDependency(tool: ToolName): Promise<void> {
  return invoke<void>("dependency_install", { tool });
}
