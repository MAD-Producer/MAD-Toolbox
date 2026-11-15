import { useState, type ComponentPropsWithRef } from "react";
import { cn } from "../../lib/cn";

export type NumberFieldProps = Omit<
  ComponentPropsWithRef<"input">,
  "type" | "onChange" | "value"
> & {
  /** 当前数值 */
  value?: number | null;
  /** 数值变化回调（失焦时若为空/非法则回调 null，由调用方决定回退值） */
  onChange: (value: number | null) => void;
};

/**
 * 数字输入框（替代 Mantine NumberInput 的极简用法）：原生 `<input type="number">`，
 * 保留浏览器原带上/下调节。
 * 草稿态设计：清空/输入中间态只更新显示草稿（合法值实时回调），失焦才归一化——
 * 否则受控 value 会把回退值瞬间写回输入框，用户永远无法清空重输。
 * 失焦归一化含 min/max clamp（对齐旧 Mantine NumberInput 行为；键入越界值失焦收敛到边界），
 * 未传 min/max 的调用方不受影响。
 */
export function NumberField({
  className,
  onChange,
  value,
  disabled,
  min,
  max,
  ...props
}: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft ?? (value === undefined || value === null ? "" : String(value));
  // 原生 min/max 属性类型是 string | number，clamp 前收窄为数值（无效值 → undefined 跳过 clamp）
  const minBound = min === undefined || min === "" ? undefined : Number(min);
  const maxBound = max === undefined || max === "" ? undefined : Number(max);

  return (
    <input
      type="number"
      inputMode="numeric"
      value={display}
      disabled={disabled}
      onChange={(event) => {
        const raw = event.currentTarget.value;
        setDraft(raw);
        if (raw.trim() === "") return;
        const parsed = Number(raw);
        if (!Number.isNaN(parsed)) onChange(parsed);
      }}
      onBlur={(event) => {
        const raw = event.currentTarget.value;
        setDraft(null);
        if (raw.trim() === "" || Number.isNaN(Number(raw))) {
          onChange(null);
          return;
        }
        let parsed = Number(raw);
        if (minBound !== undefined && parsed < minBound) parsed = minBound;
        if (maxBound !== undefined && parsed > maxBound) parsed = maxBound;
        onChange(parsed);
      }}
      className={cn(
        "h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground",
        "placeholder:text-muted-foreground transition-colors",
        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      min={min}
      max={max}
      {...props}
    />
  );
}
