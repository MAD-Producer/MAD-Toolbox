import { createContext, useContext, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button, Tooltip, type ButtonProps } from "@mantine/core";
import type { AppSection } from "../../app/route";

const HeaderActionsContext = createContext<HTMLElement | null>(null);

/**
 * 页面工作区把当前页的操作按钮经 Portal 渲染到顶栏右列。
 * Provider 必须包住整个 AppShell（含 WorkspaceFrame），页面才能读到挂载点。
 * 面板显隐由槽位上的 data-active-section + CSS 控制，而不是由页面卸载自己控制：
 * 工作区会话驻留挂载（WorkspaceSessionHost），隐藏工作区对 active 变化的重渲染
 * 是延迟提交的，依赖页面卸载会让切页瞬间同时闪现多个页面的按钮。
 */
export function HeaderActionsProvider({
  value,
  children
}: {
  value: HTMLElement | null;
  children: ReactNode;
}) {
  return <HeaderActionsContext.Provider value={value}>{children}</HeaderActionsContext.Provider>;
}

export const headerTooltipProps = {
  position: "bottom",
  withArrow: true,
  arrowSize: 5,
  offset: 4,
  styles: { tooltip: { padding: "3px 7px", fontSize: 11, lineHeight: 1.2 } }
} as const;

export function HeaderActions({ section, children }: { section: AppSection; children: ReactNode }) {
  const slot = useContext(HeaderActionsContext);
  if (!slot) return null;
  return createPortal(
    <Tooltip.Group openDelay={300} closeDelay={100}>
      <div className="app-header-actions-panel" data-header-actions={section}>
        {children}
      </div>
    </Tooltip.Group>,
    slot
  );
}

type HeaderIconButtonProps = ButtonProps & ComponentPropsWithoutRef<"button"> & { label: string };

/** 纯图标动作键：悬浮提示取代文字。外层 span 承接 hover，禁用态下按钮 pointer-events 关闭后提示仍可弹出 */
export function HeaderIconButton({ label, children, ...props }: HeaderIconButtonProps) {
  return (
    <Tooltip {...headerTooltipProps} label={label}>
      <span style={{ display: "inline-flex" }}>
        <Button className="app-header-icon-btn" size="compact-md" aria-label={label} {...props}>
          {children}
        </Button>
      </span>
    </Tooltip>
  );
}
