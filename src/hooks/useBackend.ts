import { useCallback, useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type { DependencyStatus, ToolName } from "../contracts/dependency";
import {
  fetchAppSettings,
  fetchDependencyStatus,
  saveAppSettings,
  type AppSettings
} from "../pages/settings/api";

/**
 * 依赖状态与应用设置的共享读取。
 * 旧的任务/日志/登录态事件处理已随任务系统迁移删除：
 * 任务事件走 stores/tasks（task-event 单通道），登录事件由发起页面自行订阅。
 */
export function useBackend() {
  const [dependencies, setDependencies] = useState<DependencyStatus[]>([]);
  const [loadingDependencies, setLoadingDependencies] = useState(true);
  const [settings, setSettings] = useState<AppSettings>({
    defaultOutputDirectory: null,
    dependencyPreference: "bundled",
    proxy: null,
    language: "auto"
  });

  const refreshDependencies = useCallback(async () => {
    setLoadingDependencies(true);
    try {
      setDependencies(await fetchDependencyStatus());
    } finally {
      setLoadingDependencies(false);
    }
  }, []);

  const refreshSettings = useCallback(async () => {
    setSettings(await fetchAppSettings());
  }, []);

  const saveSettings = useCallback(async (next: AppSettings) => {
    const saved = await saveAppSettings(next);
    setSettings(saved);
    return saved;
  }, []);

  useEffect(() => {
    void refreshDependencies();
    void refreshSettings();
  }, [refreshDependencies, refreshSettings]);

  // 一键安装流程结束后（终端窗口关闭 / 系统PATH检测到工具）自动重新检测依赖
  useEffect(() => {
    const promise = listen("dependency-install-finished", () => {
      void refreshDependencies();
    });
    return () => {
      void promise.then((unlisten) => unlisten());
    };
  }, [refreshDependencies]);

  const dependencyMap = useMemo(
    () => new Map<ToolName, DependencyStatus>(dependencies.map((item) => [item.tool, item])),
    [dependencies]
  );

  return {
    dependencies,
    dependencyMap,
    loadingDependencies,
    settings,
    saveSettings,
    refreshSettings,
    refreshDependencies
  };
}
