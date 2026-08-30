import type { ToolName } from "./dependency";

export interface JobState {
  jobId: string;
  tool: ToolName;
  state: "running" | "completed" | "failed" | "canceled";
  exitCode: number | null;
  message: string;
}

export interface RunResult {
  jobId: string;
}
