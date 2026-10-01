import { useRef } from "react";
import { Box, Indicator, Tooltip } from "@mantine/core";
import type { AppRoute } from "../../app/route";
import type { L1NavigationItem } from "../../app/navigation";
import { t } from "../../locale";
import { useTasksStore } from "../../stores/tasks";
import { headerTooltipProps } from "./HeaderActions";

type AppSection = AppRoute["section"];

interface TopNavigationProps {
  items: readonly L1NavigationItem[];
  active: AppSection;
  onNavigate: (section: AppSection) => void;
  statuses?: Partial<Record<AppSection, NavigationStatus>>;
}

export interface NavigationStatus {
  count: number;
  label: string;
  color: string;
}

const DRAW_DURATION_MS = 700;
const DRAW_EASING = "cubic-bezier(0.45, 0, 0.2, 1)";

const ACTIVE_TASK_STATUSES = ["queued", "running", "canceling"];

function useTasksStatus(): NavigationStatus | null {
  const count = useTasksStore(
    (state) =>
      Object.values(state.tasks).filter((task) => ACTIVE_TASK_STATUSES.includes(task.status)).length
  );
  if (count === 0) return null;
  return { count, label: t("app.activeTasksLabel", { count }), color: "blue" };
}

export function TopNavigation({ items, active, onNavigate, statuses }: TopNavigationProps) {
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tasksStatus = useTasksStatus();

  const drawIcon = (index: number) => {
    const node = itemRefs.current[index];
    if (!node) return;
    node.querySelectorAll<SVGPathElement>("svg path").forEach((path) => {
      const length = path.getTotalLength();
      path.animate(
        [
          { strokeDasharray: `${length}`, strokeDashoffset: `${length}` },
          { strokeDasharray: `${length}`, strokeDashoffset: "0" }
        ],
        { duration: DRAW_DURATION_MS, easing: DRAW_EASING }
      );
    });
  };

  return (
    <Tooltip.Group openDelay={300} closeDelay={100}>
      <Box
        component="nav"
        aria-label={t("shell.primaryNav")}
        className="top-nav"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: 4,
          borderRadius: "calc(var(--mantine-radius-md) + 4px)"
        }}
      >
        {items.map(({ section, labelKey, icon: Icon }, index) => {
          const isActive = active === section;
          const status = section === "tasks" ? tasksStatus : statuses?.[section];
          const running = section === "tasks" && (status?.count ?? 0) > 0;
          const label = t(labelKey);
          return (
            <Tooltip
              key={section}
              {...headerTooltipProps}
              position="top"
              label={status ? `${label} · ${status.label}` : label}
              events={{ hover: true, focus: true, touch: false }}
            >
              <Box
                component="button"
                type="button"
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                className={[
                  "top-nav-item",
                  isActive ? "top-nav-item-active" : undefined,
                  running ? "top-nav-task-running" : undefined
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-label={status ? `${label}，${status.label}` : label}
                aria-current={isActive ? "page" : undefined}
                onClick={() => {
                  onNavigate(section);
                  if (!running) drawIcon(index);
                }}
              >
                <Indicator
                  disabled={!status || status.count === 0}
                  label={status && status.count > 99 ? "99+" : status?.count}
                  color={status?.color}
                  size={16}
                  offset={3}
                >
                  <Icon size={24} stroke={1.7} />
                </Indicator>
              </Box>
            </Tooltip>
          );
        })}
      </Box>
    </Tooltip.Group>
  );
}
