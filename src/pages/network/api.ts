import { invoke } from "@tauri-apps/api/core";
import type { PreviewResult, SubmitResult, TaskIntent } from "../../contracts/types";

export type { PreviewResult, SubmitResult };

export type ProbeKind = "formats" | "metadata" | "cookie";

export function networkPreview(intent: TaskIntent): Promise<PreviewResult> {
  return invoke<PreviewResult>("network_preview", { intent });
}

export function networkSubmit(intent: TaskIntent): Promise<SubmitResult> {
  return invoke<SubmitResult>("network_submit", { intent });
}

export function networkProbe(intent: TaskIntent, kind: ProbeKind): Promise<string> {
  return invoke<string>("network_probe", { intent, kind });
}
