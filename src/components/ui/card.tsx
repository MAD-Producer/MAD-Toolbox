import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithRef } from "react";
import { cn } from "../../lib/cn";

export const cardVariants = cva("rounded-xl bg-card text-card-foreground", {
  variants: {
    variant: {
      bordered: "border",
      ghost: ""
    },
    padding: {
      none: "",
      sm: "p-3",
      md: "p-4",
      lg: "p-5"
    }
  },
  defaultVariants: {
    variant: "bordered",
    padding: "none"
  }
});

export type CardProps = ComponentPropsWithRef<"div"> & VariantProps<typeof cardVariants>;

/**
 * 卡片容器：白底 + 圆角表面，替代 Mantine Card。
 * - rounded-xl 对应 token --radius-xl（12px 卡片圆角，见 design-system.css）
 * - variant="bordered"（默认）对应旧 withBorder；"ghost" 为无边框纯底色分层
 * - 本体只管底色/边框/圆角；内边距走 padding 变体（none/sm/md/lg），特殊场景用 className 覆盖
 */
export function Card({ className, variant, padding, ...props }: CardProps) {
  return <div className={cn(cardVariants({ variant, padding }), className)} {...props} />;
}
