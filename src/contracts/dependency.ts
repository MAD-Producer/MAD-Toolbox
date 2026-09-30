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
  healthCheckFailed: boolean;
  healthCheckError: string | null;
  installCommand: string | null;
  installShell: "PowerShell" | "sh";
  required: boolean;
  installHint: string | null;
}
