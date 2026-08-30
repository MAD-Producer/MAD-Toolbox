export type Feature = "bilibili" | "network" | "media" | "music";

export type Pool = "download" | "local";

export type TaskStatus =
  "queued" | "running" | "canceling" | "success" | "failed" | "canceled" | "interrupted";

export type TaskIntent =
  { type: "form"; data: Record<string, unknown> } | { type: "manual"; data: { argv: string[] } };

export interface TaskProgress {
  percent: number | null;
  detail: string | null;
}

export interface TaskEnvelope {
  id: string;
  feature: Feature;
  pool: Pool;
  title: string;
  status: TaskStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  tool: string;
  toolVersion: string | null;

  argvRedacted: string[];
  workingDir: string | null;
  outputPaths: string[];
  exitCode: number | null;
  logPath: string | null;
  intent: TaskIntent;

  progress?: TaskProgress;
}

export interface TaskSeed {
  task: TaskEnvelope;
  purpose: "rerun" | "reuse";
}

export type LogStream = "stdout" | "stderr" | "system";

export type TaskEvent =
  | { type: "changed"; data: TaskEnvelope }
  | { type: "log"; data: { taskId: string; stream: LogStream; line: string; seq: number } }
  | { type: "progress"; data: { taskId: string; progress: TaskProgress } }
  | { type: "custom"; data: { taskId: string; name: string; payload: unknown } };
