import type { Pool, TaskEnvelope, TaskEvent } from "../contracts/types";

export interface TaskLogLine {
  stream: string;
  line: string;
  seq: number;
}

export interface TasksState {
  tasks: Record<string, TaskEnvelope>;

  logs: Record<string, TaskLogLine[]>;
}

export const MAX_LOG_LINES = 200;

export const emptyTasksState: TasksState = { tasks: {}, logs: {} };

export function applyTaskEvent(state: TasksState, event: TaskEvent): TasksState {
  switch (event.type) {
    case "changed": {
      const envelope = event.data;
      const lastProgress = envelope.progress ?? state.tasks[envelope.id]?.progress;
      const merged = lastProgress ? { ...envelope, progress: lastProgress } : envelope;
      return { ...state, tasks: { ...state.tasks, [envelope.id]: merged } };
    }
    case "log": {
      const { taskId, stream, line, seq } = event.data;
      if (!state.tasks[taskId]) return state;
      const existing = state.logs[taskId] ?? [];
      const appended = [...existing, { stream, line, seq }];
      const capped = appended.length > MAX_LOG_LINES ? appended.slice(-MAX_LOG_LINES) : appended;
      return { ...state, logs: { ...state.logs, [taskId]: capped } };
    }
    case "progress": {
      const { taskId, progress } = event.data;
      const task = state.tasks[taskId];
      if (!task) return state;
      return { ...state, tasks: { ...state.tasks, [taskId]: { ...task, progress } } };
    }
  }
}

export function applySnapshot(state: TasksState, snapshot: TaskEnvelope[]): TasksState {
  const tasks = { ...state.tasks };
  for (const envelope of snapshot) {
    if (!tasks[envelope.id]) {
      tasks[envelope.id] = envelope;
    }
  }
  return { ...state, tasks };
}

export function removeTasks(state: TasksState, ids: string[]): TasksState {
  if (ids.length === 0) return state;
  const removing = new Set(ids);
  const tasks: TasksState["tasks"] = {};
  const logs: TasksState["logs"] = {};
  for (const [id, envelope] of Object.entries(state.tasks)) {
    if (!removing.has(id)) tasks[id] = envelope;
  }
  for (const [id, lines] of Object.entries(state.logs)) {
    if (!removing.has(id)) logs[id] = lines;
  }
  return { tasks, logs };
}

export function poolOccupancy(state: TasksState, pool: Pool): number {
  return Object.values(state.tasks).filter(
    (t) => t.pool === pool && (t.status === "running" || t.status === "canceling")
  ).length;
}

export function sortedTasks(state: TasksState): TaskEnvelope[] {
  return Object.values(state.tasks).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function splitByDay(tasks: TaskEnvelope[]): {
  today: TaskEnvelope[];
  history: TaskEnvelope[];
} {
  const todayKey = new Date().toDateString();
  const today: TaskEnvelope[] = [];
  const history: TaskEnvelope[] = [];
  for (const task of tasks) {
    (new Date(task.createdAt).toDateString() === todayKey ? today : history).push(task);
  }
  return { today, history };
}
