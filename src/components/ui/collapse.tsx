import type { ComponentPropsWithRef } from "react";
import { cn } from "../../lib/cn";

export type CollapseProps = ComponentPropsWithRef<"div"> & {
  /** 是否展开 */
  open: boolean;
};

/**
 * 展开/收起容器：grid-rows 0fr ↔ 1fr 过渡实现高度自适应动画（替代 Mantine Collapse，无需 JS 测量高度）。
 * 内容始终渲染（动画需要）；收起态高度为 0 且叠加 inert，内容不可聚焦/不可交互，配合 aria-hidden 对辅助技术等效隐藏。
 */
export function Collapse({ open, className, children, ...props }: CollapseProps) {
  return (
    <div
      aria-hidden={!open}
      inert={!open}
      className={cn(
        "grid transition-[grid-template-rows] duration-200 ease-out",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        className
      )}
      {...props}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}
