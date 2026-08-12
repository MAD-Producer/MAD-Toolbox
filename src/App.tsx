import {
  Box,
  Download,
  Film,
  Gauge,
  Home,
  ListVideo,
  Music2,
  ScrollText,
  Settings,
  SlidersHorizontal
} from "lucide-react";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useBackend } from "./hooks/useBackend";
import type {
  MediaInspection,
  DiagnosticExportResult,
  LogExportRequest,
  MusicdlPlaylistRequest,
  MusicdlSearchRequest,
  NavPage,
  RunRequest,
  RunResult
} from "./lib/types";
import { HomePage } from "./pages/HomePage";
import { BilibiliPage } from "./pages/BilibiliPage";
import { NetworkPage } from "./pages/NetworkPage";
import { MediaPage } from "./pages/MediaPage";
import { TasksPage } from "./pages/TasksPage";
import { SettingsPage } from "./pages/SettingsPage";
import { LicensesPage } from "./pages/LicensesPage";
import { MusicPage } from "./pages/MusicPage";
import appIcon from "./assets/app-icon.png";
import { platformLabel } from "./lib/platform";
import packageInfo from "../package.json";

const navItems: Array<{
  page: NavPage;
  label: string;
  icon: typeof Home;
}> = [
  { page: "home", label: "首页", icon: Home },
  { page: "bilibili", label: "哔哩哔哩下载", icon: Film },
  { page: "network", label: "网络视频下载", icon: Download },
  { page: "music", label: "音乐下载", icon: Music2 },
  { page: "media", label: "媒体转换", icon: SlidersHorizontal },
  { page: "streams", label: "封装与抽流", icon: ListVideo },
  { page: "tasks", label: "任务中心", icon: Gauge }
];

const utilityItems: Array<{
  page: NavPage;
  label: string;
  icon: typeof Home;
}> = [
  { page: "settings", label: "设置与分发", icon: Settings },
  { page: "licenses", label: "开源许可", icon: ScrollText }
];

