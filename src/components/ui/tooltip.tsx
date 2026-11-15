import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface TooltipProps {
  /** 提示内容 */
  label: ReactNode;
  /** 触发器（单个子元素，经 asChild 包裹） */
  children: ReactNode;
  /** 禁用提示（触发器结构保持不变，避免条件包裹导致的 remount） */
  disabled?: boolean;
  /** 打开延迟（毫秒） */
  openDelay?: number;
  /** 关闭延迟（毫秒，映射到 Provider 的 skipDelayDuration） */
  closeDelay?: number;
  /** 弹出方位 */
  side?: "top" | "right" | "bottom" | "left";
  /** 与触发器的间距 */
  sideOffset?: number;
  className?: string;
}

/**
 * Radix Tooltip 封装，API 对齐旧 Mantine 用法（label + children）。
 * 内置 Provider；内容反色（bg-foreground text-background），带 fade + slide 微动画。
 */
export function Tooltip({
  label,
  children,
  disabled = false,
  openDelay = 300,
  closeDelay = 100,
  side = "top",
  sideOffset = 6,
  className
}: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={openDelay} skipDelayDuration={closeDelay}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          {!disabled && (
            <TooltipPrimitive.Content
              side={side}
              sideOffset={sideOffset}
              className={cn(
                "z-50 select-none rounded-md bg-foreground px-[7px] py-[3px] text-[11px] leading-tight text-background",
                "data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0",
                "data-[state=instant-open]:animate-in data-[state=instant-open]:fade-in-0",
                "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
                "data-[side=top]:data-[state=delayed-open]:slide-in-from-bottom-2",
                "data-[side=bottom]:data-[state=delayed-open]:slide-in-from-top-2",
                "data-[side=left]:data-[state=delayed-open]:slide-in-from-right-2",
                "data-[side=right]:data-[state=delayed-open]:slide-in-from-left-2",
                className
              )}
            >
              {label}
            </TooltipPrimitive.Content>
          )}
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
