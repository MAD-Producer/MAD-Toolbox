export type ToolName =
  "bbdown" | "yt-dlp" | "musicdl" | "ffmpeg" | "ffprobe" | "mediainfo" | "deno" | "python";

export interface DependencyStatus {
  tool: ToolName;
  label: string;
  available: boolean;
  managedAvailable: boolean;
  systemAvailable: boolean;
  source: "managed" | "system" | null;
  path: string | null;
  version: string | null;
  healthCheckFailed: boolean;
  healthCheckError: string | null;
  installCommand: string | null;
  installShell: "PowerShell" | "sh";
  required: boolean;
  installHint: string | null;
}

export interface ManagedDependency {
  version: string;
  fileName: string;
  sha256: string;
  executables: Partial<Record<ToolName, string>>;
}

export interface DependencyDownloadProgress {
  tool: ToolName;
  received: number;
  total: number | null;
}

export interface MirrorDependencyStatus extends ManagedDependency {
  tool: ToolName;
  size: number;
  installedVersion: string | null;
  updateAvailable: boolean;
}
