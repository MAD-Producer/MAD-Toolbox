import { Fragment, useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useColorScheme } from "../lib/theme";
import { notifications } from "../lib/notifications";
import { useBackend } from "../hooks/useBackend";
import { useTasksStore } from "../stores/tasks";
import type { ToolName } from "../contracts/dependency";
import type { TaskEnvelope, TaskSeed } from "../contracts/types";
import { syncNativeWindowTheme } from "./api";
import { checkForUpdate } from "../pages/settings/api";
import { useUpdateStore } from "../stores/update";
import { AppShell } from "../components/layout/AppShell";
import { SplashScreen } from "../components/layout/SplashScreen";
import { StartupTipsModal, isStartupTipsDismissed } from "../components/layout/StartupTipsModal";
import StyleguideLayer from "../components/styleguide/StyleguideLayer";
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
import { WORKSPACE_IDS, useWorkspacesStore, type WorkspaceId } from "../stores/workspaces";
import { SIDEBAR_GROUPS } from "./navigation";
import { onLanguageChanged, setLanguageChoice, t, type LanguageChoice } from "../locale";
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
  const [booted, setBooted] = useState(false);
  const [tipsOpened, setTipsOpened] = useState(() => !isStartupTipsDismissed());
  const [, setLanguageRevision] = useState(0);
  const backend = useBackend();
  const initTasksStore = useTasksStore((s) => s.init);
  const initBilibiliLogin = useBilibiliLoginStore((state) => state.init);
  const initMusicSession = useMusicSessionStore((state) => state.init);
  const markWorkspaceRetained = useWorkspacesStore((state) => state.markRetained);
  const markWorkspaceReleasable = useWorkspacesStore((state) => state.markReleasable);
  // 各 workspace 的待交付种子：按 workspace 独立订阅，retain/markReleasable 等高频变更不会触发 App 重渲
  const bilibiliSeed = useWorkspacesStore((state) => state.sessions.bilibili.seed);
  const networkSeed = useWorkspacesStore((state) => state.sessions.network.seed);
  const musicSeed = useWorkspacesStore((state) => state.sessions.music.seed);
  const mediaSeed = useWorkspacesStore((state) => state.sessions.media.seed);

  // 【Effect 白名单⑤】应用启动引导：三个全局 store 各自订阅后端事件流（幂等，内部有守卫）
  useEffect(() => {
    void initTasksStore();
    void initBilibiliLogin();
    void initMusicSession();
  }, [initBilibiliLogin, initMusicSession, initTasksStore]);

  // 【Effect 白名单⑤】启动时一次性检查应用更新，结果写入全局 update store
  useEffect(() => {
    checkForUpdate()
      .then((result) => {
        if (result.updateAvailable) useUpdateStore.getState().setUpdate(result);
      })
      .catch((error) => console.warn("startup update check failed:", error));
  }, []);

  // 【Effect 白名单②】订阅后端更新包下载进度事件
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

  // 【Effect 白名单⑤】主题变化同步到原生窗口（标题栏配色），React 状态 → 外部系统
  const { colorScheme } = useColorScheme();
  useEffect(() => {
    void syncNativeWindowTheme(colorScheme);
  }, [colorScheme]);

  // 启动标记：刻意让 SplashScreen 至少存在一帧（首帧渲染 → effect 翻转），
  // 属于生命周期内的一次性状态推进（白名单④）
  useEffect(() => {
    setBooted(true);
  }, []);

  useEffect(() => onLanguageChanged(() => setLanguageRevision((revision) => revision + 1)), []);

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

  // 所有路由变更的唯一入口：workspace 的 visit/驱逐与会话状态刷新由导航事件直接驱动
  // （不用 Effect 观察 route/sessions 变化后再同步 store）
  const navigate = useCallback((next: AppRoute) => {
    setRoute(next);
    const target = workspaceIdForRoute(next);
    if (target !== null) {
      useWorkspacesStore.getState().visit(target);
      if (next.section === "bilibili") {
        void useBilibiliLoginStore.getState().refresh();
      }
    }
    for (const id of WORKSPACE_IDS) {
      if (id !== target) useWorkspacesStore.getState().evictIfReleasable(id);
    }
  }, []);

  const openDependencySettings = () => {
    setLastSettingsPage("dependencies");
    navigate({ section: "settings", page: "dependencies" });
  };

  const openGeneralSettings = () => {
    setLastSettingsPage("general");
    navigate({ section: "settings", page: "general" });
  };

  const openUpdateSettings = () => {
    setLastSettingsPage("about");
    navigate({ section: "settings", page: "about" });
  };

  const changeLanguage = async (choice: LanguageChoice) => {
    const previousChoice = backend.settings?.language ?? "auto";
    setLanguageChoice(choice);
    try {
      await backend.saveLanguage(choice);
    } catch (error) {
      setLanguageChoice(previousChoice);
      throw error;
    }
  };

  const navigatePrimary = (section: AppSection) => {
    if (section === "media") {
      navigate({ section, page: lastMediaPage });
      return;
    }
    if (section === "settings") {
      navigate({ section, page: lastSettingsPage });
      return;
    }
    navigate({ section });
  };

  const navigateSecondary = (page: MediaPageId | SettingsPageId) => {
    if (route.section === "media") {
      const mediaPage = page as MediaPageId;
      setLastMediaPage(mediaPage);
      navigate({ section: "media", page: mediaPage });
    } else if (route.section === "settings") {
      const settingsPage = page as SettingsPageId;
      setLastSettingsPage(settingsPage);
      navigate({ section: "settings", page: settingsPage });
    }
  };

  const seedTaskIntoWorkspace = useCallback((task: TaskEnvelope, purpose: TaskSeed["purpose"]) => {
    const target = routeForTask(task);
    const targetWorkspace = workspaceIdForRoute(target);
    if (targetWorkspace === null) return;
    const session = useWorkspacesStore.getState().sessions[targetWorkspace];
    if (session.status === "retained" && !window.confirm(t("app.confirmDiscardDraft"))) {
      return;
    }
    // 种子交付进会话：generation+1 触发目标页重挂，由挂载初始化器恰好消费一次
    // （原先靠目标页 mount 后的 Effect 回调 onSeedConsumed 清除 App 级 state）
    useWorkspacesStore.getState().deliver(targetWorkspace, { task, purpose });
    // 打码参数警告在用户点击「重跑」时就地发出（原先在目标页 mount 后的 Effect 里补发）
    if (
      (target.section === "bilibili" || target.section === "network") &&
      task.intent.type === "manual" &&
      task.intent.data.argv.some((argument) => argument === "***")
    ) {
      notifications.show({
        color: "yellow",
        message: t(
          target.section === "bilibili"
            ? "bilibili.notice.redactedArgs"
            : "network.expertRedactedWarning"
        )
      });
    }
    if (target.section === "media") setLastMediaPage(target.page);
    navigate(target);
  }, [navigate]);

  const rerunTask = useCallback(
    (task: TaskEnvelope) => seedTaskIntoWorkspace(task, "rerun"),
    [seedTaskIntoWorkspace]
  );
  const reuseTask = useCallback(
    (task: TaskEnvelope) => seedTaskIntoWorkspace(task, "reuse"),
    [seedTaskIntoWorkspace]
  );

  const renderNonWorkspacePage = () => {
    if (route.section === "tasks") {
      return <TasksPage onRerun={rerunTask} onReuse={reuseTask} />;
    }
    if (route.section !== "settings") return null;
    const settings = backend.settings;
    if (!settings) return null;
    return (
      <SettingsShell
        page={route.page}
        onNavigatePage={navigateSecondary}
        missingDependencies={missingDependencyCount}
      >
        {route.page === "general" ? (
          <GeneralSettingsPage
            settings={settings}
            onSave={backend.saveSettings}
            onSetLanguage={changeLanguage}
          />
        ) : route.page === "dependencies" ? (
          <DependenciesSettingsPage
            settings={settings}
            onSave={backend.saveDependencyPreference}
            dependencies={backend.dependencies}
            loading={backend.loadingDependencies}
            onRefresh={() => {
              void backend.refreshDependencies();
              void backend.refreshMirrorDependencies();
            }}
            mirrorDependencies={backend.mirrorDependencies}
            loadingMirror={backend.loadingMirror}
            mirrorError={backend.mirrorError}
            mirrorInstallation={backend.mirrorInstallation}
            mirrorQueue={backend.mirrorQueue}
            onMirrorInstall={backend.installMirror}
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
          seed={active ? bilibiliSeed : null}
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
          seed={active ? networkSeed : null}
          onRetain={() => markWorkspaceRetained("network", generation)}
          onSubmitted={() => markWorkspaceReleasable("network", generation)}
          dependencyLabels={missingLabelsFor("network")}
          onOpenDependencies={openDependencySettings}
          globalProxy={backend.settings?.proxy ?? null}
          cookieFiles={backend.settings?.cookieFiles ?? []}
          onAddCookieFile={openGeneralSettings}
        />
      )
    },
    {
      id: "music",
      render: (active, generation) => (
        <MusicPage
          active={active}
          seed={active ? musicSeed : null}
          dependency={backend.dependencyMap.get("musicdl") ?? null}
          pythonDependency={backend.dependencyMap.get("python") ?? null}
          defaultOutputDirectory={backend.settings?.defaultOutputDirectory ?? null}
          globalProxy={backend.settings?.proxy ?? null}
          onRetain={() => markWorkspaceRetained("music", generation)}
          onSubmitted={() => markWorkspaceReleasable("music", generation)}
          dependencyLabels={missingLabelsFor("music")}
          onOpenDependencies={openDependencySettings}
          cookieFiles={backend.settings?.cookieFiles ?? []}
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
          seed={active ? mediaSeed : null}
          onNavigatePage={navigateSecondary}
          onRetain={() => markWorkspaceRetained("media", generation)}
          onSubmitted={() => markWorkspaceReleasable("media", generation)}
          dependencyLabels={missingLabelsFor("media")}
          onOpenDependencies={openDependencySettings}
        />
      )
    }
  ];

  if (!booted) return <SplashScreen />;

  return (
    <Fragment>
      <AppShell
        route={route}
        sidebarGroups={SIDEBAR_GROUPS}
        onNavigatePrimary={navigatePrimary}
        onOpenUpdatePage={openUpdateSettings}
        navigationStatuses={
          missingDependencyCount > 0
            ? {
                settings: {
                  count: missingDependencyCount,
                  label: t("app.missingDepsLabel", { count: missingDependencyCount }),
                  color: "yellow"
                }
              }
            : undefined
        }
      >
        <WorkspaceSessionHost activeWorkspace={activeWorkspace} workspaces={workspaces} />
        {activeWorkspace === null ? (
          <div
            key={route.section}
            className={
              route.section === "settings" && route.page === "general"
                ? "workspace-enter h-full"
                : "workspace-enter"
            }
          >
            {renderNonWorkspacePage()}
          </div>
        ) : null}
      </AppShell>
      <StartupTipsModal opened={tipsOpened} onClose={() => setTipsOpened(false)} />
      {import.meta.env.DEV && <StyleguideLayer />}
    </Fragment>
  );
}
