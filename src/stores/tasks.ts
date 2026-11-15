import { listen } from "@tauri-apps/api/event";
import { create } from "zustand";
import type { TaskEvent } from "../contracts/types";
import { cancelTask, deleteTasks, fetchTasksSnapshot, promoteTask } from "../pages/tasks/api";
import {
  applySnapshot,
  applyTaskEvent,
  emptyTasksState,
  removeTasks,
  type TasksState
} from "./tasks.reducer";

interface TasksStore extends TasksState {
  init: () => Promise<void>;
  cancel: (taskId: string) => void;
  promote: (taskId: string) => void;
  remove: (taskIds: string[]) => Promise<string[]>;
}

let initStarted = false;

export const useTasksStore = create<TasksStore>((set, get) => ({
  ...emptyTasksState,

  init: async () => {
    if (initStarted) return;
    initStarted = true;
    let unlisten: (() => void) | null = null;
    try {
      const off = await listen<TaskEvent>("task-event", (event) => {
        set((state) => applyTaskEvent(state, event.payload));
      });
      unlisten = off;
      const snapshot = await fetchTasksSnapshot();
      set((state) => applySnapshot(state, snapshot));
    } catch (error) {
      // 快照拉取失败时先注销本次监听再放行重试，否则重试路径会双订 task-event
      unlisten?.();
      initStarted = false;
      console.warn("tasks store init failed:", error);
    }
  },

  cancel: (taskId) => {
    void cancelTask(taskId);
  },
  promote: (taskId) => {
    void promoteTask(taskId);
  },

  remove: async (taskIds) => {
    if (import.meta.env.DEV && !("__TAURI_INTERNALS__" in window)) {
      set((state) => removeTasks(state, taskIds));
      return taskIds;
    }
    const deleted = await deleteTasks(taskIds);
    set((state) => removeTasks(state, deleted));
    return deleted;
  }
}));
