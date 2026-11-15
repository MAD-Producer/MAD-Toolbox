import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithRef } from "react";
import { cn } from "../../lib/cn";

export const badgeVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-secondary text-secondary-foreground",
        primary: "bg-accent text-accent-foreground",
        solid: "bg-primary text-primary-foreground",
        success: "bg-success/10 text-success",
        warning: "bg-warning/10 text-warning",
        error: "bg-destructive/10 text-destructive"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export type BadgeProps = ComponentPropsWithRef<"span"> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
