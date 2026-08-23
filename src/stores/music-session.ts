import { notifications } from "../lib/notifications";
import { listen } from "@tauri-apps/api/event";
import { create } from "zustand";
import type { JobState, RunResult } from "../contracts/job";
import { t } from "../locale";
import {
  musicdlSearch,
  musicdlSearchCancel,
  musicdlSessionRelease,
  type MusicdlSearchRequest,
  type MusicdlSearchResponse
} from "../pages/music/api";

interface PendingSearchEvents {
  response?: MusicdlSearchResponse;
  terminal?: JobState;
}

export type MusicSessionPhase =
  "idle" | "ready" | "starting" | "searching" | "canceling" | "releasing";

interface MusicSessionStore {
  initialized: boolean;
  phase: MusicSessionPhase;
  jobId: string | null;
  response: MusicdlSearchResponse | null;
  queuedIndices: number[];
  error: string | null;
  init: () => Promise<void>;
  startSearch: (request: MusicdlSearchRequest) => Promise<RunResult>;
  cancelSearch: () => Promise<void>;
  releaseSession: () => Promise<void>;
  markQueued: (sessionId: string, indices: number[]) => boolean;
}

let initPromise: Promise<void> | null = null;
let startPromise: Promise<RunResult> | null = null;
let cancelPromise: Promise<void> | null = null;
let releasePromise: Promise<void> | null = null;
const pendingEvents = new Map<string, PendingSearchEvents>();

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const useMusicSessionStore = create<MusicSessionStore>((set, get) => {
  const finishSearch = (terminal: JobState, response: MusicdlSearchResponse | null) => {
    if (terminal.state === "completed" && response) {
      set({ phase: "ready", jobId: null, response, error: null });
      return;
    }
    set({
      phase: "idle",
      jobId: null,
      response: null,
      queuedIndices: [],
      error: terminal.state === "failed" ? terminal.message : null
    });
  };

  const handleResponse = (payload: MusicdlSearchResponse) => {
    const state = get();
    if (payload.sessionId === state.jobId) {
      const pending = pendingEvents.get(payload.sessionId);
      pendingEvents.delete(payload.sessionId);
      if (pending?.terminal) {
        finishSearch(pending.terminal, payload);
      } else {
        set({ response: payload, queuedIndices: [], error: null });
      }
      return;
    }
    if (state.phase === "starting") {
      const pending = pendingEvents.get(payload.sessionId) ?? {};
      pending.response = payload;
      pendingEvents.set(payload.sessionId, pending);
    }
  };

  const handleJobState = (payload: JobState) => {
    if (payload.tool !== "musicdl" || payload.state === "running") return;

    const state = get();
    if (payload.jobId === state.jobId) {
      const response = state.response?.sessionId === payload.jobId ? state.response : null;
      if (payload.state === "completed" && response === null) {
        const pending = pendingEvents.get(payload.jobId) ?? {};
        pending.terminal = payload;
        pendingEvents.set(payload.jobId, pending);
        return;
      }
      pendingEvents.delete(payload.jobId);
      finishSearch(payload, response);
      return;
    }
    if (state.phase === "starting") {
      const pending = pendingEvents.get(payload.jobId) ?? {};
      pending.terminal = payload;
      pendingEvents.set(payload.jobId, pending);
    }
  };

  return {
    initialized: false,
    phase: "idle",
    jobId: null,
    response: null,
    queuedIndices: [],
    error: null,

    init: () => {
      if (initPromise) return initPromise;
      initPromise = (async () => {
        const unlistenResult = await listen<MusicdlSearchResponse>(
          "musicdl-search-result",
          ({ payload }) => handleResponse(payload)
        );
        try {
          await listen<JobState>("job-state", ({ payload }) => handleJobState(payload));
          set({ initialized: true });
        } catch (error) {
          unlistenResult();
          throw error;
        }
      })().catch((error) => {
        initPromise = null;
        throw error;
      });
      return initPromise;
    },

    startSearch: (request) => {
      if (startPromise) return startPromise;
      const current = get();
      if (current.phase !== "idle" && current.phase !== "ready") {
        return Promise.reject(new Error(t("music.sessionBusy")));
      }

      const previousSessionId = current.response?.sessionId ?? null;
      set({ phase: "starting", error: null });
      pendingEvents.clear();
      startPromise = (async () => {
        try {
          await get().init();
          const result = await musicdlSearch(request);
          const pending = pendingEvents.get(result.jobId);
          pendingEvents.clear();

          if (previousSessionId && previousSessionId !== result.jobId) {
            void musicdlSessionRelease(previousSessionId).catch((error) =>
              notifications.show({
                color: "red",
                message: t("music.sessionCleanupFailed", { message: errorMessage(error) })
              })
            );
          }

          if (pending?.terminal && pending.terminal.state !== "completed") {
            finishSearch(pending.terminal, pending.response ?? null);
          } else if (pending?.terminal && pending.response) {
            finishSearch(pending.terminal, pending.response);
          } else {
            if (pending?.terminal) {
              pendingEvents.set(result.jobId, { terminal: pending.terminal });
            }
            set({
              phase: "searching",
              jobId: result.jobId,
              response: pending?.response ?? null,
              queuedIndices: [],
              error: null
            });
          }
          return result;
        } catch (error) {
          pendingEvents.clear();
          set((state) => ({
            phase: state.response ? "ready" : "idle",
            jobId: null,
            error: errorMessage(error)
          }));
          throw error;
        } finally {
          startPromise = null;
        }
      })();
      return startPromise;
    },

    cancelSearch: () => {
      if (cancelPromise) return cancelPromise;
      const jobId = get().jobId;
      if (!jobId || (get().phase !== "searching" && get().phase !== "canceling")) {
        return Promise.resolve();
      }

      set({ phase: "canceling", error: null });
      cancelPromise = musicdlSearchCancel(jobId)
        .catch((error) => {
          if (get().jobId === jobId) {
            set({ phase: "searching", error: errorMessage(error) });
          }
          throw error;
        })
        .finally(() => {
          cancelPromise = null;
        });
      return cancelPromise;
    },

    releaseSession: () => {
      if (releasePromise) return releasePromise;
      const state = get();
      const sessionId = state.response?.sessionId;
      if (!sessionId || state.phase !== "ready") return Promise.resolve();

      set({ phase: "releasing", error: null });
      releasePromise = musicdlSessionRelease(sessionId)
        .then(() => {
          if (get().response?.sessionId === sessionId) {
            set({
              phase: "idle",
              jobId: null,
              response: null,
              queuedIndices: [],
              error: null
            });
          }
        })
        .catch((error) => {
          if (get().response?.sessionId === sessionId) {
            set({ phase: "ready", error: errorMessage(error) });
          }
          throw error;
        })
        .finally(() => {
          releasePromise = null;
        });
      return releasePromise;
    },

    markQueued: (sessionId, indices) => {
      if (get().response?.sessionId !== sessionId) return false;
      set((state) => ({
        queuedIndices: Array.from(new Set([...state.queuedIndices, ...indices])).sort(
          (left, right) => left - right
        )
      }));
      return true;
    }
  };
});
