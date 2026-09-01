import { invoke } from "@tauri-apps/api/core";
import type { RunResult } from "../../contracts/job";
import type { TaskIntent } from "../../contracts/types";

export interface PreviewResult {
  display: string;
  argvRedacted: string[];

  argv: string[];
}

export interface SubmitResult {
  taskId: string;
}

export function bilibiliPreview(intent: TaskIntent): Promise<PreviewResult> {
  return invoke<PreviewResult>("bilibili_preview", { intent });
}

export function bilibiliSubmit(intent: TaskIntent): Promise<SubmitResult> {
  return invoke<SubmitResult>("bilibili_submit", { intent });
}

export function bilibiliLoginStart(): Promise<RunResult> {
  return invoke<RunResult>("bilibili_login_start");
}

export function bilibiliLoginStatus(): Promise<boolean> {
  return invoke<boolean>("bilibili_login_status");
}

export function bilibiliLogout(): Promise<void> {
  return invoke<void>("bilibili_logout");
}
