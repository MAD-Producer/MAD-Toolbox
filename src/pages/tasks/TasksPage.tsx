import { Badge, Box, Button, Group, Stack, Text } from "@mantine/core";
import {
  IconActivity,
  IconAlertTriangle,
  IconCalendarEvent,
  IconCircleCheck,
  IconHistory,
  IconTrash
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { notifications } from "../../lib/notifications";
import { useEffect, useMemo, useState } from "react";
import { SettingsSection } from "../../components/common/SettingsSection";
import { PoolIndicator } from "./PoolIndicator";
import { TaskCard } from "./TaskCard";
import { fetchPoolDefinitions, type PoolDefinition } from "./api";
import type { TaskEnvelope } from "../../contracts/types";
import { t } from "../../locale";
import { poolOccupancy, sortedTasks, splitByDay } from "../../stores/tasks.reducer";
import { useTasksStore } from "../../stores/tasks";

interface TasksPageProps {
  onRerun: (task: TaskEnvelope) => void;
  onReuse: (task: TaskEnvelope) => void;
}

const DELETE_ANIMATION_MS = 280;

function StatTile({
  icon,
  label,
  value,
  color
}: {
  icon: ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Box
      p="md"
      style={{
        border: "1px solid var(--mantine-color-default-border)",
        borderRadius: "var(--mantine-radius-md)"
      }}
    >
      <Group gap="xs" wrap="nowrap" align="center">
        <Box c="var(--mantine-color-dimmed)" style={{ display: "flex" }} lh={0}>
          {icon}
        </Box>
        <Text size="sm" c="dimmed">
          {label}
        </Text>
      </Group>
      <Text fw={800} c={value === 0 ? "dimmed" : color} lh={1} mt="sm" style={{ fontSize: 28 }}>
        {value}
      </Text>
    </Box>
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
        (task) =>
          task.status === "queued" || task.status === "running" || task.status === "canceling"
      ).length,
      interrupted: today.filter((task) => task.status === "interrupted").length,
      finished: today.filter((task) => ["success", "failed", "canceled"].includes(task.status))
        .length
    }),
    [today]
  );

  const deleteTasks = (ids: string[]) => {
    setExiting((prev) => new Set([...prev, ...ids]));
    window.setTimeout(() => {
      remove(ids)
        .then((deleted) => {
          if (deleted.length > 0) {
            notifications.show({
              message: t("tasks.deletedCount", { count: deleted.length }),
              color: "green"
            });
          } else {
            notifications.show({
              message: t("tasks.deleteNoneAvailable"),
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
          notifications.show({
            message: t("tasks.deleteFailed", { error: String(error) }),
            color: "red"
          });
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
    <Box mih="100%">
      <Stack gap="md" p="lg">
        <SettingsSection>
          <Stack gap="md">
            <Group grow align="stretch">
              <StatTile
                icon={<IconActivity size={16} />}
                label={t("tasks.status.running")}
                value={hero.active}
                color="blue"
              />
              <StatTile
                icon={<IconAlertTriangle size={16} />}
                label={t("tasks.status.interrupted")}
                value={hero.interrupted}
                color="yellow"
              />
              <StatTile
                icon={<IconCircleCheck size={16} />}
                label={t("tasks.stat.finished")}
                value={hero.finished}
                color="green"
              />
            </Group>
            <PoolIndicator
              definitions={definitions}
              occupancy={(pool) => poolOccupancy(state, pool)}
            />
          </Stack>
        </SettingsSection>

        {sorted.length === 0 ? (
          <Text c="dimmed" size="sm">
            {t("tasks.empty")}
          </Text>
        ) : (
          <>
            {today.length > 0 && (
              <SettingsSection
                icon={<IconCalendarEvent size={20} stroke={1.8} />}
                title={t("tasks.today")}
                action={
                  <Badge variant="light" color="gray">
                    {today.length}
                  </Badge>
                }
                opened={todayOpen}
                onToggle={() => setTodayOpen((value) => !value)}
              >
                <Stack gap="xs">{today.map(renderCard)}</Stack>
              </SettingsSection>
            )}
            {history.length > 0 && (
              <SettingsSection
                icon={<IconHistory size={20} stroke={1.8} />}
                title={t("tasks.history")}
                action={
                  <>
                    <Badge variant="light" color="gray">
                      {history.length}
                    </Badge>
                    <Button
                      size="compact-xs"
                      variant="transparent"
                      color="red"
                      className="history-clear-all"
                      leftSection={<IconTrash size={14} />}
                      onClick={() => deleteTasks(history.map((tk) => tk.id))}
                    >
                      {t("tasks.deleteAll")}
                    </Button>
                  </>
                }
                opened={historyOpen}
                onToggle={() => setHistoryOpen((value) => !value)}
              >
                <Stack gap="xs">{history.map(renderCard)}</Stack>
              </SettingsSection>
            )}
          </>
        )}
      </Stack>
    </Box>
  );
}
