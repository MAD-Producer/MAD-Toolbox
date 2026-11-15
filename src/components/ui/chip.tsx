import type { ComponentPropsWithRef } from "react";
import { cn } from "../../lib/cn";

export type ChipProps = ComponentPropsWithRef<"button"> & {
  /** 选中态（受控，由调用方切换） */
  selected?: boolean;
};

/**
 * 可切换筛选 chip（替代 Mantine Chip）：多选筛选场景的圆角小按钮，
 * aria-pressed 表达开关语义。组合方式为直接罗列，不提供 Group 容器。
 */
export function Chip({ selected = false, className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        selected
          ? "border-primary/30 bg-accent text-accent-foreground hover:bg-accent/80"
          : "border-border bg-card text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
