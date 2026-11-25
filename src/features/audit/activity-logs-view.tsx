"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { ActivityLogResponse, PaginatedResponse } from "@/lib/api/types";
import { formatDateTime } from "@/lib/utils/format";

export function ActivityLogsView() {
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  const queryParams = {
    entity_type: entityType.trim() || undefined,
    action: action.trim() || undefined,
    from: fromDate ? new Date(`${fromDate}T00:00:00Z`).toISOString() : undefined,
    to: toDate ? new Date(`${toDate}T23:59:59Z`).toISOString() : undefined,
    page,
    per_page: 25,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["activity-logs", queryParams],
    queryFn: () =>
      apiFetch<PaginatedResponse<ActivityLogResponse>>(
        endpoints.activityLogs(queryParams)
      ),
    placeholderData: keepPreviousData,
  });

  const logs = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-hairline px-6">
        <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-ink-primary">
          Activity Logs
        </h1>
        {meta && (
          <span className="font-mono text-[12px] text-ink-muted tabular-nums">
            {meta.total} events
          </span>
        )}
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-2.5 border-b border-hairline bg-canvas/50 px-6 py-2.5">
        <Input
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            setPage(1);
          }}
          placeholder="Entity type (e.g., task)"
          className="h-8 w-[180px] text-[12px]"
        />
        <Input
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          placeholder="Action (e.g., task.create)"
          className="h-8 w-[200px] text-[12px]"
        />
        <input
          type="date"
          aria-label="From date"
          value={fromDate}
          onChange={(e) => {
            setFromDate(e.target.value);
            setPage(1);
          }}
          className="h-8 rounded-[6px] border border-hairline bg-subtle px-2 font-mono text-[11px] text-ink-secondary focus-ring"
        />
        <span className="text-[11px] text-ink-muted">-</span>
        <input
          type="date"
          aria-label="To date"
          value={toDate}
          onChange={(e) => {
            setToDate(e.target.value);
            setPage(1);
          }}
          className="h-8 rounded-[6px] border border-hairline bg-subtle px-2 font-mono text-[11px] text-ink-secondary focus-ring"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-6 space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : logs.length === 0 ? (
          <p className="px-6 py-10 text-[13px] text-ink-muted">
            No activity logs match your filters.
          </p>
        ) : (
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-hairline bg-canvas text-[11px] font-medium text-ink-muted">
                <th className="px-6 py-2.5">Log ID</th>
                <th className="px-4 py-2.5">Action</th>
                <th className="px-4 py-2.5">Entity</th>
                <th className="px-4 py-2.5">Entity ID</th>
                <th className="px-6 py-2.5 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {logs.map((log) => (
                <tr key={log.log_id} className="hover:bg-subtle/40">
                  <td className="px-6 py-2.5 font-mono text-[12px] text-ink-muted tabular-nums">
                    #{log.log_id}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[12px] font-medium text-ink-primary">
                    {log.action}
                  </td>
                  <td className="px-4 py-2.5 text-ink-secondary">
                    {log.entity_type}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[12px] text-ink-secondary tabular-nums">
                    #{log.entity_id}
                  </td>
                  <td className="px-6 py-2.5 text-right font-mono text-[12px] text-ink-muted tabular-nums">
                    {formatDateTime(log.timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {meta && meta.total_pages > 1 && (
          <div className="flex items-center justify-between border-t border-hairline px-6 py-3 text-[12px] text-ink-secondary">
            <span className="font-mono tabular-nums">
              Page {meta.page} of {meta.total_pages}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={page >= meta.total_pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
