import { invoke } from "@tauri-apps/api/core";
import type { RunResult } from "../../contracts/job";
import type { MusicdlCliOptions, MusicFormState } from "./configuration";

export interface SubmitResult {
  taskId: string;
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
  downsample: boolean;
}

export interface MusicdlSearchResult {
  index: number;
  songName: string;
  singers: string;
  album: string;
  extension: string;
  fileSize: string;
  fileSizeBytes: number | null;
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

export function previewMusicCommand(request: MusicdlCliOptions): Promise<string> {
  return invoke<string>("musicdl_preview", { request });
}

export function musicdlSearch(request: MusicdlSearchRequest): Promise<RunResult> {
  return invoke<RunResult>("musicdl_search", { request });
}

export function musicdlSearchCancel(jobId: string): Promise<void> {
  return invoke<void>("musicdl_search_cancel", { jobId });
}

export function musicdlSessionRelease(sessionId: string): Promise<void> {
  return invoke<void>("musicdl_session_release", { sessionId });
}

export function musicdlDownload(
  sessionId: string,
  indices: number[],
  downsample: boolean,
  form: MusicFormState
): Promise<SubmitResult> {
  return invoke<SubmitResult>("musicdl_download", { sessionId, indices, downsample, form });
}

export function musicdlPlaylist(
  request: MusicdlPlaylistRequest,
  form: MusicFormState
): Promise<SubmitResult> {
  return invoke<SubmitResult>("musicdl_playlist", { request, form });
}
