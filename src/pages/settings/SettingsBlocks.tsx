import type { ReactNode } from "react";

/** 设置区块卡片：外置可选标题 + 12px 圆角描边卡（内部行用 SettingsRow 或自定义内容） */
export function SettingsSectionCard({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      {title && <h3 className="px-2.5 text-sm font-semibold">{title}</h3>}
      <div className="rounded-xl border bg-card">{children}</div>
    </section>
  );
}

interface SettingsRowProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

/** 设置行：左标题（可带描述）+ 右控件，行间由父级 Divider 分隔 */
export function SettingsRow({ title, description, children }: SettingsRowProps) {
  return (
    <div className="flex items-center justify-between gap-6 px-5 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {children != null && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}
