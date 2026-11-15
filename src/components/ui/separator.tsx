import type { ComponentPropsWithRef } from "react";
import { cn } from "../../lib/cn";

export type SeparatorProps = ComponentPropsWithRef<"div"> & {
  /** 分隔线方向 */
  orientation?: "horizontal" | "vertical";
};

export function Separator({ orientation = "horizontal", className, ...props }: SeparatorProps) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-px w-full" : "w-px self-stretch",
        className
      )}
      {...props}
    />
  );
}
