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
  installMirrorDependencies,
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
  const [mirrorQueue, setMirrorQueue] = useState<ToolName[]>([]);
  const mirrorRequest = useRef<Promise<void> | null>(null);
  const mirrorBatch = useRef<ToolName[]>([]);
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
    async (tools: ToolName[]) => {
      if (mirrorBatch.current.length > 0 || tools.length === 0) return;
      mirrorBatch.current = tools;
      setMirrorQueue(tools);
      setMirrorInstallation({ tool: tools[0], received: 0, total: null });
      try {
        await progressListener.current;
        const results = await installMirrorDependencies(tools);
        const installed = results.filter((result) => result.status === "installed");
        const problems = results.flatMap((result) =>
          result.status === "installed" ? [] : [`${result.tool}: ${result.reason}`]
        );
        if (problems.length === 0) {
          notifications.show({
            color: "teal",
            message: t("deps.mirrorInstalled", {
              name: installed.map((result) => result.tool).join(", ")
            })
          });
        } else {
          notifications.show({
            color: installed.length > 0 ? "yellow" : "red",
            title: t("deps.mirrorBatchSummary", {
              installed: installed.length,
              skipped: results.filter((result) => result.status === "skipped").length,
              failed: results.filter((result) => result.status === "failed").length
            }),
            message: problems.join("\n"),
            style: { whiteSpace: "pre-wrap" }
          });
        }
        await Promise.all([refreshDependencies(), refreshMirrorDependencies()]);
      } catch (error) {
        notifications.show({
          color: "red",
          message: t("deps.mirrorInstallFailed", { error: String(error) })
        });
      } finally {
        mirrorBatch.current = [];
        setMirrorQueue([]);
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
        if (!disposed && mirrorBatch.current.includes(payload.tool)) setMirrorInstallation(payload);
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
      if (mirrorBatch.current.length > 0) return;
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
    mirrorQueue,
    refreshMirrorDependencies,
    installMirror
  };
}
