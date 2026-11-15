import {
  IconActivity,
  IconAlertTriangle,
  IconCalendarEvent,
  IconCircleCheck,
  IconHistory,
  IconTrash
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { notifications } from "../../lib/notifications";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SettingsSection } from "../../components/common/SettingsSection";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
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
const CLEAR_CONFIRM_MS = 3000;

/** 统计块数值语义色（对齐通知语义：蓝=进行、黄=需处理；结束为中性灰，失败数以红字脚注披露） */
const STAT_VALUE_CLASS = {
  primary: "text-primary",
  warning: "text-warning",
  muted: "text-muted-foreground"
} as const;

function StatTile({
  icon,
  label,
  value,
  color,
  footnote
}: {
  icon: ReactNode;
  label: string;
  value: number;
  color: keyof typeof STAT_VALUE_CLASS;
  footnote?: ReactNode;
}) {
  return (
    <Card padding="md">
      <div className="flex items-center gap-2.5">
        <span className="flex shrink-0 text-muted-foreground">{icon}</span>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p
        className={cn(
          "mt-3 text-[28px] font-extrabold leading-none",
          value === 0 ? "text-muted-foreground" : STAT_VALUE_CLASS[color]
        )}
      >
        {value}
      </p>
      {footnote}
    </Card>
  );
}

/** 删除完成后把焦点挪到原位置邻近的存活卡标题（批量删除的键盘/读屏路径） */
function focusNeighbourTask(removedIds: string[], before: TaskEnvelope[]) {
  const removed = new Set(removedIds);
  const alive = useTasksStore.getState().tasks;
  const firstIdx = before.findIndex((task) => removed.has(task.id));
  const candidates = [...before.slice(firstIdx + 1), ...before.slice(0, firstIdx).reverse()];
  const next = candidates.find((task) => !removed.has(task.id) && alive[task.id]);
  if (next) document.getElementById(`task-title-${next.id}`)?.focus();
}

