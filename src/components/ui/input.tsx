import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, hasError, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "flex h-9 w-full rounded-[6px] bg-subtle px-3 py-1.5 text-[14px] text-ink-primary placeholder:text-ink-muted",
          "border transition-precision focus-ring disabled:cursor-not-allowed disabled:opacity-50",
          hasError
            ? "border-danger focus-visible:outline-danger"
            : "border-hairline focus:border-strong focus:bg-surface",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
