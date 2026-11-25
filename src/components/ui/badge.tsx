import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "neutral" | "accent" | "success" | "warning" | "danger";
}

export function Badge({
  className,
  variant = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[6px] px-1.5 py-0.5 text-[11px] font-medium leading-4 border",
        variant === "neutral" &&
          "bg-subtle text-ink-secondary border-hairline",
        variant === "accent" &&
          "bg-accent-tint text-accent border-transparent",
        variant === "success" &&
          "bg-success-tint text-success border-transparent",
        variant === "warning" &&
          "bg-warning-tint text-warning border-transparent",
        variant === "danger" &&
          "bg-danger-tint text-danger border-transparent",
        className
      )}
      {...props}
    />
  );
}
