import { CaretDown } from "@phosphor-icons/react";
import { useId, type ReactNode } from "react";
import { Card } from "../ui/card";
import { Collapse } from "../ui/collapse";

interface SettingsSectionProps {
  icon?: ReactNode;
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  opened?: boolean;
  onToggle?: () => void;
  children: ReactNode;
}

/**
 * 通用区块卡片：无标题时为纯卡片容器；带标题时为可折叠区块（标题行 +
 * 折叠内容）。API 与旧 Mantine 实现一致，调用点无需改动。
 */
export function SettingsSection({
  icon,
  title,
  description,
  action,
  opened,
  onToggle,
  children
}: SettingsSectionProps) {
  const contentId = useId();

  if (!title) {
    return <Card padding="lg">{children}</Card>;
  }

  const collapsible = typeof opened === "boolean" && typeof onToggle === "function";
  const heading = (
    <div className="flex items-center gap-3">
      {icon ? <span className="flex shrink-0 text-primary">{icon}</span> : null}
      <div className="min-w-0">
        <p className="text-base font-semibold leading-snug">{title}</p>
        {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  );

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        {collapsible ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={opened}
            aria-controls={contentId}
            className="group flex min-w-0 flex-1 cursor-pointer items-start rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            {heading}
          </button>
        ) : (
          <div className="min-w-0 flex-1">{heading}</div>
        )}
        <div className="flex shrink-0 items-center gap-2">
          {action}
          {collapsible ? (
            <CaretDown
              size={18}

              className={cnRotate(opened)}
              aria-hidden="true"
            />
          ) : null}
        </div>
      </div>
      <Collapse open={!collapsible || opened} id={contentId}>
        <div className="p-5">{children}</div>
      </Collapse>
    </Card>
  );
}

/** 折叠指示箭头：展开时旋转 180°；箭头不拦截点击（整行可点），hover 随标题行提亮 */
function cnRotate(opened: boolean): string {
  const shared =
    "pointer-events-none text-muted-foreground transition-transform duration-150 group-hover:text-foreground";
  return opened ? `shrink-0 rotate-180 ${shared}` : `shrink-0 rotate-0 ${shared}`;
}