export default function App() {
  const [page, setPage] = useState<NavPage>("home");
  const [toast, setToast] = useState<string | null>(null);
  const backend = useBackend();
  const distributionMode =
    backend.dependencies.some((item) => item.required) &&
    backend.dependencies.every((item) => !item.required || item.bundledAvailable)
      ? "Full"
      : "Lite";

  const showError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    setToast(message);
    window.setTimeout(() => setToast(null), 5000);
  };

  const run = async (request: RunRequest) => {
    try {
      const result = await backend.runTool(request);
      const isBbdownLogin = request.tool === "bbdown" && request.args[0] === "login";
      if (!isBbdownLogin) setPage("tasks");
      return result;
    } catch (error) {
      showError(error);
      throw error;
    }
  };

  const checkNetwork = async (proxy: string) => {
    try {
      return await invoke<boolean>("check_youtube_access", { proxy: proxy || null });
    } catch (error) {
      showError(error);
      return false;
    }
  };

  const inspect = async (path: string) => {
    return invoke<MediaInspection>("inspect_media", { path });
  };

  const expandInputs = async (paths: string[], includeSubtitles: boolean) => {
    return invoke<string[]>("expand_media_inputs", { paths, includeSubtitles });
  };

  const runPrCompatible = async (input: string, outputDirectory: string) => {
    try {
      const result = await invoke("run_pr_compatible", {
        input,
        outputDirectory: outputDirectory || null
      });
      setPage("tasks");
      return result;
    } catch (error) {
      showError(error);
      throw error;
    }
  };

  const searchMusic = async (request: MusicdlSearchRequest) => {
    try {
      return await invoke<RunResult>("musicdl_search", { request });
    } catch (error) {
      showError(error);
      throw error;
    }
  };

  const downloadMusic = async (sessionId: string, indices: number[]) => {
    try {
      const result = await invoke("musicdl_download", { sessionId, indices });
      setPage("tasks");
      return result;
    } catch (error) {
      showError(error);
      throw error;
    }
  };

  const downloadMusicPlaylist = async (request: MusicdlPlaylistRequest) => {
    try {
      const result = await invoke<RunResult>("musicdl_playlist", { request });
      setPage("tasks");
      return result;
    } catch (error) {
      showError(error);
      throw error;
    }
  };

  const renderMusicPage = () => (
    <MusicPage
      dependency={backend.dependencyMap.get("musicdl") ?? null}
      pythonDependency={backend.dependencyMap.get("python") ?? null}
      defaultOutputDirectory={backend.settings.defaultOutputDirectory}
      onRefresh={backend.refreshDependencies}
      onSearch={searchMusic}
      onPlaylist={downloadMusicPlaylist}
      onDownload={downloadMusic}
    />
  );

  const renderPage = () => {
    if (page === "home") {
      return (
        <HomePage
          dependencies={backend.dependencies}
          distributionMode={distributionMode}
          loading={backend.loadingDependencies}
          onRefresh={() => void backend.refreshDependencies()}
          onNavigate={setPage}
        />
      );
    }
    if (page === "bilibili") {
      return (
        <BilibiliPage
          bbdownAvailable={backend.dependencyMap.get("bbdown")?.available ?? false}
          bbdownAuthStatus={backend.bbdownAuthStatus}
          loginQr={backend.loginQr}
          onRun={run}
        />
      );
    }
    if (page === "network") {
      return (
        <NetworkPage
          ytDlpAvailable={backend.dependencyMap.get("yt-dlp")?.available ?? false}
          denoPath={backend.dependencyMap.get("deno")?.path ?? null}
          defaultOutputDirectory={backend.settings.defaultOutputDirectory}
          onRun={run}
          onCheckNetwork={checkNetwork}
        />
      );
    }
    if (page === "media" || page === "streams") {
      return (
        <MediaPage
          key={page}
          pageMode={page === "streams" ? "streams" : "media"}
          ffmpegAvailable={backend.dependencyMap.get("ffmpeg")?.available ?? false}
          ffmpegEncoders={backend.ffmpegEncoders}
          defaultOutputDirectory={backend.settings.defaultOutputDirectory}
          onRun={run}
          onRunPrCompatible={runPrCompatible}
          onInspect={inspect}
          onExpandInputs={expandInputs}
        />
      );
    }
    if (page === "tasks") {
      return (
        <TasksPage
          jobs={backend.jobs}
          logs={backend.logs}
          onCancel={(jobId) => void backend.cancelJob(jobId).catch(showError)}
          onExport={async (request: LogExportRequest) => {
            try {
              return await invoke<DiagnosticExportResult>("export_job_log", { request });
            } catch (error) {
              showError(error);
              throw error;
            }
          }}
        />
      );
    }
    if (page === "settings") {
      return (
        <SettingsPage
          settings={backend.settings}
          distributionMode={distributionMode}
          onSave={async (settings) => {
            const saved = await backend.saveSettings(settings);
            await backend.refreshDependencies();
            return saved;
          }}
        />
      );
    }
    return <LicensesPage />;
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="window-drag" data-tauri-drag-region />
        <div className="brand">
          <span className="brand-icon">
            <img src={appIcon} alt="" />
          </span>
          <span>
            <strong>MAD Toolbox</strong>
            <small>
              v{packageInfo.version} · {distributionMode}
            </small>
          </span>
        </div>
        <nav>
          {navItems.map(({ page: target, label, icon: Icon }) => (
            <button
              type="button"
              key={target}
              className={page === target ? "active" : ""}
              onClick={() => setPage(target)}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <nav className="utility-nav">
          {utilityItems.map(({ page: target, label, icon: Icon }) => (
            <button
              type="button"
              key={target}
              className={page === target ? "active" : ""}
              onClick={() => setPage(target)}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>
        <div className="build-badge">
          <Box size={14} />
          {platformLabel}
        </div>
      </aside>
      <main className="workspace">
        <div className="top-drag" data-tauri-drag-region />
        <div className="page-scroll">
          <div className={`persistent-page ${page === "music" ? "active" : ""}`}>
            {renderMusicPage()}
          </div>
          {page !== "music" && renderPage()}
        </div>
      </main>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
