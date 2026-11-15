import {
  IconCircleArrowDown,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconSettings,
  type Icon as TablerIcon
} from "@tabler/icons-react";
import { useMemo, useRef, useState } from "react";
import type { NavigationStatus, SidebarGroup } from "../../app/navigation";
import type { AppRoute, AppSection } from "../../app/route";
import { cn } from "../../lib/cn";
import { t } from "../../locale";
import { useTasksStore } from "../../stores/tasks";
import { useUpdateStore } from "../../stores/update";
import { IconButton } from "../ui/icon-button";
import { Tooltip } from "../ui/tooltip";
import { AppBrand } from "./AppBrand";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "mad-toolbox:sidebar-collapsed";

const DRAW_DURATION_MS = 700;
const DRAW_EASING = "cubic-bezier(0.45, 0, 0.2, 1)";

/** 折叠过渡主曲线与时长（nav 宽度、文字 max-width、gap、padding 共用） */
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const DUR = "240ms";

/**
 * 文字/徽标显隐过渡（学 MangoDisk）：文字盒宽度独立于 nav 容器动画，
 * 配合 truncate 永不随容器挤压换行。
 * 展开：max-width 立即开始，opacity/transform 延迟 60ms 淡入；visibility 立即可见。
 * 折叠：全部立即收合淡出，visibility 延迟到动画结束（保证淡出可见）。
 * transition-delay 列表顺序须与 transition 属性列表一一对应。
 */
const LABEL_TRANSITION = `[transition:max-width_${DUR}_${EASE},opacity_120ms_ease,transform_180ms_ease,visibility_0s_linear]`;
const LABEL_COLLAPSED = `max-w-0 -translate-x-1 invisible opacity-0 [transition-delay:0s,0s,0s,${DUR}]`;
const LABEL_EXPANDED = `max-w-[150px] translate-x-0 visible opacity-100 [transition-delay:0s,60ms,60ms,0s]`;

/** 更新提示条文字（比导航项宽：无右侧徽标占位），title 补偿截断 */
const UPDATE_LABEL_TRANSITION = `[transition:max-width_${DUR}_${EASE},opacity_120ms_ease,visibility_0s_linear]`;
const UPDATE_LABEL_EXPANDED = `max-w-[170px] visible opacity-100 [transition-delay:0s,60ms,0s]`;

/** 状态徽标（展开态胶囊）显隐过渡：宽度、内边距与透明度同步收放 */
const PILL_TRANSITION = `[transition:max-width_${DUR}_${EASE},padding-inline_${DUR}_${EASE},opacity_120ms_ease]`;
const PILL_COLLAPSED = `max-w-0 px-0 opacity-0`;
const PILL_EXPANDED = `max-w-8 px-1.5 opacity-100 [transition-delay:0s,0s,60ms]`;

/** 导航按钮：hover 配色 150ms，结构尺寸（gap/padding）跟随折叠主曲线 240ms */
const ITEM_TRANSITION = `[transition:background-color_150ms_ease,color_150ms_ease,box-shadow_150ms_ease,gap_${DUR}_${EASE},padding-inline_${DUR}_${EASE}]`;

/** 分组标题显隐：宽高同时收放 + 淡入延迟（折叠态 max-w-0 防止文字撑出水平滚动条） */
const GROUP_LABEL_TRANSITION = `[transition:max-width_${DUR}_${EASE},max-height_${DUR}_${EASE},padding-block_${DUR}_${EASE},opacity_120ms_ease,visibility_0s_linear]`;
const GROUP_LABEL_COLLAPSED = `max-w-0 max-h-0 py-0 invisible opacity-0 [transition-delay:0s,0s,0s,0s,${DUR}]`;
const GROUP_LABEL_EXPANDED = `max-w-[120px] max-h-[38px] pb-1.5 pt-4 visible opacity-100 [transition-delay:0s,0s,0s,70ms,0s]`;

/** 品牌文字显隐（宽度收放 + 延迟淡入） */
const BRAND_TRANSITION = `[transition:max-width_${DUR}_${EASE},opacity_120ms_ease]`;
const BRAND_COLLAPSED = `max-w-0 opacity-0`;
const BRAND_EXPANDED = `max-w-[150px] opacity-100 [transition-delay:0s,80ms]`;

const ACTIVE_TASK_STATUSES = ["queued", "running", "canceling"];

/** 状态徽标浅底配色（展开态胶囊），color 值域为 blue | yellow | green */
const STATUS_PILL_CLASS: Record<string, string> = {
  blue: "bg-primary/15 text-primary",
  yellow: "bg-warning/15 text-warning",
  green: "bg-success/15 text-success"
};

