import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "icon";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 font-medium transition-precision focus-ring disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none",
          "rounded-[6px] text-[13px] leading-none",
          variant === "primary" &&
            "bg-accent text-white hover:bg-accent-hover border border-transparent",
          variant === "secondary" &&
            "bg-surface text-ink-primary border border-strong hover:bg-subtle",
          variant === "ghost" &&
            "bg-transparent text-ink-secondary hover:text-ink-primary hover:bg-subtle border border-transparent",
          variant === "danger" &&
            "bg-danger text-white hover:opacity-90 border border-transparent",
          size === "sm" && "h-7 px-2.5 text-[12px]",
          size === "md" && "h-8 px-3",
          size === "icon" && "h-8 w-8 p-0",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
