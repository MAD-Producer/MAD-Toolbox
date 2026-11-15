import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { cn } from "../../lib/cn";

interface L2TabNavProps<PageId extends string> {
  items: readonly { page: PageId; label: string }[];
  value: PageId;
  onChange: (page: PageId) => void;
  badges?: Partial<Record<PageId, number>>;
  "aria-label": string;
}

/**
 * 二级页签导航（music/media/settings 三域共用）：等宽满宽 pill 页签，
 * 激活项品牌蓝底白字，徽标数琥珀色（激活时转白）。
 * 内核为 Radix Tabs（tablist/tab 语义 + Arrow 键移动），页签内容由调用方
 * 自行按 value 渲染，不使用 TabsContent。
 */
export function L2TabNav<PageId extends string>({
  items,
  value,
  onChange,
  badges,
  "aria-label": ariaLabel
}: L2TabNavProps<PageId>) {
  return (
    <Tabs value={value} onValueChange={(next) => onChange(next as PageId)}>
      <TabsList
        aria-label={ariaLabel}
        className="grid h-auto w-full auto-cols-fr grid-flow-col rounded-xl border border-border bg-transparent p-1"
      >
        {items.map(({ page, label }) => {
          const active = page === value;
          const badge = badges?.[page] ?? 0;
          return (
            <TabsTrigger
              key={page}
              value={page}
              className={cn(
                "rounded-lg px-3 py-1.5",
                "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none",
                "data-[state=inactive]:hover:bg-secondary/60"
              )}
            >
              {badge > 0 ? (
                <span className="inline-flex items-baseline gap-1.5">
                  {label}
                  <span
                    className={cn(
                      "text-xs font-medium",
                      active ? "text-primary-foreground" : "text-warning"
                    )}
                  >
                    {badge}
                  </span>
                </span>
              ) : (
                label
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
