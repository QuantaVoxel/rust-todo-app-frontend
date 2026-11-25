"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  format,
  formatDistanceToNow,
  isToday,
  isYesterday,
  parseISO,
  subDays,
} from "date-fns";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  Clock,
  Copy,
  Download,
  Filter,
  RefreshCw,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { ActivityLogResponse, PaginatedResponse } from "@/lib/api/types";
import { cn } from "@/lib/utils/cn";

const ENTITY_TYPES = [
  "task",
  "subtask",
  "note",
  "comment",
  "tag",
  "category",
  "label",
  "connection",
  "profile",
  "setting",
];

function getActionBadgeVariant(
  action: string
): "success" | "accent" | "danger" | "neutral" {
  const lower = action.toLowerCase();
  if (lower.includes("create") || lower.includes("add")) return "success";
  if (lower.includes("delete") || lower.includes("remove")) return "danger";
  if (
    lower.includes("update") ||
    lower.includes("edit") ||
    lower.includes("archive")
  ) {
    return "accent";
  }
  return "neutral";
}

function getDayGroupLabel(iso: string): string {
  try {
    const dt = parseISO(iso);
    if (isToday(dt)) return "Today";
    if (isYesterday(dt)) return "Yesterday";
    return format(dt, "dd MMM yyyy");
  } catch {
    return "Earlier";
  }
}

function formatExact(iso: string): string {
  try {
    return format(parseISO(iso), "yyyy-MM-dd HH:mm:ss");
  } catch {
    return iso;
  }
}

