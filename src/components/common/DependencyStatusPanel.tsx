import { useState } from "react";
import {
  CheckCircle,
  Cloud,
  CloudArrowDown,
  Laptop,
  ArrowsClockwise,
  TerminalWindow
} from "@phosphor-icons/react";
import type {
  DependencyDownloadProgress,
  DependencyStatus,
  MirrorDependencyStatus,
  ToolName
} from "../../contracts/dependency";
import { t, type TranslationKey } from "../../locale";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Checkbox } from "../ui/checkbox";
import { Progress } from "../ui/progress";
import { CollapsibleSection } from "./CollapsibleSection";

const TOOL_PURPOSES: Record<ToolName, TranslationKey> = {
  bbdown: "deps.purpose.bbdown",
  "yt-dlp": "deps.purpose.ytDlp",
  aria2: "deps.purpose.aria2",
  deno: "deps.purpose.deno",
  ffmpeg: "deps.purpose.ffmpeg",
  ffprobe: "deps.purpose.ffprobe",
  mediainfo: "deps.purpose.mediainfo",
  musicdl: "deps.purpose.musicdl",
  python: "deps.purpose.python"
};

interface DependencyStatusPanelProps {
  dependencies: DependencyStatus[];
  loading: boolean;
  onRefresh: () => void;
  onInstall: (dependency: DependencyStatus) => void;
  mirrorDependencies: MirrorDependencyStatus[];
  installation: DependencyDownloadProgress | null;
  queue: ToolName[];
  onMirrorInstall: (tools: ToolName[]) => void;
}

