import { invoke } from "@tauri-apps/api/core";
import type {
  DependencyStatus,
  MirrorDependencyStatus,
  ToolName
} from "../../contracts/dependency";
import type { CookieFileOption } from "../../contracts/types";

export interface AppSettings {
  defaultOutputDirectory: string | null;
  dependencyPreference: "managed" | "system";
  proxy: string | null;
  language: "auto" | "zh" | "en";
  cookieFiles: CookieFileOption[];
}

export type GeneralSettingsDraft = Pick<
  AppSettings,
  "defaultOutputDirectory" | "proxy" | "cookieFiles"
>;

export interface UpdateCheck {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseUrl: string;
}

export function fetchAppSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("app_settings");
}

export function saveAppSettings(settings: GeneralSettingsDraft): Promise<AppSettings> {
  return invoke<AppSettings>("save_app_settings", { settings });
}

export function setDependencyPreference(
  preference: AppSettings["dependencyPreference"]
): Promise<AppSettings> {
  return invoke<AppSettings>("set_dependency_preference", { preference });
}

export function checkForUpdate(): Promise<UpdateCheck> {
  return invoke<UpdateCheck>("check_for_update");
}

export function installUpdate(): Promise<void> {
  return invoke<void>("install_update");
}

export function fetchDependencyStatus(): Promise<DependencyStatus[]> {
  return invoke<DependencyStatus[]>("dependency_status");
}

export function installDependency(tool: ToolName): Promise<void> {
  return invoke<void>("dependency_install", { tool });
}

export function fetchMirrorDependencyStatus(): Promise<MirrorDependencyStatus[]> {
  return invoke<MirrorDependencyStatus[]>("dependency_mirror_status");
}

export function installMirrorDependency(tool: ToolName): Promise<void> {
  return invoke<void>("dependency_install_mirror", { tool });
}
