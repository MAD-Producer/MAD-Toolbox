import { Fragment, useEffect, useRef, useState } from "react";
import { useMantineColorScheme } from "@mantine/core";
import { listen } from "@tauri-apps/api/event";
import { notifications } from "../lib/notifications";
import { useBackend } from "../hooks/useBackend";
import { useTasksStore } from "../stores/tasks";
import type { ToolName } from "../contracts/dependency";
import type { TaskEnvelope, TaskSeed } from "../contracts/types";
import { setAppLanguage, syncNativeWindowTheme } from "./api";
import { checkForUpdate } from "../pages/settings/api";
import { useUpdateStore } from "../stores/update";
import { AppShell } from "../components/layout/AppShell";
import { SplashScreen } from "../components/layout/SplashScreen";
import {
  StartupTipsModal,
  isStartupTipsDismissedToday
} from "../components/layout/StartupTipsModal";
import {
  WorkspaceSessionHost,
  type WorkspaceDefinition
} from "../components/layout/WorkspaceSessionHost";
import { BilibiliPage } from "../pages/bilibili/BilibiliPage";
import { NetworkVideoPage } from "../pages/network/NetworkVideoPage";
import { MediaWorkspace } from "../pages/media/MediaWorkspace";
import { MusicPage } from "../pages/music/MusicPage";
import { TasksPage } from "../pages/tasks/TasksPage";
import { GeneralSettingsPage } from "../pages/settings/GeneralSettingsPage";
import { DependenciesSettingsPage } from "../pages/settings/DependenciesSettingsPage";
import { AboutSettingsPage } from "../pages/settings/AboutSettingsPage";
import { SettingsShell } from "../pages/settings/SettingsShell";
import { useBilibiliLoginStore } from "../stores/bilibili-login";
import { useMusicSessionStore } from "../stores/music-session";
import { useWorkspacesStore, type WorkspaceId } from "../stores/workspaces";
import { musicdlDownload, musicdlPlaylist, type MusicdlPlaylistRequest } from "../pages/music/api";
import type { MusicFormState } from "../pages/music/configuration";
import { L1_NAVIGATION } from "./navigation";
import {
  currentLanguage,
  onLanguageChanged,
  resolveChoice,
  setLanguageChoice,
  t,
  type LanguageChoice
} from "../locale";
import {
  DEFAULT_APP_ROUTE,
  routeForTask,
  type AppRoute,
  type AppSection,
  type MediaPageId,
  type SettingsPageId
} from "./route";

function workspaceIdForRoute(route: AppRoute): WorkspaceId | null {
  if (route.section === "bilibili" || route.section === "network" || route.section === "music") {
    return route.section;
  }
  if (route.section === "media") return "media";
  return null;
}

const FEATURE_DEPENDENCIES: Record<WorkspaceId, readonly ToolName[]> = {
  bilibili: ["bbdown"],
  network: ["yt-dlp"],
  music: ["musicdl", "python"],
  media: ["ffmpeg"]
};

