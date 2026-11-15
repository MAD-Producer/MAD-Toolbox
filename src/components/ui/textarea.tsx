import { useEffect, useRef, type ComponentPropsWithRef } from "react";
import { cn } from "../../lib/cn";

export type TextareaProps = ComponentPropsWithRef<"textarea"> & {
  /** 校验失败态：红色描边 + 红色 focus 环 */
  invalid?: boolean;
  /** 自适应高度：内容变化时按滚动高度重设（替代 Mantine Textarea autosize） */
  autosize?: boolean;
};

export function Textarea({ className, invalid = false, autosize = false, ...props }: TextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const value = props.value;

  useEffect(() => {
    if (!autosize) return;
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [autosize, value]);

  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground",
        "placeholder:text-muted-foreground transition-colors",
        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        autosize && "resize-none overflow-hidden",
        invalid &&
          "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30",
        className
      )}
      {...props}
    />
  );
}
