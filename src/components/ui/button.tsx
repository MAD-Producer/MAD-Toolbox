import { cva, type VariantProps } from "class-variance-authority";
import { CircleNotch } from "@phosphor-icons/react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { cn } from "../../lib/cn";

export const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
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
        sm: "h-8 px-3",
        md: "h-9 px-4",
        lg: "h-10 px-5",
        icon: "size-9"
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "md"
    }
  }
);

export type ButtonProps = ComponentPropsWithRef<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** 左侧渲染 loading spinner 并禁用点击 */
    loading?: boolean;
    /** 左侧图标/内容（loading 时被 spinner 替换） */
    leftSection?: ReactNode;
    /** 右侧图标/内容 */
    rightSection?: ReactNode;
  };

export function Button({
  className,
  variant,
  size,
  loading = false,
  leftSection,
  rightSection,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      disabled={disabled ?? loading}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {loading ? <CircleNotch size={16} className="animate-spin" /> : leftSection}
      {children}
      {rightSection}
    </button>
  );
}
