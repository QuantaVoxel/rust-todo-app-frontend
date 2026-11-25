import { AlertCircle, CheckCircle2, Circle, CircleDashed, XCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function StatusIcon({
  status,
  className,
}: {
  status?: string | null;
  className?: string;
}) {
  const normalized = status?.toLowerCase() ?? "pending";

  if (normalized === "completed") {
    return (
      <CheckCircle2
        className={cn("h-4 w-4 text-[#16A34A]", className)}
        strokeWidth={1.75}
      />
    );
  }
  if (normalized === "in_progress") {
    return (
      <Circle
        className={cn("h-4 w-4 text-[#2563EB] fill-[#2563EB]/25", className)}
        strokeWidth={1.75}
      />
    );
  }
  if (normalized === "cancelled") {
    return (
      <XCircle
        className={cn("h-4 w-4 text-[#A1A1AA]", className)}
        strokeWidth={1.75}
      />
    );
  }
  return (
    <CircleDashed
      className={cn("h-4 w-4 text-[#71717A]", className)}
      strokeWidth={1.75}
    />
  );
}

export function PriorityIndicator({
  priority,
}: {
  priority?: string | null;
}) {
  const normalized = priority?.toLowerCase();
  if (!normalized) return null;

  if (normalized === "urgent") {
    return (
      <span
        className="inline-flex items-center gap-1 text-[11px] font-medium text-[#DC2626]"
        title="Urgent"
      >
        <AlertCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
        <span className="hidden sm:inline">Urgent</span>
      </span>
    );
  }

  const level = normalized === "high" ? 3 : normalized === "medium" ? 2 : 1;
  const color =
    normalized === "high"
      ? "bg-[#D97706]"
      : normalized === "medium"
        ? "bg-[#2563EB]"
        : "bg-[#71717A]";

  return (
    <span
      className="inline-flex items-end gap-[2px]"
      title={normalized}
      aria-label={`Priority ${normalized}`}
    >
      {[1, 2, 3].map((bar) => (
        <span
          key={bar}
          className={cn(
            "w-[2.5px] rounded-[1px]",
            bar === 1 ? "h-1.5" : bar === 2 ? "h-2.5" : "h-3.5",
            bar <= level ? color : "bg-subtle"
          )}
        />
      ))}
    </span>
  );
}

export function formatStatusLabel(status?: string | null): string {
  switch (status?.toLowerCase()) {
    case "in_progress":
      return "In Progress";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return "Pending";
  }
}
