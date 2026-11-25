"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";
import { formatDateTime } from "@/lib/utils/format";
import { getTaskPermissions } from "@/lib/utils/permissions";
import { useWorkspaceStore } from "@/stores/workspace-store";
import {
  useArchiveTask,
  useCurrentUser,
  useDeleteTask,
  usePrioritiesLookup,
  useStatusesLookup,
  useTaskDetail,
  useUpdateTask,
  useUpdateTaskProgress,
} from "./queries";
import { formatStatusLabel, StatusIcon } from "./task-indicators";

type InspectorTab = "work" | "discuss" | "context" | "history";

export function TaskInspector() {
  const activeTaskId = useWorkspaceStore((s) => s.activeTaskId);
  const setActiveTaskId = useWorkspaceStore((s) => s.setActiveTaskId);
  const [activeTab, setActiveTab] = useState<InspectorTab>("work");
  const [draftTitle, setDraftTitle] = useState<string | null>(null);
  const [draftDesc, setDraftDesc] = useState<string | null>(null);

  const { data: me } = useCurrentUser();
  const { data: task, isLoading } = useTaskDetail(activeTaskId);
  const { data: statuses = [] } = useStatusesLookup();
  const { data: priorities = [] } = usePrioritiesLookup();

  const updateTask = useUpdateTask();
  const updateProgress = useUpdateTaskProgress();
  const archiveTask = useArchiveTask();
  const deleteTask = useDeleteTask();

  if (!activeTaskId) return null;

  const permissions = task
    ? getTaskPermissions(task.user_id, me?.user_id)
    : null;

  const handleSaveTitle = () => {
    if (!task || draftTitle === null) return;
    const trimmed = draftTitle.trim();
    setDraftTitle(null);
    if (trimmed && trimmed !== task.title) {
      updateTask.mutate({ taskId: task.task_id, payload: { title: trimmed } });
    }
  };

  const handleSaveDescription = () => {
    if (!task || draftDesc === null) return;
    const next = draftDesc.trim() || null;
    setDraftDesc(null);
    if (next !== task.description) {
      updateTask.mutate({
        taskId: task.task_id,
        payload: { description: next },
      });
    }
  };

  return (
    <aside className="flex h-full w-full flex-col border-l border-hairline bg-surface md:w-[440px] lg:w-[480px] shrink-0">
      {/* Inspector Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-hairline px-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[12px] font-medium text-ink-muted tabular-nums">
            #{activeTaskId}
          </span>
          {task && (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-secondary">
              <StatusIcon status={task.status} className="h-3.5 w-3.5" />
              <span>{formatStatusLabel(task.status)}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {task && permissions?.canArchive && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={task.archived_at ? "Unarchive task" : "Archive task"}
              onClick={() =>
                archiveTask.mutate({
                  taskId: task.task_id,
                  archived: Boolean(task.archived_at),
                })
              }
            >
              {task.archived_at ? (
                <ArchiveRestore className="h-4 w-4" strokeWidth={1.75} />
              ) : (
                <Archive className="h-4 w-4" strokeWidth={1.75} />
              )}
            </Button>
          )}
          {task && permissions?.canDeleteTask && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Delete task"
              className="hover:text-danger"
              onClick={() => {
                deleteTask.mutate(task.task_id, {
                  onSuccess: () => setActiveTaskId(null),
                });
              }}
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close inspector"
            onClick={() => setActiveTaskId(null)}
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        </div>
      </div>

      {/* Inspector Body */}
      <div className="flex-1 overflow-y-auto p-5">
        {isLoading || !task ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Inline Editable Title & Description */}
            <div className="space-y-2">
              <input
                type="text"
                disabled={!permissions?.canEditTask}
                value={draftTitle ?? task.title}
                onChange={(e) => setDraftTitle(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur();
                  }
                }}
                aria-label="Task title"
                className="w-full bg-transparent text-[18px] font-semibold leading-[26px] tracking-[-0.015em] text-ink-primary focus:outline-none focus:ring-1 focus:ring-accent rounded-[4px] px-1 -mx-1"
              />
              <textarea
                rows={3}
                disabled={!permissions?.canEditTask}
                value={draftDesc ?? task.description ?? ""}
                placeholder="Add description..."
                onChange={(e) => setDraftDesc(e.target.value)}
                onBlur={handleSaveDescription}
                aria-label="Task description"
                className="w-full resize-none rounded-[6px] border border-transparent bg-transparent px-1 -mx-1 py-1 text-[13px] leading-relaxed text-ink-secondary placeholder:text-ink-muted focus:border-hairline focus:bg-subtle focus:outline-none"
              />
            </div>

            {/* Metadata Controls Grid */}
            <div className="grid grid-cols-3 gap-2.5 rounded-[8px] border border-hairline bg-canvas p-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-ink-muted">
                  Status
                </label>
                <select
                  disabled={!permissions?.canEditTask}
                  value={task.status_id}
                  onChange={(e) =>
                    updateTask.mutate({
                      taskId: task.task_id,
                      payload: { status_id: Number(e.target.value) },
                    })
                  }
                  className="h-8 w-full rounded-[6px] border border-hairline bg-surface px-2 text-[12px] text-ink-primary focus-ring"
                >
                  {statuses.map((s) => (
                    <option key={s.status_id} value={s.status_id}>
                      {formatStatusLabel(s.name)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-ink-muted">
                  Priority
                </label>
                <select
                  disabled={!permissions?.canEditTask}
                  value={task.priority_id ?? ""}
                  onChange={(e) =>
                    updateTask.mutate({
                      taskId: task.task_id,
                      payload: {
                        priority_id: e.target.value
                          ? Number(e.target.value)
                          : null,
                      },
                    })
                  }
                  className="h-8 w-full rounded-[6px] border border-hairline bg-surface px-2 text-[12px] text-ink-primary focus-ring"
                >
                  <option value="">None</option>
                  {priorities.map((p) => (
                    <option key={p.priority_id} value={p.priority_id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-ink-muted">
                  Due date
                </label>
                <input
                  type="date"
                  disabled={!permissions?.canEditTask}
                  value={task.due_date ? task.due_date.slice(0, 10) : ""}
                  onChange={(e) =>
                    updateTask.mutate({
                      taskId: task.task_id,
                      payload: {
                        due_date: e.target.value
                          ? new Date(`${e.target.value}T17:00:00Z`).toISOString()
                          : null,
                      },
                    })
                  }
                  className="h-8 w-full rounded-[6px] border border-hairline bg-surface px-2 font-mono text-[11px] text-ink-primary focus-ring"
                />
              </div>
            </div>

            {/* Progress Slider */}
            <div className="space-y-2 rounded-[8px] border border-hairline bg-canvas p-3">
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-medium text-ink-secondary">Progress</span>
                <span className="font-mono text-[12px] font-medium text-ink-primary tabular-nums">
                  {task.progress_percentage}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                disabled={!permissions?.canEditTask}
                defaultValue={task.progress_percentage}
                key={`${task.task_id}-${task.progress_percentage}`}
                onMouseUp={(e) =>
                  updateProgress.mutate({
                    taskId: task.task_id,
                    progress_percentage: Number(e.currentTarget.value),
                  })
                }
                onKeyUp={(e) =>
                  updateProgress.mutate({
                    taskId: task.task_id,
                    progress_percentage: Number(e.currentTarget.value),
                  })
                }
                className="w-full accent-[var(--accent-primary)] cursor-pointer"
                aria-label="Task progress percentage"
              />
            </div>

            {/* 4 Contextual Inspector Tabs */}
            <div>
              <div className="flex border-b border-hairline gap-4">
                {(
                  [
                    { id: "work", label: "Work" },
                    { id: "discuss", label: "Discuss" },
                    { id: "context", label: "Schedule & Context" },
                    { id: "history", label: "History" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "pb-2.5 text-[12px] font-medium transition-precision border-b-2 -mb-px cursor-pointer",
                      activeTab === tab.id
                        ? "border-accent text-ink-primary"
                        : "border-transparent text-ink-muted hover:text-ink-secondary"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="pt-4 text-[13px] text-ink-secondary">
                {activeTab === "work" && (
                  <p className="text-[12px] text-ink-muted">
                    Subtasks, Notes (+ Version History), and Attachments will
                    mount in this tab.
                  </p>
                )}
                {activeTab === "discuss" && (
                  <p className="text-[12px] text-ink-muted">
                    Comments thread, Voting bar, and Task Sharing RBAC will
                    mount in this tab.
                  </p>
                )}
                {activeTab === "context" && (
                  <p className="text-[12px] text-ink-muted">
                    Reminders, Recurrence rules, Locations, and External
                    Integrations will mount in this tab.
                  </p>
                )}
                {activeTab === "history" && (
                  <div className="space-y-1.5 text-[12px] text-ink-muted">
                    <p>
                      Created:{" "}
                      <span className="font-mono text-ink-secondary">
                        {formatDateTime(task.created_at)}
                      </span>
                    </p>
                    <p>
                      Updated:{" "}
                      <span className="font-mono text-ink-secondary">
                        {formatDateTime(task.updated_at)}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
