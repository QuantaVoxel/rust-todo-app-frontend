"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckSquare,
  LayoutGrid,
  List,
  Plus,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TaskRowSkeleton } from "@/components/ui/skeleton";
import type { TaskListQuery, TaskResponse } from "@/lib/api/types";
import { cn } from "@/lib/utils/cn";
import { formatShortDate, isOverdue } from "@/lib/utils/format";
import { useWorkspaceStore, type SmartView } from "@/stores/workspace-store";
import {
  useCreateTask,
  useEnumsLookup,
  usePrioritiesLookup,
  useStatusesLookup,
  useTagsList,
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

type SortOption = NonNullable<TaskListQuery["sort"]>;

export function TasksWorkspace() {
  const smartView = useWorkspaceStore((s) => s.smartView);
  const setSmartView = useWorkspaceStore((s) => s.setSmartView);
  const viewMode = useWorkspaceStore((s) => s.viewMode);
  const setViewMode = useWorkspaceStore((s) => s.setViewMode);
  const activeTaskId = useWorkspaceStore((s) => s.activeTaskId);
  const setActiveTaskId = useWorkspaceStore((s) => s.setActiveTaskId);
  const quickCreateOpen = useWorkspaceStore((s) => s.quickCreateOpen);
  const setQuickCreateOpen = useWorkspaceStore((s) => s.setQuickCreateOpen);
  const commandPaletteOpen = useWorkspaceStore((s) => s.commandPaletteOpen);

  // Filter & Pagination State
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<number | undefined>();
  const [priorityFilter, setPriorityFilter] = useState<number | undefined>();
  const [tagFilter, setTagFilter] = useState<number | undefined>();
  const [dueAfter, setDueAfter] = useState("");
  const [dueBefore, setDueBefore] = useState("");
  const [sort, setSort] = useState<SortOption>("-task_id");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  // Inline Quick Add State
  const quickTitleRef = useRef<HTMLInputElement>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickPriorityId, setQuickPriorityId] = useState<number | undefined>();
  const [quickDueDate, setQuickDueDate] = useState("");
  const [quickTagId, setQuickTagId] = useState<number | undefined>();

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
    tag_id: tagFilter,
    due_after: dueAfter ? new Date(`${dueAfter}T00:00:00Z`).toISOString() : undefined,
    due_before: dueBefore ? new Date(`${dueBefore}T23:59:59Z`).toISOString() : undefined,
    search: debouncedSearch || undefined,
    sort,
    page,
    per_page: perPage,
  };

  // Prefetch & cache lookups + taxonomies
  const { data: statuses = [] } = useStatusesLookup();
  const { data: priorities = [] } = usePrioritiesLookup();
  const { data: tags = [] } = useTagsList();
  useEnumsLookup();

  const {
    data: taskPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useTasksList(queryParams);
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  const tasks = useMemo(() => taskPage?.data ?? [], [taskPage]);
  const meta = taskPage?.meta;

  const hasActiveFilters = Boolean(
    debouncedSearch ||
      statusFilter ||
      priorityFilter ||
      tagFilter ||
      dueAfter ||
      dueBefore
  );

  const clearFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setStatusFilter(undefined);
    setPriorityFilter(undefined);
    setTagFilter(undefined);
    setDueAfter("");
    setDueBefore("");
    setPage(1);
  };

  // Keyboard shortcuts: N / C (Quick Add), J/K or Down/Up, Enter, Esc
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

      if (isEditable || quickCreateOpen || commandPaletteOpen) return;

      if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        quickTitleRef.current?.focus();
        return;
      }

      if (e.key.toLowerCase() === "c" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setQuickCreateOpen(true);
        return;
      }

      if (tasks.length === 0) return;

      if (e.key === "ArrowDown" || e.key.toLowerCase() === "j") {
        e.preventDefault();
        setFocusedIndex((idx) => Math.min(tasks.length - 1, idx + 1));
      } else if (e.key === "ArrowUp" || e.key.toLowerCase() === "k") {
        e.preventDefault();
        setFocusedIndex((idx) => Math.max(0, idx - 1));
      } else if (e.key === "Enter" && focusedIndex >= 0 && tasks[focusedIndex]) {
        e.preventDefault();
        setActiveTaskId(tasks[focusedIndex].task_id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    tasks,
    focusedIndex,
    quickCreateOpen,
    commandPaletteOpen,
    setActiveTaskId,
    setQuickCreateOpen,
  ]);

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

  const handleInlineQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const title = quickTitle.trim();
    const defaultStatus = statuses.find((s) => s.name === "pending") ?? statuses[0];
    if (!title || !defaultStatus) return;

    createTask.mutate(
      {
        title,
        status_id: defaultStatus.status_id,
        priority_id: quickPriorityId ?? null,
        due_date: quickDueDate
          ? new Date(`${quickDueDate}T17:00:00Z`).toISOString()
          : null,
        tag_ids: quickTagId ? [quickTagId] : undefined,
      },
      {
        onSuccess: (created) => {
          setQuickTitle("");
          setQuickPriorityId(undefined);
          setQuickDueDate("");
          setQuickTagId(undefined);
          setActiveTaskId(created.task_id);
        },
      }
    );
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

        {/* Comprehensive Filter & Sort Toolbar */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-hairline bg-canvas/50 px-5 py-2.5">
          <div className="relative min-w-[180px] flex-1 max-w-[260px]">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted"
              strokeWidth={1.75}
            />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search tasks..."
              className="h-8 pl-8 text-[12px]"
            />
          </div>

          <select
            aria-label="Scope"
            value={smartView === "owned" || smartView === "shared" ? smartView : "all"}
            onChange={(e) => {
              const val = e.target.value as SmartView;
              setSmartView(val);
              setPage(1);
            }}
            className="h-8 rounded-[6px] border border-hairline bg-subtle px-2 text-[12px] text-ink-secondary focus-ring"
          >
            <option value="all">Scope: All</option>
            <option value="owned">Scope: Owned</option>
            <option value="shared">Scope: Shared</option>
          </select>

          <select
            aria-label="Filter by status"
            value={statusFilter ?? ""}
            onChange={(e) => {
              setStatusFilter(e.target.value ? Number(e.target.value) : undefined);
              setPage(1);
            }}
            className="h-8 rounded-[6px] border border-hairline bg-subtle px-2 text-[12px] text-ink-secondary focus-ring"
          >
            <option value="">Status: All</option>
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
            className="h-8 rounded-[6px] border border-hairline bg-subtle px-2 text-[12px] text-ink-secondary focus-ring"
          >
            <option value="">Priority: All</option>
            {priorities.map((p) => (
              <option key={p.priority_id} value={p.priority_id}>
                {p.name}
              </option>
            ))}
          </select>

          {tags.length > 0 && (
            <select
              aria-label="Filter by tag"
              value={tagFilter ?? ""}
              onChange={(e) => {
                setTagFilter(e.target.value ? Number(e.target.value) : undefined);
                setPage(1);
              }}
              className="h-8 rounded-[6px] border border-hairline bg-subtle px-2 text-[12px] text-ink-secondary focus-ring"
            >
              <option value="">Tag: All</option>
              {tags.map((t) => (
                <option key={t.tag_id} value={t.tag_id}>
                  #{t.name}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-1">
            <input
              type="date"
              aria-label="Due after"
              title="Due after"
              value={dueAfter}
              onChange={(e) => {
                setDueAfter(e.target.value);
                setPage(1);
              }}
              className="h-8 rounded-[6px] border border-hairline bg-subtle px-2 font-mono text-[11px] text-ink-secondary focus-ring"
            />
            <span className="text-[11px] text-ink-muted">-</span>
            <input
              type="date"
              aria-label="Due before"
              title="Due before"
              value={dueBefore}
              onChange={(e) => {
                setDueBefore(e.target.value);
                setPage(1);
              }}
              className="h-8 rounded-[6px] border border-hairline bg-subtle px-2 font-mono text-[11px] text-ink-secondary focus-ring"
            />
          </div>

          <select
            aria-label="Sort tasks"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as SortOption);
              setPage(1);
            }}
            className="h-8 rounded-[6px] border border-hairline bg-subtle px-2 text-[12px] text-ink-secondary focus-ring"
          >
            <option value="-task_id">Sort: Newest</option>
            <option value="due_date">Due date (Asc)</option>
            <option value="-due_date">Due date (Desc)</option>
            <option value="-priority">Priority (High first)</option>
            <option value="priority">Priority (Low first)</option>
            <option value="-created_at">Created (Newest)</option>
            <option value="created_at">Created (Oldest)</option>
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-8 items-center gap-1 rounded-[6px] px-2 text-[12px] text-ink-muted hover:bg-subtle hover:text-ink-primary cursor-pointer"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Inline Quick Add Bar */}
        {smartView !== "archived" && (
          <form
            onSubmit={handleInlineQuickAdd}
            className="flex shrink-0 flex-wrap items-center gap-2 border-b border-hairline bg-surface px-5 py-2"
          >
            <Plus
              className="h-4 w-4 shrink-0 text-accent"
              strokeWidth={1.75}
            />
            <input
              ref={quickTitleRef}
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder="Quick add task (press N to focus)..."
              className="h-8 min-w-[200px] flex-1 bg-transparent text-[13px] text-ink-primary placeholder:text-ink-muted focus:outline-none"
            />
            <select
              aria-label="Quick add priority"
              value={quickPriorityId ?? ""}
              onChange={(e) =>
                setQuickPriorityId(
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
              className="h-7 rounded-[6px] border border-hairline bg-subtle px-2 text-[11px] text-ink-secondary focus-ring"
            >
              <option value="">Priority</option>
              {priorities.map((p) => (
                <option key={p.priority_id} value={p.priority_id}>
                  {p.name}
                </option>
              ))}
            </select>
            {tags.length > 0 && (
              <select
                aria-label="Quick add tag"
                value={quickTagId ?? ""}
                onChange={(e) =>
                  setQuickTagId(
                    e.target.value ? Number(e.target.value) : undefined
                  )
                }
                className="h-7 rounded-[6px] border border-hairline bg-subtle px-2 text-[11px] text-ink-secondary focus-ring"
              >
                <option value="">Tag</option>
                {tags.map((t) => (
                  <option key={t.tag_id} value={t.tag_id}>
                    #{t.name}
                  </option>
                ))}
              </select>
            )}
            <input
              type="date"
              aria-label="Quick add due date"
              value={quickDueDate}
              onChange={(e) => setQuickDueDate(e.target.value)}
              className="h-7 rounded-[6px] border border-hairline bg-subtle px-2 font-mono text-[11px] text-ink-secondary focus-ring"
            />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              disabled={!quickTitle.trim() || createTask.isPending}
            >
              Add
            </Button>
          </form>
        )}

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
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-4"
                onClick={() => refetch()}
              >
                Retry
              </Button>
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
                  N
                </kbd>{" "}
                for quick add or{" "}
                <kbd className="rounded-[4px] border border-hairline bg-subtle px-1.5 py-0.5 font-mono text-[11px] text-ink-primary">
                  C
                </kbd>{" "}
                for full task modal.
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
              {tasks.map((task, idx) => {
                const selected = activeTaskId === task.task_id;
                const focused = focusedIndex === idx;
                const overdue = isOverdue(task.due_date, task.status);
                const cancelled = task.status?.toLowerCase() === "cancelled";

                return (
                  <div
                    key={task.task_id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setFocusedIndex(idx);
                      setActiveTaskId(task.task_id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveTaskId(task.task_id);
                      }
                    }}
                    className={cn(
                      "flex h-[46px] items-center gap-3 border-b border-hairline px-5 transition-precision cursor-pointer focus-ring",
                      selected
                        ? "bg-accent-tint"
                        : focused
                          ? "bg-subtle"
                          : "hover:bg-subtle/60"
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

              {/* Pagination & Per-Page Footer */}
              {meta && (
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-[12px] text-ink-secondary">
                  <div className="flex items-center gap-3">
                    <span className="font-mono tabular-nums">
                      Page {meta.page} of {Math.max(1, meta.total_pages)} ({meta.total} total)
                    </span>
                    <select
                      aria-label="Items per page"
                      value={perPage}
                      onChange={(e) => {
                        setPerPage(Number(e.target.value));
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
                  )}
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
