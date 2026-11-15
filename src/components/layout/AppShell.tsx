import type { ReactNode } from "react";
import type { NavigationStatus, SidebarGroup } from "../../app/navigation";
import type { AppRoute, AppSection } from "../../app/route";
import { Sidebar } from "./Sidebar";
import { WorkspaceFrame } from "./WorkspaceFrame";

interface AppShellProps {
  route: AppRoute;
  /** 侧栏分组导航数据（含 tasks 置顶与业务分组） */
  sidebarGroups: readonly SidebarGroup[];
  onNavigatePrimary: (section: AppSection) => void;
  onOpenUpdatePage?: () => void;
  navigationStatuses?: Partial<Record<AppSection, NavigationStatus>>;
  children: ReactNode;
}

/**
 * 应用外壳：左侧 Sidebar + 右侧工作区。
 * 页面操作按钮由各页面在页内自渲染工具栏（旧的顶栏 HeaderActions portal 已移除）。
 */
export function AppShell({
  route,
  sidebarGroups,
  onNavigatePrimary,
  onOpenUpdatePage,
  navigationStatuses,
  children
}: AppShellProps) {
  return (
    <div className="app-chrome flex h-screen w-full overflow-hidden">
      <Sidebar
        route={route}
        groups={sidebarGroups}
        statuses={navigationStatuses}
        onNavigate={onNavigatePrimary}
        onOpenUpdatePage={onOpenUpdatePage}
      />
      <WorkspaceFrame>{children}</WorkspaceFrame>
    </div>
  );
}
