import { invoke } from "@tauri-apps/api/core";
import type { Pool, TaskEnvelope } from "../../contracts/types";

export interface PoolDefinition {
  pool: Pool;
  capacity: number;
}

export function fetchPoolDefinitions(): Promise<PoolDefinition[]> {
  return invoke<PoolDefinition[]>("pool_definitions");
}

export function fetchTasksSnapshot(): Promise<TaskEnvelope[]> {
  return invoke<TaskEnvelope[]>("tasks_snapshot");
}

export function cancelTask(taskId: string): Promise<void> {
  return invoke<void>("task_cancel", { taskId });
}

export function promoteTask(taskId: string): Promise<void> {
  return invoke<void>("task_promote", { taskId });
}

export function deleteTasks(taskIds: string[]): Promise<string[]> {
  return invoke<string[]>("task_delete", { taskIds });
}

/** Rust 侧返回导出的诊断文件路径，当前调用方不消费 */
export function exportTaskDiagnostics(taskId: string, targetPath: string): Promise<string> {
  return invoke<string>("task_export_diagnostics", { taskId, targetPath });
}
