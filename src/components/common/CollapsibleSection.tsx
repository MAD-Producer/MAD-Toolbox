import { CaretRight } from "@phosphor-icons/react";
import { useId, type ReactNode } from "react";
import { Card } from "../ui/card";
import { Collapse } from "../ui/collapse";

interface CollapsibleSectionProps {
  title: ReactNode;
  opened: boolean;
  onToggle: () => void;

  action?: ReactNode;
  children: ReactNode;
}

/** 紧凑型折叠卡片：行内标题（右箭头指示）+ 折叠内容，用于页内二级折叠 */
export function CollapsibleSection({
  title,
  opened,
  onToggle,
  action,
  children
}: CollapsibleSectionProps) {
  const contentId = useId();

  return (
    <Card padding="sm">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={opened}
          aria-controls={contentId}
          className="group flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
          <CaretRight
            size={16}

            aria-hidden="true"
            className={
              opened
                ? "shrink-0 rotate-90 text-muted-foreground transition-transform duration-150 group-hover:text-foreground"
                : "shrink-0 rotate-0 text-muted-foreground transition-transform duration-150 group-hover:text-foreground"
            }
          />
          {title}
        </button>
        {action}
      </div>
      <Collapse open={opened} id={contentId}>
        <div className="pt-4">{children}</div>
      </Collapse>
    </Card>
  );
}
