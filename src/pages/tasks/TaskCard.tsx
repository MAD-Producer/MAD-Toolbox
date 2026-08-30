import {
  ActionIcon,
  Button,
  Card,
  Code,
  Collapse,
  Group,
  Progress,
  Stack,
  Text,
  Tooltip,
  UnstyledButton
} from "@mantine/core";
import { notifications } from "../../lib/notifications";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  IconArrowUp,
  IconCancel,
  IconChevronRight,
  IconCircleCheck,
  IconCircleX,
  IconClock,
  IconCopyPlus,
  IconFileDownload,
  IconFileText,
  IconFolderOpen,
  IconLinkOff,
  IconLoader,
  IconTrash,
  IconX,
  type Icon as TablerIcon
} from "@tabler/icons-react";
import { useState } from "react";
import type { TaskEnvelope, TaskStatus } from "../../contracts/types";
import { isWindows } from "../../lib/platform";
import { t, type TranslationKey } from "../../locale";
import type { TaskLogLine } from "../../stores/tasks.reducer";
import { exportTaskDiagnostics } from "./api";

const STATUS_META: Record<
  TaskStatus,
  { labelKey: TranslationKey; color: string; icon: TablerIcon; spinning?: boolean }
> = {
  queued: { labelKey: "tasks.status.queued", color: "gray", icon: IconClock },
  running: { labelKey: "tasks.status.running", color: "orange", icon: IconLoader, spinning: true },
  canceling: {
    labelKey: "tasks.status.canceling",
    color: "orange",
    icon: IconLoader,
    spinning: true
  },
  success: { labelKey: "tasks.status.success", color: "green", icon: IconCircleCheck },
  failed: { labelKey: "tasks.status.failed", color: "red", icon: IconCircleX },
  canceled: { labelKey: "tasks.status.canceled", color: "gray", icon: IconCancel },
  interrupted: { labelKey: "tasks.status.interrupted", color: "yellow", icon: IconLinkOff }
};

const FAILED_TAIL_LINES = 10;

interface TaskCardProps {
  task: TaskEnvelope;
  logs?: TaskLogLine[];
  onCancel: (id: string) => void;
  onPromote: (id: string) => void;
  onDelete: (id: string) => void;
  onRerun?: (task: TaskEnvelope) => void;
  onReuse?: (task: TaskEnvelope) => void;
}

const TERMINAL_STATUSES = new Set(["success", "failed", "canceled", "interrupted"]);

interface ProgressView {
  value: number;
  color: string;
  animated: boolean;
}

function progressView(task: TaskEnvelope): ProgressView | null {
  const last = task.progress?.percent ?? null;
  switch (task.status) {
    case "queued":
      return null;
    case "running":
    case "canceling":
      return { value: last ?? 0, color: "orange", animated: true };
    case "success":
      return { value: 100, color: "green", animated: false };
    case "failed":
      return { value: last ?? 100, color: "red", animated: false };
    case "interrupted":
      return last == null ? null : { value: last, color: "yellow", animated: false };
    case "canceled":
      return last == null ? null : { value: last, color: "gray", animated: false };
  }
}

export function TaskCard({
  task,
  logs,
  onCancel,
  onPromote,
  onDelete,
  onRerun,
  onReuse
}: TaskCardProps) {
  const [opened, setOpened] = useState(false);
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
    <Card
      withBorder
      padding="sm"
      style={{ borderLeft: `3px solid var(--mantine-color-${status.color}-filled)` }}
    >
      <Group justify="space-between" wrap="nowrap">
        <UnstyledButton
          onClick={() => setOpened((value) => !value)}
          aria-expanded={opened}
          style={{ flex: "1 1 auto", minWidth: 0 }}
        >
          <Group gap="xs" wrap="nowrap">
            <IconChevronRight
              size={16}
              color="var(--mantine-color-dimmed)"
              style={{
                flexShrink: 0,
                transform: opened ? "rotate(90deg)" : "none",
                transition: "transform 150ms ease"
              }}
            />
            <StatusIcon
              size={16}
              role="img"
              aria-label={t(status.labelKey)}
              color={`var(--mantine-color-${status.color}-light-color)`}
              className={status.spinning ? "task-status-spinning" : undefined}
              style={{ flexShrink: 0 }}
            />
            <Text size="sm" fw={500} truncate>
              {task.title}
            </Text>
          </Group>
        </UnstyledButton>
        <Group gap={4} wrap="nowrap">
          {task.intent.type === "form" && onReuse && (
            <Tooltip label={t("tasks.action.reuse")}>
              <ActionIcon
                variant="transparent"
                color="gray"
                className="task-action"
                onClick={() => onReuse(task)}
              >
                <IconCopyPlus size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          {cancellable && (
            <Tooltip label={t("tasks.action.cancel")}>
              <ActionIcon
                variant="transparent"
                color="gray"
                className="task-action"
                onClick={() => onCancel(task.id)}
              >
                <IconX size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          {task.logPath && (
            <Tooltip label={t("tasks.action.openLog")}>
              <ActionIcon
                variant="transparent"
                color="gray"
                className="task-action"
                onClick={openLogFile}
              >
                <IconFileText size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          {TERMINAL_STATUSES.has(task.status) && (
            <Tooltip label={t("tasks.action.exportDiagnostics")}>
              <ActionIcon
                variant="transparent"
                color="gray"
                className="task-action"
                onClick={() => void exportDiagnostics()}
              >
                <IconFileDownload size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          {(task.outputPaths[0] || task.workingDir) && (
            <Tooltip label={t("tasks.action.openOutput")}>
              <ActionIcon
                variant="transparent"
                color="gray"
                className="task-action task-action-open"
                onClick={revealOutput}
              >
                <IconFolderOpen size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          {TERMINAL_STATUSES.has(task.status) && (
            <Tooltip label={t("tasks.action.delete")}>
              <ActionIcon
                variant="transparent"
                color="gray"
                className="task-action task-action-danger"
                onClick={() => onDelete(task.id)}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Group>

      {bar && bar.value > 0 && (
        <Progress mt={6} size="xs" value={bar.value} color={bar.color} animated={bar.animated} />
      )}

      <Collapse expanded={opened}>
        <Stack gap="xs" mt="xs">
          <Code block style={{ fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {task.tool} {task.argvRedacted.join(" ")}
          </Code>
          {task.status === "queued" && (
            <Tooltip label={t("tasks.action.promote")}>
              <ActionIcon variant="subtle" onClick={() => onPromote(task.id)}>
                <IconArrowUp size={16} color="var(--mantine-color-dimmed)" />
              </ActionIcon>
            </Tooltip>
          )}
          {task.status === "interrupted" && onRerun && (
            <Group gap="xs">
              <Text size="xs" c="dimmed">
                {task.startedAt
                  ? t("tasks.interruptedAfterStart")
                  : t("tasks.interruptedBeforeStart")}
              </Text>
              <Button size="compact-xs" variant="light" onClick={() => onRerun(task)}>
                {t("tasks.action.rerun")}
              </Button>
            </Group>
          )}
          {failedTail && (
            <Code block c="red" style={{ fontSize: 11, whiteSpace: "pre-wrap" }}>
              {failedTail.map((l) => l.line).join("\n")}
            </Code>
          )}
        </Stack>
      </Collapse>
    </Card>
  );
}
