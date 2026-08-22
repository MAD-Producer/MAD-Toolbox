/**
 * 任务卡片：左边界与状态图标按任务状态着色。
 * 收起时只显示标题行（状态 + 名称 + 取消/日志/诊断/输出位置/删除）与状态进度条；
 * 展开后显示完整命令、置顶/重跑等上下文操作和失败日志尾部（§8 已定）。
 * 完整日志走 [打开日志]（shell 打开，壳不做查看器）。
 */

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
import type { TaskLogLine } from "../../stores/tasks.reducer";
import { exportTaskDiagnostics } from "./api";

const STATUS_META: Record<
  TaskStatus,
  { label: string; color: string; icon: TablerIcon; spinning?: boolean }
> = {
  queued: { label: "排队中", color: "gray", icon: IconClock },
  running: { label: "运行中", color: "orange", icon: IconLoader, spinning: true },
  canceling: { label: "取消中", color: "orange", icon: IconLoader, spinning: true },
  success: { label: "成功", color: "green", icon: IconCircleCheck },
  failed: { label: "失败", color: "red", icon: IconCircleX },
  canceled: { label: "已取消", color: "gray", icon: IconCancel },
  interrupted: { label: "中断", color: "yellow", icon: IconLinkOff }
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
      defaultPath: `MAD-诊断-${task.id.slice(0, 8)}.txt`,
      filters: [{ name: "文本文件", extensions: ["txt"] }]
    });
    if (!target) return;
    try {
      await exportTaskDiagnostics(task.id, target);
      notifications.show({ message: "诊断文件已导出", color: "teal" });
    } catch (error) {
      notifications.show({ message: String(error), color: "red" });
    }
  };

  // 打开失败（权限/文件缺失）必须有可见反馈，否则按钮形似无响应
  const notifyOpenError = (what: string) => (error: unknown) => {
    notifications.show({ message: `无法打开${what}：${String(error)}`, color: "red" });
  };

  const openLogFile = () => {
    const path = task.logPath;
    if (path) openPath(path).catch(notifyOpenError("日志文件"));
  };

  const revealOutput = () => {
    const path = task.outputPaths[0];
    if (!path) {
      if (task.workingDir) openPath(task.workingDir).catch(notifyOpenError("输出位置"));
      return;
    }
    if (task.feature === "media") {
      // 媒体任务输出的是具体文件，在所在目录中定位该文件
      revealItemInDir(path).catch(notifyOpenError("输出位置"));
      return;
    }
    // 下载类任务的输出路径是目录：补平台分隔符，让文件管理器直接进入目录内部
    const separator = isWindows ? "\\" : "/";
    const directory = path.endsWith("\\") || path.endsWith("/") ? path : path + separator;
    openPath(directory).catch(notifyOpenError("输出位置"));
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
              aria-label={status.label}
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
            <Tooltip label="复用此配置">
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
            <Tooltip label="取消">
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
            <Tooltip label="打开日志文件">
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
            <Tooltip label="导出诊断文件（脱敏）">
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
            <Tooltip label="打开输出位置">
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
            <Tooltip label="删除任务">
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
            <Tooltip label="置顶（移到队首）">
              <ActionIcon variant="subtle" onClick={() => onPromote(task.id)}>
                <IconArrowUp size={16} color="var(--mantine-color-dimmed)" />
              </ActionIcon>
            </Tooltip>
          )}
          {task.status === "interrupted" && onRerun && (
            <Group gap="xs">
              <Text size="xs" c="dimmed">
                {task.startedAt ? "上次会话中被中断" : "排队中未执行"}
              </Text>
              <Button size="compact-xs" variant="light" onClick={() => onRerun(task)}>
                再次运行
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
