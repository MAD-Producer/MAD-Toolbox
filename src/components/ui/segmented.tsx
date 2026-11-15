import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** 可选前置图标（如主题/语言选择的图标 + 文字组合） */
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SegmentedProps<T extends string>
  extends Omit<ComponentPropsWithoutRef<"div">, "onChange" | "defaultValue"> {
  /** 选项列表（互斥选择；键盘 ←→↓↑ 在选项间移动焦点） */
  options: ReadonlyArray<SegmentedOption<T>>;
  /** 当前值 */
  value: T | null;
  /** 选择回调 */
  onChange: (value: T) => void;
  /** 整组禁用 */
  disabled?: boolean;
}

/**
 * 分段选择器（替代 Mantine SegmentedControl 的表单用法）。
 * 语义为 radiogroup/radio（互斥单选，与 tab 导航区分）；roving tabindex：整组
 * 只占一个 Tab 停留点（选中项 0，其余 -1），方向键换值并移焦点。
 * L2 页签导航的用法在阶段 4 由 ui/tabs 承接，不走本件。
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  className,
  ...props
}: SegmentedProps<T>) {
  const enabled = options.filter((option) => !option.disabled);
  const activeValue = value !== null && enabled.some((option) => option.value === value) ? value : null;
  const tabStopValue = activeValue ?? enabled[0]?.value ?? null;

  return (
    <div
      role="radiogroup"
      aria-disabled={disabled || undefined}
      onKeyDown={(event) => {
        if (disabled) return;
        const currentIdx = enabled.findIndex((option) => option.value === (activeValue ?? tabStopValue));
        let nextIdx: number | null = null;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          event.preventDefault();
          nextIdx = currentIdx < 0 ? 0 : (currentIdx + 1) % enabled.length;
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          event.preventDefault();
          nextIdx = currentIdx < 0 ? enabled.length - 1 : (currentIdx - 1 + enabled.length) % enabled.length;
        }
        if (nextIdx !== null) {
          const next = enabled[nextIdx];
          if (next) {
            onChange(next.value);
            event.currentTarget
              .querySelector<HTMLButtonElement>(`[data-value="${next.value}"]`)
              ?.focus();
          }
        }
      }}
      className={cn(
        "inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg bg-muted p-1",
        disabled && "pointer-events-none opacity-50",
        className
      )}
      {...props}
    >
      {options.map((option) => {
        const active = option.value === activeValue;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            data-value={option.value}
            tabIndex={option.value === tabStopValue ? 0 : -1}
            disabled={disabled || option.disabled}
            onClick={() => !active && onChange(option.value)}
            className={cn(
              // flex-1 + justify-center：固定宽容器（如设置页 w-80）内等分填充；自然宽容器内惰性无副作用
              "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 text-sm transition-colors min-w-0",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
              active
                ? "bg-card font-medium text-foreground shadow-sm"
                : "cursor-pointer text-muted-foreground hover:text-foreground",
              option.disabled && !disabled && "cursor-not-allowed opacity-50"
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
