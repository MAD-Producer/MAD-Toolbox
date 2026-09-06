import { useCallback, useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type { DependencyStatus, ToolName } from "../contracts/dependency";
import {
  fetchAppSettings,
  fetchDependencyStatus,
  saveAppSettings,
  type AppSettings
} from "../pages/settings/api";

export function useBackend() {
  const [dependencies, setDependencies] = useState<DependencyStatus[]>([]);
  const [loadingDependencies, setLoadingDependencies] = useState(true);
  const [settings, setSettings] = useState<AppSettings>({
    defaultOutputDirectory: null,
    dependencyPreference: "bundled",
    proxy: null,
    language: "auto",
    cookieFiles: []
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
