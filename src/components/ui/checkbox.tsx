import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "@phosphor-icons/react";
import type { ComponentPropsWithRef } from "react";
import { cn } from "../../lib/cn";

export type CheckboxProps = Omit<ComponentPropsWithRef<typeof CheckboxPrimitive.Root>, "onChange">;

/** 复选框：Radix 语义，行内选中用；点击行整行选中的表格场景由调用方停止冒泡 */
export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "peer size-4 shrink-0 cursor-pointer rounded-sm border border-input bg-card shadow-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        "data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
        "data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        {props.checked === "indeterminate" ? (
          <Minus size={12} weight="bold" />
        ) : (
          <Check size={12} weight="bold" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
