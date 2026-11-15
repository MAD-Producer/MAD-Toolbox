import type { ComponentPropsWithRef } from "react";
import { cn } from "../../lib/cn";

export type InputProps = ComponentPropsWithRef<"input"> & {
  /** 校验失败态：红色描边 + 红色 focus 环 */
  invalid?: boolean;
};

export function Input({ className, invalid = false, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        "h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground",
        "placeholder:text-muted-foreground transition-colors",
        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        invalid &&
          "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30",
        className
      )}
      {...props}
    />
  );
}