/** 状态徽标实心配色（折叠态圆点角标） */
const STATUS_DOT_CLASS: Record<string, string> = {
  blue: "bg-primary",
  yellow: "bg-warning",
  green: "bg-success"
};

function statusPillClass(color: string): string {
  return STATUS_PILL_CLASS[color] ?? STATUS_PILL_CLASS.blue;
}

function statusDotClass(color: string): string {
  return STATUS_DOT_CLASS[color] ?? STATUS_DOT_CLASS.blue;
}

function readCollapsedFromStorage(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsedToStorage(collapsed: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, collapsed ? "1" : "0");
  } catch {}
}

/** 任务运行数徽标：与旧 TopNavigation 一致，按活动任务状态过滤任务表 */
function useTasksStatus(): NavigationStatus | null {
  const count = useTasksStore(
    (state) =>
      Object.values(state.tasks).filter((task) => ACTIVE_TASK_STATUSES.includes(task.status)).length
  );
  if (count === 0) return null;
  return { count, label: t("app.activeTasksLabel", { count }), color: "blue" };
}

interface SidebarNavItemProps {
  label: string;
  icon: TablerIcon;
  active: boolean;
  /** 状态徽标（null = 不显示） */
  status: NavigationStatus | null;
  collapsed: boolean;
  /** ref 注册回调，供描线动效定位按钮 */
  registerRef: (node: HTMLButtonElement | null) => void;
  onClick: () => void;
}

function SidebarNavItem({
  label,
  icon: Icon,
  active,
  status,
  collapsed,
  registerRef,
  onClick
}: SidebarNavItemProps) {
  const button = (
    <button
      type="button"
      ref={registerRef}
      aria-label={status ? `${label} · ${status.label}` : label}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={cn(
        "flex h-9 items-center rounded-lg text-left",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
        ITEM_TRANSITION,
        collapsed ? "w-9 shrink-0 justify-center px-0" : "w-full justify-start px-2.5 gap-2.5",
        active
          ? "bg-sidebar-active font-medium text-sidebar-active-foreground"
          : "text-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <span className="relative shrink-0">
        <Icon size={20} stroke={1.7} />
        {collapsed && status !== null && status.count > 0 ? (
          <span
            className={cn(
              "absolute -right-1 -top-1 size-2.5 rounded-full",
              statusDotClass(status.color)
            )}
          />
        ) : null}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "truncate text-sm",
          LABEL_TRANSITION,
          collapsed ? LABEL_COLLAPSED : LABEL_EXPANDED
        )}
      >
        {label}
      </span>
      {status !== null && status.count > 0 ? (
        <span
          className={cn(
            "inline-flex h-5 shrink-0 items-center justify-center overflow-hidden rounded-full text-[11px] font-medium tabular-nums",
            PILL_TRANSITION,
            collapsed ? PILL_COLLAPSED : PILL_EXPANDED,
            statusPillClass(status.color)
          )}
        >
          {status.count > 99 ? "99+" : status.count}
        </span>
      ) : null}
    </button>
  );

  // Tooltip 常驻包裹（disabled 在展开态跳过 Content），切换折叠时按钮不 remount
  return (
    <Tooltip label={status ? `${label} · ${status.label}` : label} side="right" disabled={!collapsed}>
      {button}
    </Tooltip>
  );
}

export interface SidebarProps {
  route: AppRoute;
  groups: readonly SidebarGroup[];
  statuses?: Partial<Record<AppSection, NavigationStatus>>;
  onNavigate: (section: AppSection) => void;
  onOpenUpdatePage?: () => void;
}

