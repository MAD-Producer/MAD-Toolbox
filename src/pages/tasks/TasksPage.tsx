/**
 * 新任务中心（样板最小版）：读全局任务 store，任务卡片列表。
 * 池定义一次性拉取；占用数从任务事件推导（§8：不新增实时同步接口）。
 * 标题下方带边框汇总容器：上层当日三种状态统计，下层并发池逐行指示条；
 * 往日任务收进「历史任务」折叠区。
 */

import { Badge, Box, Button, Card, Group, Stack, Text, Title } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { notifications } from "../../lib/notifications";
import { useEffect, useMemo, useState } from "react";
import { CollapsibleSection } from "../../components/common/CollapsibleSection";
import { PoolIndicator } from "./PoolIndicator";
import { TaskCard } from "./TaskCard";
import { fetchPoolDefinitions, type PoolDefinition } from "./api";
import type { TaskEnvelope } from "../../contracts/types";
import { poolOccupancy, sortedTasks, splitByDay } from "../../stores/tasks.reducer";
import { useTasksStore } from "../../stores/tasks";

interface TasksPageProps {
  onRerun: (task: TaskEnvelope) => void;
  onReuse: (task: TaskEnvelope) => void;
}

/** 删除滑出动画时长，须与 animations.css 中 task-card-slot 的 transition 一致 */
const DELETE_ANIMATION_MS = 280;

function HeroStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Group gap="xs" wrap="nowrap" align="center">
      <Text size="lg" fw={600} lh={1}>
        {label}
      </Text>
      <Text fw={800} c={value === 0 ? "dimmed" : color} lh={1} style={{ fontSize: 28 }}>
        {value}
      </Text>
    </Group>
  );
}

export function TasksPage({ onRerun, onReuse }: TasksPageProps) {
  const tasks = useTasksStore((s) => s.tasks);
  const logs = useTasksStore((s) => s.logs);
  const cancel = useTasksStore((s) => s.cancel);
  const promote = useTasksStore((s) => s.promote);
  const remove = useTasksStore((s) => s.remove);
  const [definitions, setDefinitions] = useState<PoolDefinition[]>([]);
  const [todayOpen, setTodayOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  // 删除动画期间标记待删卡片：先滑走再调后端，失败则撤销标记
  const [exiting, setExiting] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    void fetchPoolDefinitions()
      .then(setDefinitions)
      .catch(() => {});
  }, []);

  const state = useMemo(() => ({ tasks, logs }), [tasks, logs]);
  const sorted = useMemo(() => sortedTasks(state), [state]);
  const { today, history } = useMemo(() => splitByDay(sorted), [sorted]);
  const hero = useMemo(
    () => ({
      active: today.filter(
        (t) => t.status === "queued" || t.status === "running" || t.status === "canceling"
      ).length,
      interrupted: today.filter((t) => t.status === "interrupted").length,
      finished: today.filter((t) => ["success", "failed", "canceled"].includes(t.status)).length
    }),
    [today]
  );

  const deleteTasks = (ids: string[]) => {
    setExiting((prev) => new Set([...prev, ...ids]));
    window.setTimeout(() => {
      remove(ids)
        .then((deleted) => {
          if (deleted.length > 0) {
            notifications.show({ message: `已删除 ${deleted.length} 个任务`, color: "green" });
          } else {
            notifications.show({
              message: "没有可删除的任务（活动任务不可删除）",
              color: "yellow"
            });
          }
        })
        .catch((error) => {
          setExiting((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => next.delete(id));
            return next;
          });
          notifications.show({ message: `删除任务失败：${String(error)}`, color: "red" });
        });
    }, DELETE_ANIMATION_MS);
  };

  const renderCard = (task: TaskEnvelope) => (
    <div
      key={task.id}
      className={exiting.has(task.id) ? "task-card-slot task-card-slot-exiting" : "task-card-slot"}
    >
      <TaskCard
        task={task}
        logs={logs[task.id]}
        onCancel={cancel}
        onPromote={promote}
        onDelete={(id) => deleteTasks([id])}
        onRerun={task.feature === "music" ? undefined : onRerun}
        onReuse={onReuse}
      />
    </div>
  );

  return (
    <Stack gap="md" p="md">
      <Title order={3}>任务中心</Title>
      <Card withBorder padding="lg">
        <Stack gap="md" align="center">
          <Group justify="center" gap="12%" w="100%" wrap="nowrap">
            <HeroStat label="运行中" value={hero.active} color="blue" />
            <HeroStat label="中断" value={hero.interrupted} color="yellow" />
            <HeroStat label="结束" value={hero.finished} color="green" />
          </Group>
          <Box w="100%">
            <PoolIndicator
              definitions={definitions}
              occupancy={(pool) => poolOccupancy(state, pool)}
            />
          </Box>
        </Stack>
      </Card>
      {sorted.length === 0 ? (
        <Text c="dimmed" size="sm">
          还没有任务。从功能页提交下载后会出现在这里。
        </Text>
      ) : (
        <>
          {today.length > 0 && (
            <CollapsibleSection
              title={
                <Group gap="xs" wrap="nowrap">
                  <Text size="sm" fw={500}>
                    今日任务
                  </Text>
                  <Badge variant="light" color="gray">
                    {today.length}
                  </Badge>
                </Group>
              }
              opened={todayOpen}
              onToggle={() => setTodayOpen((value) => !value)}
            >
              <Stack gap="xs">{today.map(renderCard)}</Stack>
            </CollapsibleSection>
          )}
          {history.length > 0 && (
            <CollapsibleSection
              title={
                <Group gap="xs" wrap="nowrap">
                  <Text size="sm" fw={500}>
                    历史任务
                  </Text>
                  <Badge variant="light" color="gray">
                    {history.length}
                  </Badge>
                </Group>
              }
              opened={historyOpen}
              onToggle={() => setHistoryOpen((value) => !value)}
              action={
                <Button
                  size="compact-xs"
                  variant="transparent"
                  color="red"
                  className="history-clear-all"
                  leftSection={<IconTrash size={14} />}
                  onClick={() => deleteTasks(history.map((t) => t.id))}
                >
                  全部删除
                </Button>
              }
            >
              <Stack gap="xs">{history.map(renderCard)}</Stack>
            </CollapsibleSection>
          )}
        </>
      )}
    </Stack>
  );
}
