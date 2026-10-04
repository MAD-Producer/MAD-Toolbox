import type { MediaOperation, TaskEnvelope } from "../contracts/types";

export type MediaPageId =
  "pr-compatible" | "transcode" | "remux" | "extract" | "gif" | "image-export";

export type SettingsPageId = "general" | "dependencies" | "about";

export type AppRoute =
  | { section: "tasks" }
  | { section: "bilibili" }
  | { section: "network" }
  | { section: "music" }
  | { section: "media"; page: MediaPageId }
  | { section: "settings"; page: SettingsPageId };

export type AppSection = AppRoute["section"];

export type MediaRoute = Extract<AppRoute, { section: "media" }>;
export type SettingsRoute = Extract<AppRoute, { section: "settings" }>;

export const DEFAULT_APP_ROUTE = { section: "tasks" } as const satisfies AppRoute;

const MEDIA_PAGE_BY_OPERATION: Record<MediaOperation, MediaPageId> = {
  remux: "remux",
  transcode: "transcode",
  "video-extract": "extract",
  audio: "extract",
  "subtitle-extract": "extract",
  thumbnail: "image-export",
  gif: "gif",
  frames: "image-export"
};

function mediaPageForTask(task: TaskEnvelope): MediaPageId {
  if (task.intent.type === "manual") return "transcode";
  if (task.intent.data.prCompatible === true) return "pr-compatible";

  const operation = task.intent.data.operation;
  if (typeof operation !== "string" || !(operation in MEDIA_PAGE_BY_OPERATION)) {
    return "transcode";
  }

  return MEDIA_PAGE_BY_OPERATION[operation as MediaOperation];
}

export function routeForTask(task: TaskEnvelope): AppRoute {
  switch (task.feature) {
    case "bilibili":
      return { section: "bilibili" };
    case "network":
      return { section: "network" };
    case "media":
      return { section: "media", page: mediaPageForTask(task) };
    case "music":
      return { section: "music" };
  }
}
