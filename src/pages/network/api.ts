import { invoke } from "@tauri-apps/api/core";
import type { TaskIntent } from "../../contracts/types";

export interface PreviewResult {
  display: string;
  argvRedacted: string[];
  argv: string[];
}

export interface SubmitResult {
  taskId: string;
}

export type ProbeKind = "formats" | "metadata";

export function networkPreview(intent: TaskIntent): Promise<PreviewResult> {
  return invoke<PreviewResult>("network_preview", { intent });
}

export function networkSubmit(intent: TaskIntent): Promise<SubmitResult> {
  return invoke<SubmitResult>("network_submit", { intent });
}

export function networkProbe(intent: TaskIntent, kind: ProbeKind): Promise<string> {
  return invoke<string>("network_probe", { intent, kind });
}
