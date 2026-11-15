import { cva, type VariantProps } from "class-variance-authority";
import { IconLoader2 } from "@tabler/icons-react";
import type { ComponentPropsWithRef } from "react";
import { cn } from "../../lib/cn";

export const iconButtonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary-hover",
        outline: "border border-input bg-transparent hover:bg-secondary",
        ghost: "hover:bg-secondary",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive-hover"
      },
      size: {
        sm: "size-8",
        md: "size-9"
      }
    },
    defaultVariants: {
      variant: "secondary",
      size: "md"
    }
  }
);

export type IconButtonProps = ComponentPropsWithRef<"button"> &
  VariantProps<typeof iconButtonVariants> & {
    /** 无障碍名称（图标按钮必填，渲染为 aria-label） */
    label: string;
    /** 高亮选中态（浅蓝底 + 深蓝字） */
    active?: boolean;
    /** 左侧渲染 loading spinner 并禁用点击（children 图标被替换） */
    loading?: boolean;
  };

export function IconButton({
  label,
  active = false,
  loading = false,
  variant,
  size,
  className,
  type = "button",
  children,
  disabled,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      aria-busy={loading || undefined}
      data-active={active || undefined}
      disabled={disabled ?? loading}
      className={cn(
        iconButtonVariants({ variant, size }),
        active && "bg-accent text-accent-foreground",
        className
      )}
      {...props}
    >
      {loading ? <IconLoader2 size={20} stroke={1.7} className="animate-spin" /> : children}
    </button>
  );
}