export function Sidebar({ route, groups, statuses, onNavigate, onOpenUpdatePage }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(readCollapsedFromStorage);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const settingsRef = useRef<HTMLButtonElement | null>(null);
  const tasksStatus = useTasksStatus();
  const update = useUpdateStore((state) => state.update);

  /** 扁平化导航项并记录全局序号，供 ref 数组与描线动效对位 */
  const groupsWithIndex = useMemo(() => {
    let index = 0;
    return groups.map((group) => ({
      id: group.id,
      labelKey: group.labelKey,
      items: group.items.map((item) => ({ item, index: index++ }))
    }));
  }, [groups]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    writeCollapsedToStorage(next);
  };

  /** tasks 项优先使用内部计算的运行数，其余用外部传入 statuses */
  const statusFor = (section: AppSection): NavigationStatus | null =>
    section === "tasks" && tasksStatus !== null ? tasksStatus : statuses?.[section] ?? null;

  /** 描线动效：strokeDasharray 从全长到 0（迁移自旧 TopNavigation） */
  const drawIcon = (node: HTMLButtonElement | null) => {
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

  const handleNavigate = (section: AppSection, index: number) => {
    onNavigate(section);
    // 已在当前页或 tasks 运行中（徽标提示状态变化）时跳过描线，避免重复/误导动效
    const running = section === "tasks" && (statusFor(section)?.count ?? 0) > 0;
    if (route.section !== section && !running) drawIcon(itemRefs.current[index]);
  };

  const handleSettingsNavigate = () => {
    onNavigate("settings");
    drawIcon(settingsRef.current);
  };

  const settingsActive = route.section === "settings";
  const settingsLabel = t("shell.settings");
  const settingsStatus = statusFor("settings");
  const updateLabel =
    update !== null ? t("settings.about.updateFound", { version: update.latestVersion }) : null;
  const showUpdateHint = updateLabel !== null && onOpenUpdatePage !== undefined;

  return (
    <nav
      aria-label={t("shell.primaryNav")}
      className={cn(
        "flex h-screen shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground",
        "transition-[width] duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* 品牌区：文字盒独立收放（宽度动画期间不参与布局挤压），折叠后按钮恰好居中 */}
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <span
          aria-hidden="true"
          className={cn(
            "overflow-hidden whitespace-nowrap",
            BRAND_TRANSITION,
            collapsed ? BRAND_COLLAPSED : BRAND_EXPANDED
          )}
        >
          <AppBrand />
        </span>
        <IconButton
          label={t("shell.sidebarCollapse")}
          variant="ghost"
          size="sm"
          aria-expanded={!collapsed}
          onClick={toggleCollapsed}
        >
          {collapsed ? (
            <IconLayoutSidebarLeftExpand size={18} stroke={1.7} />
          ) : (
            <IconLayoutSidebarLeftCollapse size={18} stroke={1.7} />
          )}
        </IconButton>
      </div>

      {/* 分组导航 */}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-y-2.5 overflow-y-auto px-3",
          collapsed && "items-center"
        )}
      >
        {groupsWithIndex.map((group) => (
          <div
            key={group.id}
            className="flex flex-col gap-y-0.5"
            role={group.labelKey !== null ? "group" : undefined}
            aria-label={group.labelKey !== null ? t(group.labelKey) : undefined}
          >
            {group.labelKey !== null ? (
              <div
                aria-hidden="true"
                className={cn(
                  "overflow-hidden px-2.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted",
                  GROUP_LABEL_TRANSITION,
                  collapsed ? GROUP_LABEL_COLLAPSED : GROUP_LABEL_EXPANDED
                )}
              >
                {t(group.labelKey)}
              </div>
            ) : null}
            {group.items.map(({ item, index }) => {
              const label = t(item.labelKey);
              return (
                <SidebarNavItem
                  key={item.section}
                  label={label}
                  icon={item.icon}
                  active={route.section === item.section}
                  status={statusFor(item.section)}
                  collapsed={collapsed}
                  registerRef={(node) => {
                    itemRefs.current[index] = node;
                  }}
                  onClick={() => handleNavigate(item.section, index)}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* 底部 settings 区 */}
      <div
        className={cn(
          "flex shrink-0 flex-col gap-1 border-t border-sidebar-border p-3",
          collapsed && "items-center"
        )}
      >
        {showUpdateHint && updateLabel !== null ? (
          <Tooltip label={updateLabel} side="right" disabled={!collapsed}>
            <button
              type="button"
              aria-label={updateLabel}
              onClick={onOpenUpdatePage}
              className={cn(
                "flex h-9 shrink-0 items-center rounded-lg text-left",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
                "hover:bg-success/10",
                ITEM_TRANSITION,
                collapsed ? "w-9 justify-center px-0" : "w-full justify-start px-2.5 gap-2.5"
              )}
            >
              <IconCircleArrowDown size={20} stroke={1.7} className="shrink-0" />
              <span
                className={cn(
                  "truncate text-xs",
                  UPDATE_LABEL_TRANSITION,
                  collapsed ? LABEL_COLLAPSED : UPDATE_LABEL_EXPANDED
                )}
                aria-hidden="true"
                title={updateLabel}
              >
                {updateLabel}
              </span>
            </button>
          </Tooltip>
        ) : null}
        <SidebarNavItem
          label={settingsLabel}
          icon={IconSettings}
          active={settingsActive}
          status={settingsStatus}
          collapsed={collapsed}
          registerRef={(node) => {
            settingsRef.current = node;
          }}
          onClick={handleSettingsNavigate}
        />
      </div>
    </nav>
  );
}
