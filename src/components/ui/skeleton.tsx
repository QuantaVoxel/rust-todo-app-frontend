import { cn } from "@/lib/utils/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[6px] bg-subtle animate-skeleton",
        className
      )}
    />
  );
}

export function TaskRowSkeleton() {
  return (
    <div className="flex h-[44px] items-center gap-3 border-b border-hairline px-4">
      <Skeleton className="h-4 w-4 rounded-full shrink-0" />
      <Skeleton className="h-3 w-8 shrink-0" />
      <Skeleton className="h-3.5 flex-1 max-w-[320px]" />
      <div className="ml-auto flex items-center gap-3">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}
