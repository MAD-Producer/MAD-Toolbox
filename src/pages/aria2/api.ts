import { invoke } from "@tauri-apps/api/core";
import type { PreviewResult, SubmitResult, TaskIntent } from "../../contracts/types";

export type { PreviewResult, SubmitResult };

export interface TrackerListResult {
  trackers: string[];
  fetchedAt: string;
  cached: boolean;
}

export function aria2Preview(intent: TaskIntent): Promise<PreviewResult> {
  return invoke<PreviewResult>("aria2_preview", { intent });
}

export function aria2Submit(intent: TaskIntent): Promise<SubmitResult> {
  return invoke<SubmitResult>("aria2_submit", { intent });
}

export function aria2TrackerList(refresh: boolean): Promise<TrackerListResult> {
  return invoke<TrackerListResult>("aria2_tracker_list", { refresh });
}
