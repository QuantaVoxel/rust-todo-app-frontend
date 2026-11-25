"use client";

import { useEffect, useState } from "react";
import {
  CheckSquare,
  LayoutGrid,
  List,
  Plus,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TaskRowSkeleton } from "@/components/ui/skeleton";
import type { TaskListQuery, TaskResponse } from "@/lib/api/types";
import { cn } from "@/lib/utils/cn";
import { formatShortDate, isOverdue } from "@/lib/utils/format";
import { useWorkspaceStore, type SmartView } from "@/stores/workspace-store";
import {
  usePrioritiesLookup,
  useStatusesLookup,
  useTasksList,
  useUpdateTask,
} from "./queries";
import { QuickCreateModal } from "./quick-create-modal";
import {
  formatStatusLabel,
  PriorityIndicator,
  StatusIcon,
} from "./task-indicators";
import { TaskInspector } from "./task-inspector";

const VIEW_TITLES: Record<SmartView, string> = {
  all: "All Tasks",
  owned: "My Tasks",
  shared: "Shared with Me",
  upcoming: "Upcoming",
  archived: "Archived",
};

export function TasksWorkspace() {
  const smartView = useWorkspaceStore((s) => s.smartView);
  const viewMode = useWorkspaceStore((s) => s.viewMode);
  const setViewMode = useWorkspaceStore((s) => s.setViewMode);
  const activeTaskId = useWorkspaceStore((s) => s.activeTaskId);
  const setActiveTaskId = useWorkspaceStore((s) => s.setActiveTaskId);
  const setQuickCreateOpen = useWorkspaceStore((s) => s.setQuickCreateOpen);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<number | undefined>();
  const [priorityFilter, setPriorityFilter] = useState<number | undefined>();
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const queryParams: TaskListQuery = {
    scope:
      smartView === "owned"
        ? "owned"
        : smartView === "shared"
          ? "shared"
          : "all",
    archived: smartView === "archived",
    status_id: statusFilter,
    priority_id: priorityFilter,
    search: debouncedSearch || undefined,
    page,
    per_page: 20,
  };

  const { data: statuses = [] } = useStatusesLookup();
  const { data: priorities = [] } = usePrioritiesLookup();
  const { data: taskPage, isLoading, isError, error } = useTasksList(queryParams);
  const updateTask = useUpdateTask();

  const tasks = taskPage?.data ?? [];
  const meta = taskPage?.meta;

  // Global keyboard shortcuts (C: Quick Create, Esc: Close Inspector)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;

      if (e.key === "Escape") {
        setActiveTaskId(null);
        return;
      }

      if (isEditable) return;

      if (e.key.toLowerCase() === "c" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setQuickCreateOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setActiveTaskId, setQuickCreateOpen]);

  const handleToggleComplete = (task: TaskResponse) => {
    const completedStatus = statuses.find((s) => s.name === "completed");
    const pendingStatus = statuses.find((s) => s.name === "pending");
    if (!completedStatus || !pendingStatus) return;

    const isCompleted = task.status?.toLowerCase() === "completed";
    updateTask.mutate({
      taskId: task.task_id,
      payload: {
        status_id: isCompleted
          ? pendingStatus.status_id
          : completedStatus.status_id,
      },
    });
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Center Main Pane */}
      <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
        {/* Top Workspace Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-hairline px-5">
          <div className="flex items-center gap-3">
            <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-ink-primary">
              {VIEW_TITLES[smartView]}
            </h1>
            {meta && (
              <span className="rounded-[4px] bg-subtle px-1.5 py-0.5 font-mono text-[11px] text-ink-muted tabular-nums">
                {meta.total}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* List / Board Switcher */}
            <div className="flex items-center rounded-[6px] border border-hairline bg-canvas p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                aria-label="List view"
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-[4px] px-2 text-[12px] font-medium transition-precision cursor-pointer",
                  viewMode === "list"
                    ? "bg-surface text-ink-primary"
                    : "text-ink-muted hover:text-ink-secondary"
                )}
              >
                <List className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span className="hidden sm:inline">List</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("board")}
                aria-label="Board view"
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-[4px] px-2 text-[12px] font-medium transition-precision cursor-pointer",
                  viewMode === "board"
                    ? "bg-surface text-ink-primary"
                    : "text-ink-muted hover:text-ink-secondary"
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span className="hidden sm:inline">Board</span>
              </button>
            </div>

            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => setQuickCreateOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>New Task</span>
            </Button>
          </div>
        </header>

        {/* Filter & Search Bar */}
        <div className="flex shrink-0 flex-wrap items-center gap-2.5 border-b border-hairline bg-canvas/50 px-5 py-2.5">
          <div className="relative flex-1 min-w-[200px] max-w-[320px]">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted"
              strokeWidth={1.75}
            />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Filter by title or description..."
              className="h-8 pl-8 text-[13px]"
            />
          </div>

          <select
            aria-label="Filter by status"
            value={statusFilter ?? ""}
            onChange={(e) => {
              setStatusFilter(e.target.value ? Number(e.target.value) : undefined);
              setPage(1);
            }}
            className="h-8 rounded-[6px] border border-hairline bg-subtle px-2.5 text-[12px] text-ink-secondary focus-ring"
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s.status_id} value={s.status_id}>
                {formatStatusLabel(s.name)}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by priority"
            value={priorityFilter ?? ""}
            onChange={(e) => {
              setPriorityFilter(
                e.target.value ? Number(e.target.value) : undefined
              );
              setPage(1);
            }}
            className="h-8 rounded-[6px] border border-hairline bg-subtle px-2.5 text-[12px] text-ink-secondary focus-ring"
          >
            <option value="">All priorities</option>
            {priorities.map((p) => (
              <option key={p.priority_id} value={p.priority_id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Workspace Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div>
              {Array.from({ length: 8 }).map((_, idx) => (
                <TaskRowSkeleton key={idx} />
              ))}
            </div>
          ) : isError ? (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <p className="text-[14px] font-medium text-danger">
                Failed to load tasks
              </p>
              <p className="mt-1 text-[13px] text-ink-secondary">
                {error instanceof Error ? error.message : "Check your connection."}
              </p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[8px] border border-hairline bg-subtle text-ink-muted">
                <CheckSquare className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <p className="text-[14px] font-medium text-ink-primary">
                No tasks match this view
              </p>
              <p className="mt-1 text-[13px] text-ink-secondary">
                Press{" "}
                <kbd className="rounded-[4px] border border-hairline bg-subtle px-1.5 py-0.5 font-mono text-[11px] text-ink-primary">
                  C
                </kbd>{" "}
                to create a new task.
              </p>
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="mt-4"
                onClick={() => setQuickCreateOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                Create task
              </Button>
            </div>
          ) : viewMode === "list" ? (
            <div>
              {tasks.map((task) => {
                const selected = activeTaskId === task.task_id;
                const overdue = isOverdue(task.due_date, task.status);
                const cancelled = task.status?.toLowerCase() === "cancelled";

                return (
                  <div
                    key={task.task_id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveTaskId(task.task_id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveTaskId(task.task_id);
                      }
                    }}
                    className={cn(
                      "flex h-[46px] items-center gap-3 border-b border-hairline px-5 transition-precision cursor-pointer focus-ring",
                      selected ? "bg-accent-tint" : "hover:bg-subtle/60"
                    )}
                  >
                    <button
                      type="button"
                      aria-label={`Toggle status for ${task.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleComplete(task);
                      }}
                      className="rounded-full p-0.5 hover:bg-subtle focus-ring cursor-pointer"
                    >
                      <StatusIcon status={task.status} />
                    </button>

                    <span className="w-10 shrink-0 font-mono text-[12px] text-ink-muted tabular-nums">
                      #{task.task_id}
                    </span>

                    <span
                      className={cn(
                        "flex-1 truncate text-[14px] font-medium",
                        cancelled
                          ? "line-through text-ink-muted"
                          : "text-ink-primary"
                      )}
                    >
                      {task.title}
                    </span>

                    <div className="flex shrink-0 items-center gap-4">
                      {task.progress_percentage > 0 && (
                        <span className="font-mono text-[11px] text-ink-muted tabular-nums">
                          {task.progress_percentage}%
                        </span>
                      )}

                      <PriorityIndicator priority={task.priority} />

                      {task.due_date && (
                        <span
                          className={cn(
                            "w-[86px] text-right font-mono text-[12px] tabular-nums",
                            overdue ? "text-danger font-medium" : "text-ink-muted"
                          )}
                        >
                          {formatShortDate(task.due_date)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Pagination Footer */}
              {meta && meta.total_pages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 text-[12px] text-ink-secondary">
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
          ) : (
            /* Kanban Board Columns */
            <div className="flex h-full gap-4 overflow-x-auto p-5">
              {statuses.map((status) => {
                const columnTasks = tasks.filter(
                  (t) => t.status_id === status.status_id
                );
                return (
                  <div
                    key={status.status_id}
                    className="flex w-[280px] shrink-0 flex-col rounded-[8px] border border-hairline bg-canvas"
                  >
                    <div className="flex h-10 items-center justify-between border-b border-hairline px-3">
                      <span className="flex items-center gap-2 text-[12px] font-semibold text-ink-primary">
                        <StatusIcon status={status.name} className="h-3.5 w-3.5" />
                        <span>{formatStatusLabel(status.name)}</span>
                      </span>
                      <span className="font-mono text-[11px] text-ink-muted tabular-nums">
                        {columnTasks.length}
                      </span>
                    </div>

                    <div className="flex-1 space-y-2 overflow-y-auto p-2.5">
                      {columnTasks.map((task) => (
                        <button
                          key={task.task_id}
                          type="button"
                          onClick={() => setActiveTaskId(task.task_id)}
                          className={cn(
                            "w-full rounded-[6px] border bg-surface p-3 text-left transition-precision cursor-pointer focus-ring",
                            activeTaskId === task.task_id
                              ? "border-accent"
                              : "border-hairline hover:border-strong"
                          )}
                        >
                          <div className="mb-1.5 flex items-center justify-between">
                            <span className="font-mono text-[11px] text-ink-muted tabular-nums">
                              #{task.task_id}
                            </span>
                            <PriorityIndicator priority={task.priority} />
                          </div>
                          <p className="text-[13px] font-medium leading-snug text-ink-primary line-clamp-2">
                            {task.title}
                          </p>
                          {task.due_date && (
                            <p
                              className={cn(
                                "mt-2 font-mono text-[11px] tabular-nums",
                                isOverdue(task.due_date, task.status)
                                  ? "text-danger"
                                  : "text-ink-muted"
                              )}
                            >
                              {formatShortDate(task.due_date)}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Contextual Right Inspector */}
      <TaskInspector />

      {/* Quick Create Task Modal */}
      <QuickCreateModal />
    </div>
  );
}
