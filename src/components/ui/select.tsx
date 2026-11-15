import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, CaretDown } from "@phosphor-icons/react";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../lib/cn";

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export type SelectSeparatorProps = ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>;

/** 分隔线：Radix Separator 裸件无默认样式，这里补 shadcn 惯例的 1px 横线 */
export function SelectSeparator({ className, ...props }: SelectSeparatorProps) {
  return (
    <SelectPrimitive.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />
  );
}

export type SelectTriggerProps = ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>;

export function SelectTrigger({ className, children, ...props }: SelectTriggerProps) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        "inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground",
        "transition-colors hover:bg-secondary/50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        "data-[placeholder]:text-muted-foreground",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <CaretDown size={16} className="opacity-60" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export type SelectContentProps = ComponentPropsWithoutRef<typeof SelectPrimitive.Content>;

export function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}: SelectContentProps) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position={position}
        className={cn(
          "relative z-50 max-h-72 min-w-[8rem] overflow-hidden rounded-lg bg-popover p-1 text-popover-foreground shadow-lg",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          className
        )}
        {...props}
      >
        <SelectPrimitive.Viewport
          className={cn(
            "w-full",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] min-w-[var(--radix-select-trigger-width)]"
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export type SelectItemProps = ComponentPropsWithoutRef<typeof SelectPrimitive.Item>;

export function SelectItem({ className, children, ...props }: SelectItemProps) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none",
        "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      {/* 必须包 ItemText：触发器 SelectValue 的回显与 typeahead 均取自已选项的 ItemText 文案 */}
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2 flex size-4 items-center justify-center">
        <Check size={16} />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
