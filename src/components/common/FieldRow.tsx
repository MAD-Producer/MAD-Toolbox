import { useId, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Switch } from "../ui/switch";

/** 标签列固定宽度，与操作列的间距节奏（与 SwitchRow 同为 14px 表单标签字阶） */
const LABEL_CLASS = "w-40 shrink-0 pt-1.5 text-sm font-medium";

interface FieldRowProps {
  label: ReactNode;
  description?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  /** 关联右侧控件的 id（label[for]，读屏/点击聚焦）；控件类字段必传 */
  htmlFor?: string;
  /** hint 文本的 DOM id，供控件 aria-describedby 关联 */
  hintId?: string;
}

/** 表单行：左标签（160px，可经 htmlFor 关联控件）+ 右控件；hint/description 为弱化小字 */
export function FieldRow({ label, description, hint, children, htmlFor, hintId }: FieldRowProps) {
  return (
    <div className="flex items-start gap-3">
      <div className={LABEL_CLASS}>
        {htmlFor ? (
          <label htmlFor={htmlFor} className="block">
            {label}
          </label>
        ) : (
          label
        )}
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="min-w-0 flex-1">
        {children}
        {hint ? (
          <p id={hintId} className="mt-1 text-xs text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}

interface SwitchRowProps {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

/** 开关行：label 包裹开关（整行热区，无文字死区；视觉尺寸不变）。阻断冒泡避免瓦片 onClick 二次切换 */
function SwitchRow({ label, checked, disabled, onChange }: SwitchRowProps) {
  return (
    <label
      className="flex cursor-pointer items-center justify-between gap-2"
      onClick={(event) => event.stopPropagation()}
    >
      <span className="text-sm font-medium">{label}</span>
      <Switch
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </label>
  );
}

export interface SwitchTileItem {
  key: string;
  label: string;
  checked: boolean;
  onToggle: (checked: boolean) => void;
}

/**
 * 开关瓦片网格：容器查询分栏（学 MangoDisk 同构）——视口断点在桌面恒激活，
 * 900px 最小窗口下 4 列会挤压到 64px/瓦片；按容器实际宽度分栏。
 */
const GRID_COLS: Record<2 | 3 | 4, string> = {
  2: "@[20rem]:grid-cols-2",
  3: "@[30rem]:grid-cols-3",
  4: "@[40rem]:grid-cols-4"
};

export function SwitchTileGrid({
  items,
  columns = 4,
  disabled
}: {
  items: ReadonlyArray<SwitchTileItem>;
  columns?: 2 | 3 | 4;
  disabled?: boolean;
}) {
  return (
    <div className="@container">
      <div className={cn("grid grid-cols-1 gap-3", GRID_COLS[columns])}>
        {items.map((item) => (
          <div
            key={item.key}
            className={cn(
              "rounded-md border p-2.5",
              !disabled && "cursor-pointer"
            )}
            onClick={() => !disabled && item.onToggle(!item.checked)}
          >
            <SwitchRow
              label={item.label}
              checked={item.checked}
              disabled={disabled}
              onChange={item.onToggle}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/** 分组容器：描边卡片 + 蓝色小标题（页面高级选项的字段分组）；role=group 关联标题供读屏分节 */
export function OptionGroup({ title, children }: { title: string; children: ReactNode }) {
  const titleId = useId();
  return (
    <div role="group" aria-labelledby={titleId} className="flex flex-col gap-4 rounded-md border p-4">
      <p id={titleId} className="text-sm font-semibold text-primary">
        {title}
      </p>
      {children}
    </div>
  );
}
