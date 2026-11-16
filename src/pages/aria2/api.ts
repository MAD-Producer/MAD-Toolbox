import { invoke } from "@tauri-apps/api/core";
import type { PreviewResult, SubmitResult, TaskIntent } from "../../contracts/types";
import type { TrackerSource } from "./form";

export type { PreviewResult, SubmitResult, TrackerSource };

export interface TrackerListResult {
  source: TrackerSource;
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

export function aria2TrackerList(
  source: TrackerSource,
  refresh: boolean
): Promise<TrackerListResult> {
  return invoke<TrackerListResult>("aria2_tracker_list", { source, refresh });
}