export function TasksPage({ onRerun, onReuse }: TasksPageProps) {
  const tasks = useTasksStore((s) => s.tasks);
  const cancel = useTasksStore((s) => s.cancel);
  const promote = useTasksStore((s) => s.promote);
  const remove = useTasksStore((s) => s.remove);
  const [definitions, setDefinitions] = useState<PoolDefinition[]>([]);
  const [todayOpen, setTodayOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [exiting, setExiting] = useState<ReadonlySet<string>>(() => new Set());
  const [clearArmed, setClearArmed] = useState(false);
  const clearTimer = useRef<number | null>(null);

  // 【Effect 白名单⑤】挂载时一次性拉取任务池定义（容量展示用静态数据）
  useEffect(() => {
    void fetchPoolDefinitions()
      .then(setDefinitions)
      .catch(() => {});
  }, []);

  const disarmClear = useCallback(() => {
    setClearArmed(false);
    if (clearTimer.current !== null) {
      window.clearTimeout(clearTimer.current);
      clearTimer.current = null;
    }
  }, []);

  // 卸载时清掉确认倒计时
  useEffect(() => disarmClear, [disarmClear]);

  const sorted = useMemo(() => sortedTasks(tasks), [tasks]);
  const { today, history } = useMemo(() => splitByDay(sorted), [sorted]);
  const hero = useMemo(
    () => ({
      active: today.filter(
        (task) =>
          task.status === "queued" || task.status === "running" || task.status === "canceling"
      ).length,
      interrupted: today.filter((task) => task.status === "interrupted").length,
      finished: today.filter((task) => ["success", "failed", "canceled"].includes(task.status))
        .length,
      failed: today.filter((task) => task.status === "failed").length
    }),
    [today]
  );

  const deleteTasks = useCallback(
    (ids: string[]) => {
      // 退场动画期间的重复触发（连点/双击）直接忽略
      const pending = ids.filter((id) => !exiting.has(id));
      if (pending.length === 0) return;
      const before = sortedTasks(useTasksStore.getState().tasks);
      setExiting((prev) => new Set([...prev, ...pending]));
      window.setTimeout(() => {
        remove(pending)
          .then((deleted) => {
            setExiting((prev) => {
              const next = new Set(prev);
              pending.forEach((id) => next.delete(id));
              return next;
            });
            if (deleted.length > 0) {
              focusNeighbourTask(pending, before);
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
              pending.forEach((id) => next.delete(id));
              return next;
            });
            notifications.show({
              message: t("tasks.deleteFailed", { error: String(error) }),
              color: "red"
            });
          });
      }, DELETE_ANIMATION_MS);
    },
    [remove, exiting]
  );

  const deleteTask = useCallback((id: string) => deleteTasks([id]), [deleteTasks]);

  // 清空历史两步确认：首击进入待确认态（3 秒无操作自动还原），再击执行
  const handleClearHistory = () => {
    if (!clearArmed) {
      setClearArmed(true);
      clearTimer.current = window.setTimeout(
        () => setClearArmed(false),
        CLEAR_CONFIRM_MS
      );
      return;
    }
    disarmClear();
    deleteTasks(history.map((task) => task.id));
  };

  const renderCard = (task: TaskEnvelope) => {
    const isExiting = exiting.has(task.id);
    return (
      <div
        key={task.id}
        className={isExiting ? "task-card-slot task-card-slot-exiting" : "task-card-slot"}
        inert={isExiting || undefined}
        aria-hidden={isExiting || undefined}
      >
        <TaskCard
          task={task}
          onCancel={cancel}
          onPromote={promote}
          onDelete={deleteTask}
          onRerun={task.feature === "music" ? undefined : onRerun}
          onReuse={onReuse}
        />
      </div>
    );
  };

  return (
    <div className="min-h-full">
      <div className="flex flex-col gap-4 p-5">
        <SettingsSection>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 items-stretch gap-4">
              <StatTile
                icon={<IconActivity size={16} stroke={1.8} />}
                label={t("tasks.stat.active")}
                value={hero.active}
                color="primary"
              />
              <StatTile
                icon={<IconAlertTriangle size={16} stroke={1.8} />}
                label={t("tasks.status.interrupted")}
                value={hero.interrupted}
                color="warning"
              />
              <StatTile
                icon={<IconCircleCheck size={16} stroke={1.8} />}
                label={t("tasks.stat.finished")}
                value={hero.finished}
                color="muted"
                footnote={
                  hero.failed > 0 ? (
                    <p className="mt-1 text-xs text-destructive">
                      {t("tasks.stat.failedOf", { count: hero.failed })}
                    </p>
                  ) : null
                }
              />
            </div>
            <PoolIndicator
              definitions={definitions}
              occupancy={(pool) => poolOccupancy(tasks, pool)}
            />
          </div>
        </SettingsSection>

        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("tasks.empty")}</p>
        ) : (
          <>
            {today.length > 0 && (
              <SettingsSection
                icon={<IconCalendarEvent size={20} stroke={1.8} />}
                title={t("tasks.today")}
                action={<Badge>{today.length}</Badge>}
                opened={todayOpen}
                onToggle={() => setTodayOpen((value) => !value)}
              >
                <div className="flex flex-col gap-2.5">{today.map(renderCard)}</div>
              </SettingsSection>
            )}
            {history.length > 0 && (
              <SettingsSection
                icon={<IconHistory size={20} stroke={1.8} />}
                title={t("tasks.history")}
                action={
                  <>
                    <Badge>{history.length}</Badge>
                    {historyOpen &&
                      (clearArmed ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8 gap-1.5 px-2 text-xs"
                          onClick={handleClearHistory}
                        >
                          {t("tasks.clearHistoryConfirm", { count: history.length })}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1.5 px-2 text-xs text-destructive hover:bg-destructive/10"
                          leftSection={<IconTrash size={14} stroke={1.8} />}
                          onClick={handleClearHistory}
                        >
                          {t("tasks.clearHistory")}
                        </Button>
                      ))}
                  </>
                }
                opened={historyOpen}
                onToggle={() => {
                  if (!historyOpen) disarmClear();
                  setHistoryOpen((value) => !value);
                }}
              >
                <div className="flex flex-col gap-2.5">{history.map(renderCard)}</div>
              </SettingsSection>
            )}
          </>
        )}
      </div>
    </div>
  );
}
