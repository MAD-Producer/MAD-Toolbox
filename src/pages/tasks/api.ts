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

export function exportTaskDiagnostics(taskId: string, targetPath: string): Promise<void> {
  return invoke<void>("task_export_diagnostics", { taskId, targetPath });
}