export function DependencyStatusPanel({
  dependencies,
  loading,
  onRefresh,
  onInstall,
  mirrorDependencies,
  installation,
  queue,
  onMirrorInstall
}: DependencyStatusPanelProps) {
  const visibleDependencies = dependencies.filter((item) => item.tool !== "ffprobe");
  const missing = visibleDependencies.filter((item) => !item.available);
  const sortedDependencies = [...missing, ...visibleDependencies.filter((item) => item.available)];
  const mirrors = new Map(mirrorDependencies.map((dependency) => [dependency.tool, dependency]));
  const updateCount = mirrorDependencies.filter((dependency) => dependency.updateAvailable).length;
  const suggestedTools = sortedDependencies
    .filter((dependency) => {
      const mirror = mirrors.get(dependency.tool);
      return mirror && (!dependency.available || mirror.updateAvailable);
    })
    .map((dependency) => dependency.tool);
  const suggestedKey = suggestedTools.join(",");
  // 勾选 = 渲染期派生：用户显式改过且建议集未变时用用户的选择，否则跟随建议集。
  // 建议集变化（重检/安装后刷新）天然使旧覆盖失效，等价于原先"队列清空重置为建议"的
  // Effect（安装期间勾选框禁用，用户覆盖只可能产生于建议集一致的时间段）
  const [selectionOverride, setSelectionOverride] = useState<{
    key: string;
    tools: ReadonlySet<ToolName>;
  } | null>(null);
  const selected =
    selectionOverride?.key === suggestedKey
      ? selectionOverride.tools
      : new Set<ToolName>(suggestedTools);
  const selectedTools = sortedDependencies
    .map((dependency) => dependency.tool)
    .filter((tool) => mirrors.has(tool) && selected.has(tool));
  const currentIndex = installation ? queue.indexOf(installation.tool) : -1;

  const toggleSelected = (tool: ToolName) =>
    setSelectionOverride((current) => {
      const base =
        current?.key === suggestedKey ? current.tools : new Set<ToolName>(suggestedTools);
      const next = new Set(base);
      if (!next.delete(tool)) next.add(tool);
      return { key: suggestedKey, tools: next };
    });

  // 展开状态 = 用户显式操作优先，否则按问题状态派生（缺依赖/有更新/安装中即展开）。
  //（原先用 Effect 观察问题状态强制 setOpened(true)）
  const hasProblem = missing.length > 0 || updateCount > 0 || installation !== null;
  const [userOpened, setUserOpened] = useState<boolean | null>(null);
  const opened = userOpened ?? hasProblem;

  return (
    <CollapsibleSection
      opened={opened}
      onToggle={() => setUserOpened((value) => !(value ?? opened))}
      title={
        dependencies.length === 0 ? (
          <span className="text-sm text-muted-foreground">{t("deps.checking")}</span>
        ) : missing.length > 0 ? (
          <Badge variant="warning">{t("deps.missingCount", { count: missing.length })}</Badge>
        ) : updateCount > 0 ? (
          <Badge variant="primary">{t("deps.updateCount", { count: updateCount })}</Badge>
        ) : (
          <Badge variant="success" className="gap-1">
            <CheckCircle size={12} />
            {t("deps.allReady")}
          </Badge>
        )
      }
      action={
        <div className="flex items-center gap-2">
          {mirrors.size > 0 && (
            <Button
              size="sm"
              variant="secondary"
              className="h-8 gap-1.5 px-2 text-xs"
              leftSection={<CloudArrowDown size={14} />}
              loading={installation !== null}
              disabled={selectedTools.length === 0}
              onClick={() => onMirrorInstall(selectedTools)}
            >
              {t("deps.mirrorInstallSelected", { count: selectedTools.length })}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 px-2 text-xs"
            leftSection={<ArrowsClockwise size={14} />}
            loading={loading}
            onClick={() => {
              if (missing.length > 0) setUserOpened(true);
              onRefresh();
            }}
          >
            {t("deps.recheck")}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        {sortedDependencies.map((dependency) => {
          const installable =
            (!dependency.systemAvailable || !dependency.available) &&
            Boolean(dependency.installCommand);
          const mirror = mirrors.get(dependency.tool);
          const installing = installation?.tool === dependency.tool;
          const queued = queue.indexOf(dependency.tool) > currentIndex;
          const total = installation?.total;
          const received = installation?.received ?? 0;
          const progress = total ? Math.min(100, (received / total) * 100) : 0;
          return (
            <Card key={dependency.tool} padding="sm">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  {mirror ? (
                    <label className="flex cursor-pointer items-center gap-2">
                      <Checkbox
                        aria-label={t("deps.mirrorSelectAria", { name: dependency.label })}
                        checked={selected.has(dependency.tool)}
                        disabled={installation !== null}
                        onCheckedChange={() => toggleSelected(dependency.tool)}
                      />
                      <span className="text-sm font-semibold">{dependency.label}</span>
                    </label>
                  ) : (
                    <span className="text-sm font-semibold">{dependency.label}</span>
                  )}
                  <div className="ms-auto flex items-center justify-end gap-2">
                    {mirror && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 gap-1.5 px-2 text-xs"
                        loading={installing}
                        disabled={installation !== null}
                        leftSection={<CloudArrowDown size={14} />}
                        onClick={() => onMirrorInstall([dependency.tool])}
                      >
                        {mirror.updateAvailable
                          ? t("deps.mirrorUpdate")
                          : dependency.managedAvailable
                            ? t("deps.mirrorReinstall")
                            : t("deps.mirrorInstall")}
                      </Button>
                    )}
                    {installable && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 gap-1.5 px-2 text-xs"
                        disabled={installation !== null}
                        leftSection={<TerminalWindow size={14} />}
                        aria-label={t(
                          dependency.healthCheckFailed ? "deps.repairAria" : "deps.installAria",
                          { name: dependency.label }
                        )}
                        onClick={() => onInstall(dependency)}
                      >
                        {dependency.healthCheckFailed ? t("deps.repair") : t("deps.install")}
                      </Button>
                    )}
                    <Badge
                      variant={dependency.available ? "success" : "warning"}
                      className="shrink-0 gap-1"
                    >
                      {dependency.available && (
                        <>
                          {dependency.source === "managed" ? (
                            <Cloud size={14} />
                          ) : (
                            <Laptop size={14} />
                          )}
                        </>
                      )}
                      {dependency.available
                        ? dependency.source === "managed"
                          ? t("deps.managed")
                          : t("deps.system")
                        : dependency.healthCheckFailed
                          ? t("deps.environmentBroken")
                          : t("deps.notReady")}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{t(TOOL_PURPOSES[dependency.tool])}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {dependency.available
                    ? (dependency.version ?? t("deps.versionUnknown"))
                    : dependency.healthCheckFailed
                      ? t("deps.musicdlEnvironmentBroken")
                      : t("deps.notInstalled")}
                </p>
                <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                  {dependency.available
                    ? (dependency.path ?? t("deps.pathUnknown"))
                    : (dependency.installHint ?? t("deps.noVersionFound"))}
                </p>
                {dependency.healthCheckError && (
                  <p className="whitespace-pre-wrap text-xs text-destructive [overflow-wrap:anywhere]">
                    {dependency.healthCheckError}
                  </p>
                )}
                {mirror && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {t("deps.mirrorVersion", {
                        version: mirror.version,
                        size: (mirror.size / 1024 / 1024).toFixed(1)
                      })}
                    </span>
                    {mirror.updateAvailable && (
                      <Badge variant="primary">{t("deps.updateAvailable")}</Badge>
                    )}
                  </div>
                )}
                {queued && (
                  <p className="text-xs text-muted-foreground">{t("deps.mirrorQueued")}</p>
                )}
                {installing && installation && (
                  <div className="flex flex-col gap-2" aria-live="polite">
                    {total && progress < 100 ? (
                      <Progress
                        value={progress}
                        aria-label={`${dependency.label} · ${t("deps.mirrorDownloading")}`}
                      />
                    ) : (
                      <Progress
                        indeterminate
                        aria-label={`${dependency.label} · ${t("deps.mirrorDownloading")}`}
                      />
                    )}
                    <p className="text-xs text-muted-foreground">
                      {queue.length > 1 && `${currentIndex + 1}/${queue.length} · `}
                      {received === 0
                        ? t("deps.mirrorPreparing")
                        : progress === 100
                          ? t("deps.mirrorInstalling")
                          : t("deps.mirrorProgress", {
                              received: (received / 1024 / 1024).toFixed(1),
                              total: total ? (total / 1024 / 1024).toFixed(1) : "?"
                            })}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </CollapsibleSection>
  );
}
