import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { setAppLanguage } from "../app/api";
import { notifications } from "../lib/notifications";
import type {
  DependencyDownloadProgress,
  DependencyStatus,
  MirrorDependencyStatus,
  ToolName
} from "../contracts/dependency";
import { t } from "../locale";
import {
  fetchAppSettings,
  fetchDependencyStatus,
  fetchMirrorDependencyStatus,
  installMirrorDependency,
  saveAppSettings,
  setDependencyPreference,
  type AppSettings,
  type GeneralSettingsDraft
} from "../pages/settings/api";

export function useBackend() {
  const [dependencies, setDependencies] = useState<DependencyStatus[]>([]);
  const [loadingDependencies, setLoadingDependencies] = useState(true);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [mirrorDependencies, setMirrorDependencies] = useState<MirrorDependencyStatus[]>([]);
  const [loadingMirror, setLoadingMirror] = useState(true);
  const [mirrorError, setMirrorError] = useState<string | null>(null);
  const [mirrorInstallation, setMirrorInstallation] = useState<DependencyDownloadProgress | null>(
    null
  );
  const mirrorRequest = useRef<Promise<void> | null>(null);
  const mirrorInstalling = useRef(false);
  const progressListener = useRef<ReturnType<typeof listen> | null>(null);
  const settingsUpdates = useRef<Promise<void>>(Promise.resolve());

  const refreshMirrorDependencies = useCallback(() => {
    if (mirrorRequest.current) return mirrorRequest.current;
    setLoadingMirror(true);
    mirrorRequest.current = fetchMirrorDependencyStatus()
      .then((result) => {
        setMirrorDependencies(result);
        setMirrorError(null);
      })
      .catch((error) => setMirrorError(String(error)))
      .finally(() => {
        setLoadingMirror(false);
        mirrorRequest.current = null;
      });
    return mirrorRequest.current;
  }, []);

  const refreshDependencies = useCallback(async () => {
    setLoadingDependencies(true);
    try {
      setDependencies(await fetchDependencyStatus());
    } catch (error) {
      notifications.show({ color: "red", message: String(error) });
    } finally {
      setLoadingDependencies(false);
    }
  }, []);

  const refreshSettings = useCallback(async () => {
    try {
      setSettings(await fetchAppSettings());
    } catch (error) {
      notifications.show({ color: "red", message: String(error) });
    }
  }, []);

  const updateSettings = useCallback((operation: () => Promise<AppSettings>) => {
    const request = settingsUpdates.current.then(operation).then((saved) => {
      setSettings(saved);
      return saved;
    });
    settingsUpdates.current = request.then(
      () => {},
      () => {}
    );
    return request;
  }, []);

  const saveSettings = useCallback(
    (next: GeneralSettingsDraft) => updateSettings(() => saveAppSettings(next)),
    [updateSettings]
  );

  const saveDependencyPreference = useCallback(
    (preference: AppSettings["dependencyPreference"]) =>
      updateSettings(() => setDependencyPreference(preference)),
    [updateSettings]
  );

  const saveLanguage = useCallback(
    (language: AppSettings["language"]) => updateSettings(() => setAppLanguage(language)),
    [updateSettings]
  );

  const installMirror = useCallback(
    async (tool: ToolName) => {
      if (mirrorInstalling.current) return;
      mirrorInstalling.current = true;
      setMirrorInstallation({ tool, received: 0, total: null });
      try {
        await progressListener.current;
        await installMirrorDependency(tool);
        notifications.show({ color: "teal", message: t("deps.mirrorInstalled", { name: tool }) });
        await Promise.all([refreshDependencies(), refreshMirrorDependencies()]);
      } catch (error) {
        notifications.show({
          color: "red",
          message: t("deps.mirrorInstallFailed", { error: String(error) })
        });
      } finally {
        mirrorInstalling.current = false;
        setMirrorInstallation(null);
      }
    },
    [refreshDependencies, refreshMirrorDependencies]
  );

  useEffect(() => {
    void refreshDependencies();
    void refreshSettings();
    void refreshMirrorDependencies();
  }, [refreshDependencies, refreshSettings, refreshMirrorDependencies]);

  useEffect(() => {
    let disposed = false;
    const promise = listen<DependencyDownloadProgress>(
      "dependency-download-progress",
      ({ payload }) => {
        if (!disposed)
          setMirrorInstallation((current) => (current?.tool === payload.tool ? payload : current));
      }
    );
    progressListener.current = promise;
    return () => {
      disposed = true;
      void promise.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    const promise = listen("dependency-install-finished", () => {
      if (mirrorInstalling.current) return;
      void refreshDependencies();
      void refreshMirrorDependencies();
    });
    return () => {
      void promise.then((unlisten) => unlisten());
    };
  }, [refreshDependencies, refreshMirrorDependencies]);

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
    saveDependencyPreference,
    saveLanguage,
    refreshSettings,
    refreshDependencies,
    mirrorDependencies,
    loadingMirror,
    mirrorError,
    mirrorInstallation,
    refreshMirrorDependencies,
    installMirror
  };
}
