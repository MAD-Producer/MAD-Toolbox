export type ToolName =
  "bbdown" | "yt-dlp" | "musicdl" | "ffmpeg" | "ffprobe" | "mediainfo" | "deno" | "python";

export interface DependencyStatus {
  tool: ToolName;
  label: string;
  available: boolean;
  bundled: boolean;
  bundledAvailable: boolean;
  systemAvailable: boolean;
  source: "bundled" | "system" | null;
  path: string | null;
  version: string | null;
  required: boolean;
  installHint: string | null;
}

export interface JobLog {
  jobId: string;
  tool: ToolName;
  stream: "system" | "stdout" | "stderr";
  line: string;
  timestamp: string;
}

export interface JobState {
  jobId: string;
  tool: ToolName;
  state: "running" | "completed" | "failed" | "cancelled";
  exitCode: number | null;
  message: string;
}

export interface DiagnosticExportRequest {
  job: JobState;
  logs: JobLog[];
  outputPath: string;
  includeLogs: boolean;
  includeDependencyPaths: boolean;
  redactPersonalData: boolean;
}

export interface DiagnosticExportResult {
  path: string;
}

export interface LogExportRequest {
  job: JobState;
  logs: JobLog[];
  outputPath: string;
}

export interface RunRequest {
  tool: ToolName;
  args: string[];
  workingDir?: string | null;
}

export interface RunResult {
  jobId: string;
}

export interface AppSettings {
  defaultOutputDirectory: string | null;
  dependencyPreference: "bundled" | "system";
}

export interface LoginQr {
  jobId: string;
  dataUrl: string;
}

export type BbdownAuthStatus = "unknown" | "authenticated" | "unauthenticated";

export interface MediaInspection {
  path: string;
  summary: string;
}

export interface MusicdlSearchRequest {
  keyword: string;
  musicSources: string[];
  initMusicClientsCfg: Record<string, unknown>;
  requestsOverrides: Record<string, unknown>;
  clientsThreadings: Record<string, unknown>;
  searchRules: Record<string, unknown>;
  outputDirectory: string | null;
  searchSizePerSource: number;
}

export interface MusicdlPlaylistRequest {
  playlistUrl: string;
  musicSources: string[];
  initMusicClientsCfg: Record<string, unknown>;
  requestsOverrides: Record<string, unknown>;
  clientsThreadings: Record<string, unknown>;
  searchRules: Record<string, unknown>;
  outputDirectory: string | null;
}

export interface MusicdlSearchResult {
  index: number;
  songName: string;
  singers: string;
  album: string;
  extension: string;
  fileSize: string;
  duration: string;
  bitrate: number | null;
  codec: string;
  sampleRate: number | null;
  channels: number | null;
  source: string;
  rootSource: string;
  coverUrl: string | null;
  lossless: boolean;
}

export interface MusicdlSearchResponse {
  sessionId: string;
  results: MusicdlSearchResult[];
}

export type NavPage =
  | "home"
  | "bilibili"
  | "network"
  | "music"
  | "media"
  | "streams"
  | "tasks"
  | "settings"
  | "licenses";
