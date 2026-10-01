import { create } from "zustand";

export const WORKSPACE_IDS = ["bilibili", "network", "music", "media"] as const;

export type WorkspaceId = (typeof WORKSPACE_IDS)[number];

export type WorkspaceStatus = "unmounted" | "retained" | "releasable";

export interface WorkspaceSession {
  status: WorkspaceStatus;
  generation: number;
}

type WorkspaceSessions = Record<WorkspaceId, WorkspaceSession>;

interface WorkspacesStore {
  sessions: WorkspaceSessions;
  visit: (id: WorkspaceId) => void;
  markRetained: (id: WorkspaceId, expectedGeneration: number) => void;
  markReleasable: (id: WorkspaceId, expectedGeneration: number) => void;
  evictIfReleasable: (id: WorkspaceId) => void;
  reset: (id: WorkspaceId) => void;
}

const createInitialSessions = (): WorkspaceSessions =>
  Object.fromEntries(
    WORKSPACE_IDS.map((id) => [id, { status: "unmounted", generation: 0 }])
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
            generation: current.generation + 1
          }
        }
      };
    });
  },

  reset: (id) => {
    set((state) => {
      const current = state.sessions[id];
      return {
        sessions: {
          ...state.sessions,
          [id]: {
            status: current.status === "unmounted" ? "unmounted" : "retained",
            generation: current.generation + 1
          }
        }
      };
    });
  }
}));