export default function App() {
  const [route, setRoute] = useState<AppRoute>(DEFAULT_APP_ROUTE);
  const [lastMediaPage, setLastMediaPage] = useState<MediaPageId>("pr-compatible");
  const [lastSettingsPage, setLastSettingsPage] = useState<SettingsPageId>("general");
  const [lastMainSection, setLastMainSection] = useState<AppSection>("tasks");
  const [taskSeed, setTaskSeed] = useState<TaskSeed | null>(null);
  const [booted, setBooted] = useState(false);
  const [tipsOpened, setTipsOpened] = useState(false);
  const [lang, setLang] = useState(currentLanguage());
  const backend = useBackend();
  const initTasksStore = useTasksStore((s) => s.init);
  const activeTaskCount = useTasksStore(
    (state) =>
      Object.values(state.tasks).filter((task) =>
        ["queued", "running", "canceling"].includes(task.status)
      ).length
  );
  const initBilibiliLogin = useBilibiliLoginStore((state) => state.init);
  const initMusicSession = useMusicSessionStore((state) => state.init);
  const markWorkspaceRetained = useWorkspacesStore((state) => state.markRetained);
  const markWorkspaceReleasable = useWorkspacesStore((state) => state.markReleasable);

  useEffect(() => {
    void initTasksStore();
    void initBilibiliLogin();
    void initMusicSession();
  }, [initBilibiliLogin, initMusicSession, initTasksStore]);

  useEffect(() => {
    checkForUpdate()
      .then((result) => {
        if (result.updateAvailable) useUpdateStore.getState().setUpdate(result);
      })
      .catch((error) => console.warn("startup update check failed:", error));
  }, []);

  useEffect(() => {
    const promise = listen<{ received: number; total: number | null }>(
      "update-download-progress",
      (event) => {
        const { received, total } = event.payload;
        useUpdateStore.getState().setDownloadProgress(received, total);
      }
    );
    return () => {
      void promise.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    if (route.section !== "settings") setLastMainSection(route.section);
  }, [route.section]);

  const { colorScheme } = useMantineColorScheme();
  useEffect(() => {
    void syncNativeWindowTheme(colorScheme);
  }, [colorScheme]);

  useEffect(() => {
    setBooted(true);
    if (!isStartupTipsDismissedToday()) setTipsOpened(true);
  }, []);

  useEffect(() => onLanguageChanged(() => setLang(currentLanguage())), []);

  useEffect(() => {
    const backendChoice: LanguageChoice = backend.settings.language ?? "auto";
    if (resolveChoice(backendChoice) !== currentLanguage()) setLanguageChoice(backendChoice);
  }, [backend.settings.language]);

  const distributionMode =
    backend.dependencies.some((item) => item.required) &&
    backend.dependencies.every((item) => !item.required || item.bundledAvailable)
      ? "Full"
      : "Lite";
  const missingDependencyCount = backend.dependencies.filter(
    (dependency) => dependency.required && !dependency.available
  ).length;

  const dependenciesReady = backend.dependencies.length > 0;
  const missingLabelsFor = (feature: WorkspaceId) =>
    dependenciesReady
      ? FEATURE_DEPENDENCIES[feature]
          .filter((tool) => !backend.dependencyMap.get(tool)?.available)
          .map((tool) => backend.dependencyMap.get(tool)?.label ?? tool)
      : [];
  const openDependencySettings = () => {
    setLastSettingsPage("dependencies");
    setRoute({ section: "settings", page: "dependencies" });
  };

  const openGeneralSettings = () => {
    setLastSettingsPage("general");
    setRoute({ section: "settings", page: "general" });
  };

  const openUpdateSettings = () => {
    setLastSettingsPage("about");
    setRoute({ section: "settings", page: "about" });
  };

  const dependencyNotifiedRef = useRef(false);
  useEffect(() => {
    if (backend.loadingDependencies || !dependenciesReady || dependencyNotifiedRef.current) return;
    dependencyNotifiedRef.current = true;
    const missing = backend.dependencies.filter((item) => item.required && !item.available);
    if (missing.length === 0) return;
    notifications.show({
      color: "yellow",
      title: t("app.dependenciesMissingTitle"),
      message: t("app.dependenciesMissingBody", {
        count: missing.length,
        names: missing.map((item) => item.label)
      })
    });
  }, [backend.loadingDependencies, backend.dependencies, dependenciesReady]);

  const showError = (error: unknown) => {
    notifications.show({
      color: "red",
      message: error instanceof Error ? error.message : String(error)
    });
  };

  const changeLanguage = (choice: LanguageChoice) => {
    setLanguageChoice(choice);
    void setAppLanguage(choice)
      .then(() => backend.refreshSettings())
      .catch(showError);
  };

  const downloadMusic = async (
    sessionId: string,
    indices: number[],
    downsample: boolean,
    form: MusicFormState
  ) => {
    try {
      return await musicdlDownload(sessionId, indices, downsample, form);
    } catch (error) {
      showError(error);
      throw error;
    }
  };

  const downloadMusicPlaylist = async (request: MusicdlPlaylistRequest, form: MusicFormState) => {
    try {
      return await musicdlPlaylist(request, form);
    } catch (error) {
      showError(error);
      throw error;
    }
  };

  const navigatePrimary = (section: AppSection) => {
    if (section === "media") {
      setRoute({ section, page: lastMediaPage });
      return;
    }
    if (section === "settings") {
      setRoute({ section, page: lastSettingsPage });
      return;
    }
    setRoute({ section });
  };

  const navigateSecondary = (page: MediaPageId | SettingsPageId) => {
    if (route.section === "media") {
      const mediaPage = page as MediaPageId;
      setLastMediaPage(mediaPage);
      setRoute({ section: "media", page: mediaPage });
    } else if (route.section === "settings") {
      const settingsPage = page as SettingsPageId;
      setLastSettingsPage(settingsPage);
      setRoute({ section: "settings", page: settingsPage });
    }
  };

  const seedTaskIntoWorkspace = (task: TaskEnvelope, purpose: TaskSeed["purpose"]) => {
    const target = routeForTask(task);
    const targetWorkspace = workspaceIdForRoute(target);
    if (targetWorkspace !== null) {
      const session = useWorkspacesStore.getState().sessions[targetWorkspace];
      if (
        session.mounted &&
        session.phase === "retained" &&
        !window.confirm(t("app.confirmDiscardDraft"))
      ) {
        return;
      }
      useWorkspacesStore.getState().reset(targetWorkspace);
    }
    setTaskSeed({ task, purpose });
    if (target.section === "media") setLastMediaPage(target.page);
    setRoute(target);
  };

  const renderNonWorkspacePage = () => {
    if (route.section === "tasks") {
      return (
        <TasksPage
          onRerun={(task) => seedTaskIntoWorkspace(task, "rerun")}
          onReuse={(task) => seedTaskIntoWorkspace(task, "reuse")}
        />
      );
    }
    if (route.section !== "settings") return null;
    return (
      <SettingsShell
        page={route.page}
        onNavigatePage={navigateSecondary}
        missingDependencies={missingDependencyCount}
      >
        {route.page === "general" ? (
          <GeneralSettingsPage
            settings={backend.settings}
            onSave={backend.saveSettings}
            onSetLanguage={changeLanguage}
          />
        ) : route.page === "dependencies" ? (
          <DependenciesSettingsPage
            settings={backend.settings}
            onSave={backend.saveSettings}
            dependencies={backend.dependencies}
            loading={backend.loadingDependencies}
            distributionMode={distributionMode}
            onRefresh={() => void backend.refreshDependencies()}
          />
        ) : (
          <AboutSettingsPage />
        )}
      </SettingsShell>
    );
  };

  const activeWorkspace = workspaceIdForRoute(route);
  const workspaces: readonly WorkspaceDefinition[] = [
    {
      id: "bilibili",
      render: (active, generation) => (
        <BilibiliPage
          active={active}
          seed={active && taskSeed?.task.feature === "bilibili" ? taskSeed : null}
          onSeedConsumed={() => setTaskSeed(null)}
          onRetain={() => markWorkspaceRetained("bilibili", generation)}
          onSubmitted={() => markWorkspaceReleasable("bilibili", generation)}
          dependencyLabels={missingLabelsFor("bilibili")}
          onOpenDependencies={openDependencySettings}
        />
      )
    },
    {
      id: "network",
      render: (active, generation) => (
        <NetworkVideoPage
          active={active}
          seed={active && taskSeed?.task.feature === "network" ? taskSeed : null}
          onSeedConsumed={() => setTaskSeed(null)}
          onRetain={() => markWorkspaceRetained("network", generation)}
          onSubmitted={() => markWorkspaceReleasable("network", generation)}
          dependencyLabels={missingLabelsFor("network")}
          onOpenDependencies={openDependencySettings}
          globalProxy={backend.settings.proxy}
          cookieFiles={backend.settings.cookieFiles}
          onAddCookieFile={openGeneralSettings}
        />
      )
    },
    {
      id: "music",
      render: (active, generation) => (
        <MusicPage
          active={active}
          seed={active && taskSeed?.task.feature === "music" ? taskSeed : null}
          onSeedConsumed={() => setTaskSeed(null)}
          dependency={backend.dependencyMap.get("musicdl") ?? null}
          pythonDependency={backend.dependencyMap.get("python") ?? null}
          defaultOutputDirectory={backend.settings.defaultOutputDirectory}
          globalProxy={backend.settings.proxy}
          onPlaylist={downloadMusicPlaylist}
          onDownload={downloadMusic}
          onRetain={() => markWorkspaceRetained("music", generation)}
          onSubmitted={() => markWorkspaceReleasable("music", generation)}
          dependencyLabels={missingLabelsFor("music")}
          onOpenDependencies={openDependencySettings}
          cookieFiles={backend.settings.cookieFiles}
          onAddCookieFile={openGeneralSettings}
        />
      )
    },
    {
      id: "media",
      render: (active, generation) => (
        <MediaWorkspace
          active={active}
          page={route.section === "media" ? route.page : lastMediaPage}
          seed={active && taskSeed?.task.feature === "media" ? taskSeed : null}
          onSeedConsumed={() => setTaskSeed(null)}
          onNavigatePage={navigateSecondary}
          onRetain={() => markWorkspaceRetained("media", generation)}
          onSubmitted={() => markWorkspaceReleasable("media", generation)}
          dependencyLabels={missingLabelsFor("media")}
          onOpenDependencies={openDependencySettings}
        />
      )
    }
  ];

  const secondaryItems: readonly never[] = [];

  if (!booted) return <SplashScreen />;

  return (
    <Fragment key={lang}>
      <AppShell
        route={route}
        primaryItems={L1_NAVIGATION}
        secondaryItems={secondaryItems}
        onNavigatePrimary={navigatePrimary}
        onNavigateSecondary={navigateSecondary}
        onBackFromSettings={() => navigatePrimary(lastMainSection)}
        onOpenUpdatePage={openUpdateSettings}
        navigationStatuses={{
          ...(activeTaskCount > 0
            ? {
                tasks: {
                  count: activeTaskCount,
                  label: t("app.activeTasksLabel", { count: activeTaskCount }),
                  color: "blue"
                }
              }
            : {}),
          ...(missingDependencyCount > 0
            ? {
                settings: {
                  count: missingDependencyCount,
                  label: t("app.missingDepsLabel", { count: missingDependencyCount }),
                  color: "yellow"
                }
              }
            : {})
        }}
      >
        <WorkspaceSessionHost activeWorkspace={activeWorkspace} workspaces={workspaces} />
        {activeWorkspace === null ? (
          <div key={route.section} className="workspace-enter">
            {renderNonWorkspacePage()}
          </div>
        ) : null}
      </AppShell>
      <StartupTipsModal opened={tipsOpened} onClose={() => setTipsOpened(false)} />
    </Fragment>
  );
}
