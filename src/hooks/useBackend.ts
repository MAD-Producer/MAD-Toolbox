import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  AppSettings,
  BbdownAuthStatus,
  DependencyStatus,
  JobLog,
  JobState,
  LoginQr,
  RunRequest,
  RunResult,
  ToolName
} from "../lib/types";

export function useBackend() {
  const [dependencies, setDependencies] = useState<DependencyStatus[]>([]);
  const [logs, setLogs] = useState<JobLog[]>([]);
  const [jobs, setJobs] = useState<JobState[]>([]);
  const [loadingDependencies, setLoadingDependencies] = useState(true);
  const [ffmpegEncoders, setFfmpegEncoders] = useState<string[]>([]);
  const [loginQr, setLoginQr] = useState<LoginQr | null>(null);
  const [bbdownAuthStatus, setBbdownAuthStatus] = useState<BbdownAuthStatus>("unknown");
  const [settings, setSettings] = useState<AppSettings>({
    defaultOutputDirectory: null,
    dependencyPreference: "bundled"
  });

  const refreshDependencies = useCallback(async () => {
    setLoadingDependencies(true);
    try {
      const next = await invoke<DependencyStatus[]>("dependency_status");
      setDependencies(next);
      if (next.some((item) => item.tool === "ffmpeg" && item.available)) {
        setFfmpegEncoders(await invoke<string[]>("ffmpeg_encoders").catch(() => []));
      } else {
        setFfmpegEncoders([]);
      }
    } finally {
      setLoadingDependencies(false);
    }
  }, []);

  const refreshSettings = useCallback(async () => {
    setSettings(await invoke<AppSettings>("app_settings"));
  }, []);

  const saveSettings = useCallback(async (next: AppSettings) => {
    const saved = await invoke<AppSettings>("save_app_settings", { settings: next });
    setSettings(saved);
    return saved;
  }, []);

  useEffect(() => {
    void refreshDependencies();
    void refreshSettings();
    const unlistenLog = listen<JobLog>("job-log", ({ payload }) => {
      setLogs((current) => [...current.slice(-4999), payload]);
      if (payload.tool === "bbdown") {
        const line = payload.line.replace(/\s+/g, "").toLowerCase();
        if (line.includes("登录成功")) {
          setBbdownAuthStatus("authenticated");
        } else if (
          line.includes("尚未登录") ||
          line.includes("未登录") ||
          line.includes("未获取到b站账号") ||
          line.includes("解析可能受到限制") ||
          line.includes("cookie无效") ||
          line.includes("cookie失效") ||
          line.includes("cookie过期")
        ) {
          setBbdownAuthStatus("unauthenticated");
        }
      }
    });
    const unlistenQr = listen<LoginQr>("bbdown-login-qr", ({ payload }) => {
      setLoginQr(payload);
    });
    const unlistenState = listen<JobState>("job-state", ({ payload }) => {
      setJobs((current) => {
        const without = current.filter((job) => job.jobId !== payload.jobId);
        return [payload, ...without].slice(0, 200);
      });
      if (payload.state !== "running") {
        setLoginQr((current) => (current?.jobId === payload.jobId ? null : current));
      }
    });
    return () => {
      void unlistenLog.then((dispose) => dispose());
      void unlistenState.then((dispose) => dispose());
      void unlistenQr.then((dispose) => dispose());
    };
  }, [refreshDependencies, refreshSettings]);

  const runTool = useCallback(async (request: RunRequest) => {
    if (request.tool === "bbdown" && request.args[0] === "login") {
      setBbdownAuthStatus("unknown");
    }
    return invoke<RunResult>("run_tool", { request });
  }, []);

  const cancelJob = useCallback(async (jobId: string) => {
    await invoke("cancel_job", { jobId });
  }, []);

  const dependencyMap = useMemo(
    () => new Map<ToolName, DependencyStatus>(dependencies.map((item) => [item.tool, item])),
    [dependencies]
  );

  return {
    dependencies,
    dependencyMap,
    ffmpegEncoders,
    loadingDependencies,
    logs,
    jobs,
    loginQr,
    bbdownAuthStatus,
    settings,
    saveSettings,
    refreshDependencies,
    runTool,
    cancelJob
  };
}
