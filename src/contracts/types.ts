/**
 * 任务系统契约的 TS 镜像（架构文档 §4.2）。
 * Rust 侧真相源：src-tauri/src/core/task/types.rs。
 * 接口稳定后评估 tauri-specta 自动生成，替代本文件的手工维护。
 */

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
