import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface FieldWithActionsProps extends ComponentPropsWithoutRef<"div"> {
  children: ReactNode;
  actions?: ReactNode;
}

/** 控件行：输入控件占满 + 右侧动作按钮列（不换行，间距 8px） */
export function FieldWithActions({ children, actions, className, ...props }: FieldWithActionsProps) {
  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      <div className="min-w-0 flex-1">{children}</div>
      {actions}
    </div>
  );
}
