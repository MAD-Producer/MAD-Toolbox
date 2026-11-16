import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  ArrowUp,
  Prohibit,
  CaretRight,
  CheckCircle,
  XCircle,
  Clock,
  Copy,
  FileArrowDown,
  FileText,
  FolderOpen,
  LinkBreak,
  CircleNotch,
  ArrowsClockwise,
  Trash,
  X,
  type Icon
} from "@phosphor-icons/react";
import { notifications } from "../../lib/notifications";
import { memo, useId, useState } from "react";
import { cn } from "../../lib/cn";
import type { TaskEnvelope, TaskStatus } from "../../contracts/types";
import { isWindows } from "../../lib/platform";
import { t, type TranslationKey } from "../../locale";
import { useTasksStore } from "../../stores/tasks";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Collapse } from "../../components/ui/collapse";
import { IconButton } from "../../components/ui/icon-button";
import { Progress } from "../../components/ui/progress";
import { Tooltip } from "../../components/ui/tooltip";
import { exportTaskDiagnostics } from "./api";

/**
 * 任务状态视觉元数据。Mantine 色名到语义 token 的映射：
 * gray→muted-foreground、orange/yellow→warning、green→success、red→destructive
 */
const STATUS_META: Record<
  TaskStatus,
  {
    labelKey: TranslationKey;
    toneClass: string;
    barClass: "primary" | "success" | "warning" | "destructive" | "muted";
    borderClass: string;
    icon: Icon;
    spinning?: boolean;
  }
> = {
  queued: {
    labelKey: "tasks.status.queued",
    toneClass: "text-muted-foreground",
    barClass: "muted",
    borderClass: "border-l-muted-foreground/40",
    icon: Clock
  },
  running: {
    labelKey: "tasks.status.running",
    toneClass: "text-warning",
    barClass: "warning",
    borderClass: "border-l-warning",
    icon: CircleNotch,
    spinning: true
  },
  canceling: {
    labelKey: "tasks.status.canceling",
    toneClass: "text-warning",
    barClass: "warning",
    borderClass: "border-l-warning",
    icon: CircleNotch,
    spinning: true
  },
  success: {
    labelKey: "tasks.status.success",
    toneClass: "text-success",
    barClass: "success",
    borderClass: "border-l-success",
    icon: CheckCircle
  },
  failed: {
    labelKey: "tasks.status.failed",
    toneClass: "text-destructive",
    barClass: "destructive",
    borderClass: "border-l-destructive",
    icon: XCircle
  },
  canceled: {
    labelKey: "tasks.status.canceled",
    toneClass: "text-muted-foreground",
    barClass: "muted",
    borderClass: "border-l-muted-foreground/40",
    icon: Prohibit
  },
  interrupted: {
    labelKey: "tasks.status.interrupted",
    toneClass: "text-warning",
    barClass: "warning",
    borderClass: "border-l-warning",
    icon: LinkBreak
  }
};

const FAILED_TAIL_LINES = 10;

interface TaskCardProps {
  task: TaskEnvelope;
  onCancel: (id: string) => void;
  onPromote: (id: string) => void;
  onDelete: (id: string) => void;
  onRerun?: (task: TaskEnvelope) => void;
  onReuse?: (task: TaskEnvelope) => void;
}

const TERMINAL_STATUSES = new Set(["success", "failed", "canceled", "interrupted"]);

interface ProgressView {
  value: number;
  color: "primary" | "success" | "warning" | "destructive" | "muted";
  indeterminate: boolean;
}

function progressView(task: TaskEnvelope): ProgressView | null {
  const last = task.progress?.percent ?? null;
  switch (task.status) {
    case "queued":
      return null;
    case "running":
    case "canceling":
      return { value: last ?? 0, color: "warning", indeterminate: last == null };
    case "success":
      return { value: 100, color: "success", indeterminate: false };
    case "failed":
      return { value: last ?? 100, color: "destructive", indeterminate: false };
    case "interrupted":
      return last == null ? null : { value: last, color: "warning", indeterminate: false };
    case "canceled":
      return last == null ? null : { value: last, color: "muted", indeterminate: false };
  }
}

