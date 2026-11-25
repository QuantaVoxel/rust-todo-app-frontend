"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type {
  LabelHistoryEntry,
  PriorityHistoryEntry,
  StatusHistoryEntry,
} from "@/lib/api/types";
import { cn } from "@/lib/utils/cn";
import { formatDateTime } from "@/lib/utils/format";
import {
  useLabelsList,
  usePrioritiesLookup,
  useStatusesLookup,
} from "@/features/tasks/queries";

interface TimelineItem {
  id: string;
  kind: "status" | "priority" | "label";
  summary: string;
  timestamp: string;
}

export function AuditTimeline({ taskId }: { taskId: number }) {
  const [filter, setFilter] = useState<"all" | "status" | "priority" | "label">(
    "all"
  );
  const { data: statuses = [] } = useStatusesLookup();
  const { data: priorities = [] } = usePrioritiesLookup();
  const { data: labels = [] } = useLabelsList();

  const { data: statusHistory = [], isLoading: sLoading } = useQuery({
    queryKey: ["tasks", taskId, "history", "status"],
    queryFn: () =>
      apiFetch<StatusHistoryEntry[]>(endpoints.taskHistoryStatus(taskId)),
  });

  const { data: priorityHistory = [], isLoading: pLoading } = useQuery({
    queryKey: ["tasks", taskId, "history", "priority"],
    queryFn: () =>
      apiFetch<PriorityHistoryEntry[]>(endpoints.taskHistoryPriority(taskId)),
  });

  const { data: labelHistory = [], isLoading: lLoading } = useQuery({
    queryKey: ["tasks", taskId, "history", "labels"],
    queryFn: () =>
      apiFetch<LabelHistoryEntry[]>(endpoints.taskHistoryLabels(taskId)),
  });

  const items = useMemo<TimelineItem[]>(() => {
    const getStatusName = (id: number | null) =>
      id ? statuses.find((s) => s.status_id === id)?.name ?? `#${id}` : "none";
    const getPriorityName = (id: number | null) =>
      id ? priorities.find((p) => p.priority_id === id)?.name ?? `#${id}` : "none";
    const getLabelName = (id: number) =>
      labels.find((l) => l.label_id === id)?.name ?? `#${id}`;

    const merged: TimelineItem[] = [
      ...statusHistory.map((h) => ({
        id: `status-${h.history_id}`,
        kind: "status" as const,
        summary: `Status changed from ${getStatusName(h.old_status_id)} to ${getStatusName(h.new_status_id)}`,
        timestamp: h.changed_at,
      })),
      ...priorityHistory.map((h) => ({
        id: `priority-${h.history_id}`,
        kind: "priority" as const,
        summary: `Priority changed from ${getPriorityName(h.old_priority_id)} to ${getPriorityName(h.new_priority_id)}`,
        timestamp: h.changed_at,
      })),
      ...labelHistory.map((h) => ({
        id: `label-${h.history_id}`,
        kind: "label" as const,
        summary: `Label "${getLabelName(h.label_id)}" ${h.action}`,
        timestamp: h.changed_at,
      })),
    ];

    return merged
      .filter((item) => filter === "all" || item.kind === filter)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
  }, [
    statusHistory,
    priorityHistory,
    labelHistory,
    statuses,
    priorities,
    labels,
    filter,
  ]);

  if (sLoading || pLoading || lLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  return (
    <div className="space-y-3">
      {/* Sub-filter Pills */}
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { id: "all", label: "All" },
            { id: "status", label: "Status" },
            { id: "priority", label: "Priority" },
            { id: "label", label: "Labels" },
          ] as const
        ).map((pill) => (
          <button
            key={pill.id}
            type="button"
            onClick={() => setFilter(pill.id)}
            className={cn(
              "rounded-[6px] border px-2 py-0.5 text-[11px] font-medium transition-precision cursor-pointer",
              filter === pill.id
                ? "border-strong bg-subtle text-ink-primary"
                : "border-hairline bg-canvas text-ink-muted hover:text-ink-secondary"
            )}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="rounded-[6px] border border-hairline bg-canvas px-3 py-2.5 text-[12px] text-ink-muted">
          No audit events recorded for this filter.
        </p>
      ) : (
        <div className="relative space-y-3 pl-4 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-hairline">
          {items.map((item) => (
            <div key={item.id} className="relative flex items-start justify-between gap-3">
              <span className="absolute -left-4 top-1.5 h-2.5 w-2.5 rounded-full border border-strong bg-surface" />
              <div className="space-y-0.5">
                <p className="text-[12px] text-ink-primary">{item.summary}</p>
                <p className="font-mono text-[11px] text-ink-muted tabular-nums">
                  {formatDateTime(item.timestamp)}
                </p>
              </div>
              <span className="shrink-0 rounded-[4px] bg-subtle px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
                {item.kind}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
