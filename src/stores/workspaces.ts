import { create } from "zustand";
import type { TaskSeed } from "../contracts/types";

export const WORKSPACE_IDS = ["bilibili", "network", "aria2", "music", "media"] as const;

export type WorkspaceId = (typeof WORKSPACE_IDS)[number];

export type WorkspaceStatus = "unmounted" | "retained" | "releasable";

export interface WorkspaceSession {
  status: WorkspaceStatus;
  generation: number;
  /** 待交付的任务种子：deliver 写入、目标页 mount 时消费、evict 时清除 */
  seed: TaskSeed | null;
}

type WorkspaceSessions = Record<WorkspaceId, WorkspaceSession>;

interface WorkspacesStore {
  sessions: WorkspaceSessions;
  visit: (id: WorkspaceId) => void;
  /** 交付任务种子并重置会话（generation+1 触发目标页重挂，初始化器恰好消费一次） */
  deliver: (id: WorkspaceId, seed: TaskSeed) => void;
  markRetained: (id: WorkspaceId, expectedGeneration: number) => void;
  markReleasable: (id: WorkspaceId, expectedGeneration: number) => void;
  evictIfReleasable: (id: WorkspaceId) => void;
}

const createInitialSessions = (): WorkspaceSessions =>
  Object.fromEntries(
    WORKSPACE_IDS.map((id) => [id, { status: "unmounted", generation: 0, seed: null }])
  ) as WorkspaceSessions;

export const useWorkspacesStore = create<WorkspacesStore>((set) => ({
  sessions: createInitialSessions(),

  visit: (id) => {
    set((state) => {
      const current = state.sessions[id];
      if (current.status === "retained") return state;
      return {
        sessions: {
          ...state.sessions,
          [id]: { ...current, status: "retained" }
        }
      };
    });
  },

  deliver: (id, seed) => {
    set((state) => {
      const current = state.sessions[id];
      return {
        sessions: {
          ...state.sessions,
          [id]: {
            status: current.status === "unmounted" ? "unmounted" : "retained",
            generation: current.generation + 1,
            seed
          }
        }
      };
    });
  },

  markRetained: (id, expectedGeneration) => {
    set((state) => {
      const current = state.sessions[id];
      if (
        current.status === "unmounted" ||
        current.generation !== expectedGeneration ||
        current.status === "retained"
      ) {
        return state;
      }
      return {
        sessions: {
          ...state.sessions,
          [id]: { ...current, status: "retained" }
        }
      };
    });
  },

  markReleasable: (id, expectedGeneration) => {
    set((state) => {
      const current = state.sessions[id];
      if (
        current.status === "unmounted" ||
        current.generation !== expectedGeneration ||
        current.status === "releasable"
      ) {
        return state;
      }
      return {
        sessions: {
          ...state.sessions,
          [id]: { ...current, status: "releasable" }
        }
      };
    });
  },

  evictIfReleasable: (id) => {
    set((state) => {
      const current = state.sessions[id];
      if (current.status !== "releasable") return state;
      return {
        sessions: {
          ...state.sessions,
          [id]: {
            status: "unmounted",
            generation: current.generation + 1,
            seed: null
          }
        }
      };
    });
  }
}));