export const TaskCard = memo(function TaskCard({
  task,
  onCancel,
  onPromote,
  onDelete,
  onRerun,
  onReuse
}: TaskCardProps) {
  const [opened, setOpened] = useState(false);
  const contentId = useId();
  const logs = useTasksStore((s) => s.logs[task.id]);
  const status = STATUS_META[task.status];
  const StatusIcon = status.icon;
  const cancellable = task.status === "queued" || task.status === "running";
  const failedTail =
    task.status === "failed" && logs?.length ? logs.slice(-FAILED_TAIL_LINES) : null;
  const bar = progressView(task);

  const exportDiagnostics = async () => {
    const target = await saveDialog({
      defaultPath: t("tasks.diagnostics.defaultFileName", { id: task.id.slice(0, 8) }),
      filters: [{ name: t("tasks.diagnostics.textFileType"), extensions: ["txt"] }]
    });
    if (!target) return;
    try {
      await exportTaskDiagnostics(task.id, target);
      notifications.show({ message: t("tasks.diagnostics.exported"), color: "teal" });
    } catch (error) {
      notifications.show({ message: String(error), color: "red" });
    }
  };

  const notifyOpenError = (what: string) => (error: unknown) => {
    notifications.show({
      message: t("tasks.openFailed", { what, error: String(error) }),
      color: "red"
    });
  };

  const openLogFile = () => {
    const path = task.logPath;
    if (path) openPath(path).catch(notifyOpenError(t("tasks.logFile")));
  };

  const revealOutput = () => {
    const path = task.outputPaths[0];
    if (!path) {
      if (task.workingDir)
        openPath(task.workingDir).catch(notifyOpenError(t("tasks.outputLocation")));
      return;
    }
    if (task.feature === "media") {
      revealItemInDir(path).catch(notifyOpenError(t("tasks.outputLocation")));
      return;
    }
    const separator = isWindows ? "\\" : "/";
    const directory = path.endsWith("\\") || path.endsWith("/") ? path : path + separator;
    openPath(directory).catch(notifyOpenError(t("tasks.outputLocation")));
  };

  return (
    <Card padding="sm" className={cn("border-l-[3px]", status.borderClass)}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          id={`task-title-${task.id}`}
          onClick={() => setOpened((value) => !value)}
          aria-expanded={opened}
          aria-controls={contentId}
          className="group flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
          <CaretRight
            size={16}

            aria-hidden="true"
            className={
              opened
                ? "shrink-0 rotate-90 text-muted-foreground transition-transform duration-150 group-hover:text-foreground"
                : "shrink-0 rotate-0 text-muted-foreground transition-transform duration-150 group-hover:text-foreground"
            }
          />
          <StatusIcon
            size={16}

            role="img"
            aria-label={t(status.labelKey)}
            className={`shrink-0 ${status.toneClass} ${status.spinning ? "task-status-spinning" : ""}`}
          />
          <span className="truncate text-sm font-medium" title={task.title}>
            {task.title}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          {task.intent.type === "form" && onReuse && (
            <Tooltip label={t("tasks.action.reuse")}>
              <IconButton
                label={t("tasks.action.reuse")}
                variant="ghost"
                size="sm"
                className="task-action"
                onClick={() => onReuse(task)}
              >
                <Copy size={16} />
              </IconButton>
            </Tooltip>
          )}
          {cancellable && (
            <Tooltip label={t("tasks.action.cancel")}>
              <IconButton
                label={t("tasks.action.cancel")}
                variant="ghost"
                size="sm"
                className="task-action"
                onClick={() => onCancel(task.id)}
              >
                <X size={16} />
              </IconButton>
            </Tooltip>
          )}
          {task.status === "interrupted" && onRerun && (
            <Tooltip label={t("tasks.action.rerun")}>
              <IconButton
                label={t("tasks.action.rerun")}
                variant="ghost"
                size="sm"
                className="task-action"
                onClick={() => onRerun(task)}
              >
                <ArrowsClockwise size={16} />
              </IconButton>
            </Tooltip>
          )}
          {task.logPath && (
            <Tooltip label={t("tasks.action.openLog")}>
              <IconButton
                label={t("tasks.action.openLog")}
                variant="ghost"
                size="sm"
                className="task-action"
                onClick={openLogFile}
              >
                <FileText size={16} />
              </IconButton>
            </Tooltip>
          )}
          {TERMINAL_STATUSES.has(task.status) && (
            <Tooltip label={t("tasks.action.exportDiagnostics")}>
              <IconButton
                label={t("tasks.action.exportDiagnostics")}
                variant="ghost"
                size="sm"
                className="task-action"
                onClick={() => void exportDiagnostics()}
              >
                <FileArrowDown size={16} />
              </IconButton>
            </Tooltip>
          )}
          {(task.outputPaths[0] || task.workingDir) && (
            <Tooltip label={t("tasks.action.openOutput")}>
              <IconButton
                label={t("tasks.action.openOutput")}
                variant="ghost"
                size="sm"
                className="task-action task-action-open"
                onClick={revealOutput}
              >
                <FolderOpen size={16} />
              </IconButton>
            </Tooltip>
          )}
          {TERMINAL_STATUSES.has(task.status) && (
            <Tooltip label={t("tasks.action.delete")}>
              <IconButton
                label={t("tasks.action.delete")}
                variant="ghost"
                size="sm"
                className="task-action task-action-danger"
                onClick={() => onDelete(task.id)}
              >
                <Trash size={16} />
              </IconButton>
            </Tooltip>
          )}
        </div>
      </div>

      {task.feature === "aria2" && task.status === "running" && task.progress?.detail && (
        <div className="mt-1 flex items-start gap-2.5 text-xs text-muted-foreground">
          <span aria-hidden="true" className="w-4 shrink-0" />
          <span aria-hidden="true" className="w-4 shrink-0" />
          <span className="min-w-0 break-words">{task.progress.detail}</span>
        </div>
      )}

      {bar && (
        <div className="mt-1.5">
          <Progress
            value={bar.value}
            color={bar.color}
            indeterminate={bar.indeterminate}
            aria-label={`${task.title} · ${t(status.labelKey)}`}
          />
        </div>
      )}

      <Collapse open={opened} id={contentId}>
        <div className="mt-2.5 flex flex-col gap-2.5">
          <code className="block whitespace-pre-wrap break-all rounded-md bg-muted px-3 py-2 text-xs leading-relaxed">
            {task.tool} {task.argvRedacted.join(" ")}
          </code>
          {task.status === "queued" && (
            <div>
              <Tooltip label={t("tasks.action.promote")}>
                <IconButton
                  label={t("tasks.action.promote")}
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => onPromote(task.id)}
                >
                  <ArrowUp size={16} />
                </IconButton>
              </Tooltip>
            </div>
          )}
          {task.status === "interrupted" && (
            <span className="text-xs text-muted-foreground">
              {task.startedAt
                ? t("tasks.interruptedAfterStart")
                : t("tasks.interruptedBeforeStart")}
            </span>
          )}
          {failedTail && (
            <code className="block whitespace-pre-wrap rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium leading-relaxed text-destructive">
              {failedTail.map((l) => l.line).join("\n")}
            </code>
          )}
        </div>
      </Collapse>
    </Card>
  );
});