function formatRel(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

export function ActivityLogsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldReduceMotion = useReducedMotion();

  const [entityType, setEntityType] = useState(
    searchParams.get("entity_type") ?? ""
  );
  const [entityIdInput, setEntityIdInput] = useState(
    searchParams.get("entity_id") ?? ""
  );
  const [actionInput, setActionInput] = useState(
    searchParams.get("action") ?? ""
  );
  const [debouncedAction, setDebouncedAction] = useState(actionInput);
  const [fromDate, setFromDate] = useState(searchParams.get("from") ?? "");
  const [toDate, setToDate] = useState(searchParams.get("to") ?? "");
  const [page, setPage] = useState(
    Math.max(1, Number(searchParams.get("page")) || 1)
  );
  const [perPage, setPerPage] = useState<20 | 50 | 100>(20);
  const [absoluteTime, setAbsoluteTime] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedAction(actionInput.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [actionInput]);

  // Sync filters & page to URL query
  useEffect(() => {
    const sp = new URLSearchParams();
    if (entityType) sp.set("entity_type", entityType);
    if (entityIdInput.trim()) sp.set("entity_id", entityIdInput.trim());
    if (debouncedAction) sp.set("action", debouncedAction);
    if (fromDate) sp.set("from", fromDate);
    if (toDate) sp.set("to", toDate);
    if (page > 1) sp.set("page", String(page));
    const qs = sp.toString();
    router.replace(qs ? `/activity?${qs}` : "/activity");
  }, [
    entityType,
    entityIdInput,
    debouncedAction,
    fromDate,
    toDate,
    page,
    router,
  ]);

  const parsedEntityId = entityIdInput.trim()
    ? Number(entityIdInput.trim())
    : undefined;

  const queryParams = {
    entity_type: entityType || undefined,
    entity_id:
      parsedEntityId && Number.isFinite(parsedEntityId)
        ? parsedEntityId
        : undefined,
    action: debouncedAction || undefined,
    from: fromDate ? new Date(`${fromDate}T00:00:00Z`).toISOString() : undefined,
    to: toDate ? new Date(`${toDate}T23:59:59Z`).toISOString() : undefined,
    page,
    per_page: perPage,
  };

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["activity-logs", queryParams],
    queryFn: () =>
      apiFetch<PaginatedResponse<ActivityLogResponse>>(
        endpoints.activityLogs(queryParams)
      ),
    placeholderData: keepPreviousData,
  });

  const logs = useMemo(() => data?.data ?? [], [data]);
  const meta = data?.meta;

  const activeChips: Array<{ key: string; label: string; onClear: () => void }> =
    [];
  if (entityType) {
    activeChips.push({
      key: "entity_type",
      label: `Entity: ${entityType}`,
      onClear: () => setEntityType(""),
    });
  }
  if (parsedEntityId) {
    activeChips.push({
      key: "entity_id",
      label: `ID: #${parsedEntityId}`,
      onClear: () => setEntityIdInput(""),
    });
  }
  if (debouncedAction) {
    activeChips.push({
      key: "action",
      label: `Action: ${debouncedAction}`,
      onClear: () => {
        setActionInput("");
        setDebouncedAction("");
      },
    });
  }
  if (fromDate) {
    activeChips.push({
      key: "from",
      label: `From: ${fromDate}`,
      onClear: () => setFromDate(""),
    });
  }
  if (toDate) {
    activeChips.push({
      key: "to",
      label: `To: ${toDate}`,
      onClear: () => setToDate(""),
    });
  }

  const resetFilters = () => {
    setEntityType("");
    setEntityIdInput("");
    setActionInput("");
    setDebouncedAction("");
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  const applyDatePreset = (daysBack: number) => {
    const end = format(new Date(), "yyyy-MM-dd");
    const start = format(subDays(new Date(), daysBack), "yyyy-MM-dd");
    setFromDate(start);
    setToDate(end);
    setPage(1);
  };

  const exportLogs = (fmt: "csv" | "json") => {
    if (logs.length === 0) return;
    let content = "";
    let mime = "application/json";
    if (fmt === "json") {
      content = JSON.stringify(logs, null, 2);
    } else {
      mime = "text/csv;charset=utf-8";
      const header = "log_id,user_id,action,entity_type,entity_id,timestamp\n";
      const rows = logs
        .map(
          (l) =>
            `${l.log_id},${l.user_id},"${l.action}","${l.entity_type ?? ""}",${l.entity_id ?? ""},"${l.timestamp}"`
        )
        .join("\n");
      content = header + rows;
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-logs-page-${page}.${fmt}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const groupedLogs = useMemo(() => {
    const groups: Array<{ day: string; items: ActivityLogResponse[] }> = [];
    for (const log of logs) {
      const day = getDayGroupLabel(log.timestamp);
      const last = groups[groups.length - 1];
      if (!last || last.day !== day) {
        groups.push({ day, items: [log] });
      } else {
        last.items.push(log);
      }
    }
    return groups;
  }, [logs]);

  const startIdx = meta && meta.total > 0 ? (meta.page - 1) * meta.per_page + 1 : 0;
  const endIdx = meta ? Math.min(meta.total, meta.page * meta.per_page) : 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Page Header */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-hairline px-6 py-4">
        <div>
          <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-ink-primary">
            Activity Logs
          </h1>
          <p className="mt-0.5 text-[13px] text-ink-secondary">
            Immutable audit trail of your workspace actions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setAbsoluteTime((v) => !v)}
            title="Toggle relative vs exact timestamp"
          >
            <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>{absoluteTime ? "Exact UTC" : "Relative"}</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", isFetching && "animate-spin")}
              strokeWidth={1.75}
            />
            <span>Refresh</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={logs.length === 0}
            onClick={() => exportLogs("csv")}
          >
            <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>CSV</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={logs.length === 0}
            onClick={() => exportLogs("json")}
          >
            <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>JSON</span>
          </Button>
        </div>
      </header>

      {/* Compact Multi-Filter Bar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-hairline bg-canvas/50 px-6 py-2.5">
        <select
          aria-label="Entity type"
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            setPage(1);
          }}
          className="h-8 rounded-[6px] border border-hairline bg-subtle px-2.5 text-[12px] text-ink-secondary focus-ring"
        >
          <option value="">Entity: All</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <Input
          value={actionInput}
          onChange={(e) => {
            setActionInput(e.target.value);
            setPage(1);
          }}
          placeholder="Action (e.g., task.create)"
          className="h-8 w-[180px] text-[12px]"
        />

        <Input
          type="number"
          min={1}
          value={entityIdInput}
          onChange={(e) => {
            setEntityIdInput(e.target.value);
            setPage(1);
          }}
          placeholder="Entity ID (#42)"
          className="h-8 w-[130px] font-mono text-[12px]"
        />

        <div className="flex items-center gap-1">
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

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => applyDatePreset(0)}
            className="h-7 rounded-[6px] border border-hairline bg-canvas px-2 text-[11px] text-ink-secondary hover:bg-subtle cursor-pointer"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => applyDatePreset(7)}
            className="h-7 rounded-[6px] border border-hairline bg-canvas px-2 text-[11px] text-ink-secondary hover:bg-subtle cursor-pointer"
          >
            7d
          </button>
          <button
            type="button"
            onClick={() => applyDatePreset(30)}
            className="h-7 rounded-[6px] border border-hairline bg-canvas px-2 text-[11px] text-ink-secondary hover:bg-subtle cursor-pointer"
          >
            30d
          </button>
        </div>
      </div>

      {/* Active Filter Chips */}
      {activeChips.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-hairline bg-canvas px-6 py-2">
          {activeChips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-hairline bg-surface px-2 py-0.5 text-[11px] text-ink-secondary"
            >
              <span>{chip.label}</span>
              <button
                type="button"
                aria-label={`Remove ${chip.label}`}
                onClick={() => {
                  chip.onClear();
                  setPage(1);
                }}
                className="text-ink-muted hover:text-ink-primary cursor-pointer"
              >
                <X className="h-3 w-3" strokeWidth={1.75} />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={resetFilters}
            className="ml-1 text-[11px] font-medium text-accent hover:underline cursor-pointer"
          >
            Reset filters
          </button>
        </div>
      )}

      {/* Main Audit Table / Mobile Timeline */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center">
            <p className="text-[14px] font-medium text-ink-primary">
              {activeChips.length > 0
                ? "No logs match your current filters"
                : "No activity recorded yet"}
            </p>
            <p className="mt-1 text-[13px] text-ink-secondary">
              {activeChips.length > 0
                ? "Try clearing some filters or expanding your date range."
                : "Actions across tasks, subtasks, notes, and settings appear here."}
            </p>
            {activeChips.length > 0 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-4"
                onClick={resetFilters}
              >
                Reset filters
              </Button>
            )}
          </div>
        ) : (
          <motion.div
            key={`${page}-${perPage}-${entityType}-${debouncedAction}`}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
          >
            {/* Desktop Structured Log Table */}
            <div className="hidden md:block">
              <table className="w-full border-collapse text-left text-[13px]">
                <thead className="sticky top-0 z-10 border-b border-hairline bg-canvas text-[11px] font-medium text-ink-muted">
                  <tr>
                    <th className="px-6 py-2.5 w-[180px]">Timestamp</th>
                    <th className="px-4 py-2.5">Action</th>
                    <th className="px-4 py-2.5">Entity</th>
                    <th className="px-6 py-2.5 text-right w-[100px]">
                      Log ID
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {groupedLogs.map((group) => (
                    <Fragment key={group.day}>
                      <tr className="bg-canvas/70">
                        <td
                          colSpan={4}
                          className="px-6 py-1.5 text-[11px] font-semibold text-ink-muted"
                        >
                          {group.day}
                        </td>
                      </tr>
                      {group.items.map((log) => {
                        const expanded = expandedLogId === log.log_id;
                        const isTask = log.entity_type === "task" && log.entity_id;

                        return (
                          <Fragment key={log.log_id}>
                            <tr
                              onClick={() =>
                                setExpandedLogId(expanded ? null : log.log_id)
                              }
                              className="hover:bg-subtle/40 transition-precision cursor-pointer"
                            >
                              <td
                                title={log.timestamp}
                                className="px-6 py-2.5 font-mono text-[12px] text-ink-secondary tabular-nums"
                              >
                                {absoluteTime
                                  ? formatExact(log.timestamp)
                                  : formatRel(log.timestamp)}
                              </td>
                              <td className="px-4 py-2.5">
                                <Badge
                                  variant={getActionBadgeVariant(log.action)}
                                  className="font-mono text-[11px]"
                                >
                                  {log.action}
                                </Badge>
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="rounded-[4px] border border-hairline bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-ink-secondary">
                                    {log.entity_type ?? "system"}
                                  </span>
                                  {log.entity_id !== null &&
                                    log.entity_id !== undefined &&
                                    (isTask ? (
                                      <Link
                                        href={`/tasks/${log.entity_id}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-flex items-center gap-1 font-mono text-[12px] font-medium text-accent hover:underline tabular-nums"
                                      >
                                        <span>#{log.entity_id}</span>
                                        <ArrowUpRight
                                          className="h-3 w-3"
                                          strokeWidth={1.75}
                                        />
                                      </Link>
                                    ) : (
                                      <span className="font-mono text-[12px] text-ink-primary tabular-nums">
                                        #{log.entity_id}
                                      </span>
                                    ))}
                                </div>
                              </td>
                              <td className="px-6 py-2.5 text-right font-mono text-[12px] text-ink-muted tabular-nums">
                                #{log.log_id}
                              </td>
                            </tr>
                            {expanded && (
                              <tr className="bg-canvas">
                                <td colSpan={4} className="px-6 py-3">
                                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-hairline bg-surface p-3 text-[12px]">
                                    <div className="space-y-1 font-mono text-[11px] text-ink-secondary">
                                      <p>
                                        UTC:{" "}
                                        <span className="text-ink-primary">
                                          {log.timestamp}
                                        </span>
                                      </p>
                                      <p>
                                        Payload:{" "}
                                        <span className="text-ink-muted">
                                          {JSON.stringify(log)}
                                        </span>
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => {
                                          navigator.clipboard?.writeText(
                                            String(log.log_id)
                                          );
                                          setCopiedId(log.log_id);
                                          setTimeout(
                                            () => setCopiedId(null),
                                            1500
                                          );
                                        }}
                                      >
                                        <Copy
                                          className="h-3 w-3"
                                          strokeWidth={1.75}
                                        />
                                        <span>
                                          {copiedId === log.log_id
                                            ? "Copied"
                                            : "Copy Log ID"}
                                        </span>
                                      </Button>
                                      {log.entity_id && (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setEntityIdInput(
                                              String(log.entity_id)
                                            );
                                            setPage(1);
                                          }}
                                        >
                                          <Filter
                                            className="h-3 w-3"
                                            strokeWidth={1.75}
                                          />
                                          <span>Filter by #{log.entity_id}</span>
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Compact Vertical Timeline */}
            <div className="space-y-4 p-4 md:hidden">
              {groupedLogs.map((group) => (
                <section key={group.day} className="space-y-2">
                  <h2 className="text-[11px] font-semibold text-ink-muted">
                    {group.day}
                  </h2>
                  <div className="divide-y divide-hairline rounded-[8px] border border-hairline bg-canvas">
                    {group.items.map((log) => (
                      <div key={log.log_id} className="p-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <Badge
                            variant={getActionBadgeVariant(log.action)}
                            className="font-mono text-[11px]"
                          >
                            {log.action}
                          </Badge>
                          <span className="font-mono text-[11px] text-ink-muted tabular-nums">
                            #{log.log_id}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="font-mono text-ink-secondary">
                            {log.entity_type} #{log.entity_id}
                          </span>
                          <span className="font-mono text-[11px] text-ink-muted tabular-nums">
                            {absoluteTime
                              ? formatExact(log.timestamp)
                              : formatRel(log.timestamp)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Pagination Bar */}
      {meta && (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-hairline bg-surface px-6 py-2.5 text-[12px] text-ink-secondary">
          <div className="flex items-center gap-3">
            <span className="font-mono tabular-nums">
              Showing {startIdx}–{endIdx} of {meta.total} events
            </span>
            <select
              aria-label="Rows per page"
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value) as 20 | 50 | 100);
                setPage(1);
              }}
              className="h-7 rounded-[6px] border border-hairline bg-subtle px-2 font-mono text-[11px] text-ink-secondary focus-ring"
            >
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </div>

          {meta.total_pages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </Button>
              <span className="font-mono text-[11px] tabular-nums">
                {meta.page} / {meta.total_pages}
              </span>
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
          )}
        </div>
      )}
    </div>
  );
}
