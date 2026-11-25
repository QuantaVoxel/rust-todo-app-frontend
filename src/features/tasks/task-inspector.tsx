"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Maximize2,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AuditTimeline } from "@/features/audit/audit-timeline";
import { AttachmentPanel } from "@/features/attachments/attachment-panel";
import { SharePanel } from "@/features/collaboration/share-panel";
import { VoteBar } from "@/features/collaboration/vote-bar";
import { CommentThread } from "@/features/comments/comment-thread";
import { IntegrationPanel } from "@/features/context/integration-panel";
import { LocationPanel } from "@/features/context/location-panel";
import { NoteList } from "@/features/notes/note-list";
import { SchedulingPanel } from "@/features/scheduling/scheduling-panel";
import { SubtaskList } from "@/features/subtasks/subtask-list";
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
  useTaskShares,
  useUpdateTask,
  useUpdateTaskProgress,
} from "./queries";
import { TaskClassificationsControl } from "./task-classifications-control";
import { formatStatusLabel, StatusIcon } from "./task-indicators";

type BottomTab = "comments" | "notes" | "attachments" | "sharing" | "history";

const PROGRESS_PRESETS = [0, 25, 50, 75, 100];

export function TaskDetailView({
  taskId,
  mode,
  onClose,
}: {
  taskId: number;
  mode: "drawer" | "page";
  onClose?: () => void;
}) {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<BottomTab>("comments");
  const [draftTitle, setDraftTitle] = useState<string | null>(null);
  const [draftDesc, setDraftDesc] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const { data: me } = useCurrentUser();
  const { data: task, isLoading } = useTaskDetail(taskId);
  const isOwner = Boolean(task && me && task.user_id === me.user_id);
  const { data: shares = [] } = useTaskShares(
    taskId,
    Boolean(taskId && task && !isOwner)
  );
  const { data: statuses = [] } = useStatusesLookup();
  const { data: priorities = [] } = usePrioritiesLookup();

  const updateTask = useUpdateTask();
  const updateProgress = useUpdateTaskProgress();
  const archiveTask = useArchiveTask();
  const deleteTask = useDeleteTask();

  const myShare = shares.find((s) => s.user_id === me?.user_id);
  const permissions = task
    ? getTaskPermissions(task.user_id, me?.user_id, myShare?.permission)
    : null;

  const handleSaveTitle = () => {
    if (!task || draftTitle === null || !permissions?.canEditTask) return;
    const trimmed = draftTitle.trim();
    setDraftTitle(null);
    if (trimmed && trimmed !== task.title) {
      updateTask.mutate({ taskId: task.task_id, payload: { title: trimmed } });
    }
  };

  const handleSaveDescription = () => {
    if (!task || draftDesc === null || !permissions?.canEditTask) return;
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
    <div className="flex h-full flex-col bg-surface">
      {/* ZONA A — Sticky Inspector Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-hairline px-5">
        <div className="flex items-center gap-2.5">
          {mode === "page" && (
            <Link
              href="/tasks"
              className="inline-flex items-center gap-1 rounded-[6px] px-2 py-1 text-[12px] text-ink-secondary hover:bg-subtle hover:text-ink-primary"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Tasks</span>
            </Link>
          )}
          <span className="font-mono text-[12px] font-medium text-ink-muted tabular-nums">
            #{taskId}
          </span>
          {task && (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-secondary">
              <StatusIcon status={task.status} className="h-3.5 w-3.5" />
              <span>{formatStatusLabel(task.status)}</span>
            </span>
          )}
          {permissions && (
            <Badge
              variant={permissions.level === "owner" ? "accent" : "neutral"}
            >
              {permissions.level === "view" ? "View only" : permissions.level}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          {task && <VoteBar taskId={task.task_id} />}

          {task && (permissions?.canArchive || permissions?.canDeleteTask) && (
            <div className="mx-1 h-4 w-px bg-hairline" />
          )}

          {task && permissions?.canArchive && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={task.archived_at ? "Unarchive task" : "Archive task"}
              title={task.archived_at ? "Unarchive task" : "Archive task"}
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
              title="Delete task"
              className="hover:text-danger"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          )}

          {mode === "drawer" && (
            <>
              <Link
                href={`/tasks/${taskId}`}
                onClick={onClose}
                aria-label="Expand to full page"
                title="Expand to full page"
                className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] text-ink-secondary hover:bg-subtle hover:text-ink-primary transition-precision"
              >
                <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close inspector"
                onClick={onClose}
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {isLoading || !task ? (
          <div className="space-y-4">
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div
            className={cn(
              "space-y-7",
              mode === "page" && "mx-auto max-w-4xl"
            )}
          >
            {/* ZONA B — Core Execution Area */}
            <section className="space-y-5">
              <div className="space-y-2">
                <div className="space-y-1">
                  <div className="group flex items-center gap-2">
                    <input
                      ref={titleInputRef}
                      type="text"
                      disabled={!permissions?.canEditTask}
                      value={draftTitle ?? task.title}
                      title={
                        permissions?.canEditTask
                          ? "Click to edit title"
                          : undefined
                      }
                      onChange={(e) => setDraftTitle(e.target.value)}
                      onBlur={handleSaveTitle}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setDraftTitle(null);
                          e.currentTarget.blur();
                        } else if (
                          e.key === "Enter" &&
                          (e.metaKey || e.ctrlKey || !e.shiftKey)
                        ) {
                          e.currentTarget.blur();
                        }
                      }}
                      aria-label="Task title"
                      className={cn(
                        "min-w-0 flex-1 rounded-[6px] border border-transparent bg-transparent px-2 -ml-2 py-1 text-[20px] font-semibold leading-[28px] tracking-[-0.02em] text-ink-primary transition-precision focus:border-accent focus:bg-subtle focus:outline-none disabled:opacity-90",
                        permissions?.canEditTask &&
                          "hover:border-hairline hover:bg-subtle/60 cursor-text"
                      )}
                    />
                    {permissions?.canEditTask && draftTitle === null && (
                      <button
                        type="button"
                        aria-label="Edit task title"
                        title="Edit title"
                        onClick={() => {
                          setDraftTitle(task.title);
                          requestAnimationFrame(() => {
                            titleInputRef.current?.focus();
                            titleInputRef.current?.select();
                          });
                        }}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] border border-hairline bg-canvas text-ink-muted hover:border-strong hover:bg-subtle hover:text-ink-primary transition-precision focus-ring cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </button>
                    )}
                  </div>
                  {draftTitle !== null && permissions?.canEditTask && (
                    <p className="font-mono text-[10px] text-ink-muted">
                      Enter to save · Esc to cancel
                    </p>
                  )}
                </div>
                <textarea
                  rows={3}
                  disabled={!permissions?.canEditTask}
                  value={draftDesc ?? task.description ?? ""}
                  placeholder={
                    permissions?.canEditTask
                      ? "Add description... (auto-saves on blur or ⌘+Enter)"
                      : "No description provided."
                  }
                  onChange={(e) => setDraftDesc(e.target.value)}
                  onBlur={handleSaveDescription}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.currentTarget.blur();
                    }
                  }}
                  aria-label="Task description"
                  className={cn(
                    "w-full resize-none rounded-[6px] border border-transparent bg-transparent px-2 -mx-2 py-1.5 text-[13px] leading-relaxed text-ink-secondary placeholder:text-ink-muted transition-precision focus:border-hairline focus:bg-subtle focus:outline-none disabled:opacity-90",
                    permissions?.canEditTask &&
                      "hover:border-hairline hover:bg-subtle/50"
                  )}
                />
              </div>

              {/* Interactive Progress Bar + Presets */}
              <div className="space-y-2.5 rounded-[8px] border border-hairline bg-canvas p-3.5">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-medium text-ink-secondary">
                    Completion progress
                  </span>
                  <span className="font-mono text-[12px] font-semibold text-ink-primary tabular-nums">
                    {task.progress_percentage}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle">
                  <motion.div
                    className="h-full origin-left bg-accent"
                    animate={{ scaleX: task.progress_percentage / 100 }}
                    transition={
                      shouldReduceMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 320, damping: 30 }
                    }
                  />
                </div>
                {permissions?.canEditTask && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
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
                      className="flex-1 accent-[var(--accent-primary)] cursor-pointer"
                      aria-label="Progress slider"
                    />
                    <div className="flex items-center gap-1">
                      {PROGRESS_PRESETS.map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() =>
                            updateProgress.mutate({
                              taskId: task.task_id,
                              progress_percentage: pct,
                            })
                          }
                          className={cn(
                            "rounded-[4px] border px-1.5 py-0.5 font-mono text-[10px] tabular-nums transition-precision cursor-pointer",
                            task.progress_percentage === pct
                              ? "border-accent bg-accent-tint text-accent"
                              : "border-hairline bg-surface text-ink-muted hover:text-ink-primary"
                          )}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Subtasks Checklist */}
              <SubtaskList
                taskId={task.task_id}
                canEdit={Boolean(permissions?.canManageSubtasksAndNotes)}
              />
            </section>

            {/* ZONA C — Compact Metadata Properties Grid (2 Kolom) */}
            <section className="space-y-4 rounded-[8px] border border-hairline bg-canvas p-4">
              <h3 className="text-[12px] font-semibold text-ink-secondary">
                Properties &amp; Context
              </h3>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                    className="h-8 w-full rounded-[6px] border border-hairline bg-surface px-2 text-[12px] text-ink-primary focus-ring disabled:opacity-60"
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
                    className="h-8 w-full rounded-[6px] border border-hairline bg-surface px-2 text-[12px] text-ink-primary focus-ring disabled:opacity-60"
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
                            ? new Date(
                                `${e.target.value}T17:00:00Z`
                              ).toISOString()
                            : null,
                        },
                      })
                    }
                    className="h-8 w-full rounded-[6px] border border-hairline bg-surface px-2 font-mono text-[11px] text-ink-primary focus-ring disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="border-t border-hairline pt-3">
                <TaskClassificationsControl
                  taskId={task.task_id}
                  canEdit={Boolean(permissions?.canEditTask)}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 border-t border-hairline pt-3 md:grid-cols-2">
                <SchedulingPanel
                  taskId={task.task_id}
                  canEdit={Boolean(permissions?.canEditTask)}
                />
                <div className="space-y-4">
                  <LocationPanel
                    taskId={task.task_id}
                    canEdit={Boolean(permissions?.canEditTask)}
                  />
                  <IntegrationPanel
                    taskId={task.task_id}
                    canEdit={Boolean(permissions?.canEditTask)}
                  />
                </div>
              </div>
            </section>

            {/* ZONA D — Contextual Bottom Tabs (`layoutId` underline) */}
            <section>
              <div className="flex flex-wrap gap-5 border-b border-hairline">
                {(
                  [
                    { id: "comments", label: "Comments" },
                    { id: "notes", label: "Notes & History" },
                    { id: "attachments", label: "Attachments" },
                    { id: "sharing", label: "Sharing" },
                    { id: "history", label: "Audit History" },
                  ] as const
                ).map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "relative pb-2.5 text-[12px] font-medium transition-precision cursor-pointer",
                        active
                          ? "text-ink-primary"
                          : "text-ink-muted hover:text-ink-secondary"
                      )}
                    >
                      {tab.label}
                      {active && (
                        <motion.span
                          layoutId="inspector-tab-underline"
                          transition={
                            shouldReduceMotion
                              ? { duration: 0 }
                              : { type: "spring", stiffness: 460, damping: 34 }
                          }
                          className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent"
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="pt-4">
                {activeTab === "comments" && (
                  <CommentThread
                    taskId={task.task_id}
                    taskOwnerId={task.user_id}
                    currentUserId={me?.user_id}
                    canComment={Boolean(permissions?.canComment)}
                  />
                )}
                {activeTab === "notes" && (
                  <NoteList
                    taskId={task.task_id}
                    canEdit={Boolean(permissions?.canManageSubtasksAndNotes)}
                  />
                )}
                {activeTab === "attachments" && (
                  <AttachmentPanel
                    taskId={task.task_id}
                    canEdit={Boolean(permissions?.canManageSubtasksAndNotes)}
                  />
                )}
                {activeTab === "sharing" && (
                  <SharePanel
                    taskId={task.task_id}
                    canManage={Boolean(permissions?.canManageSharing)}
                  />
                )}
                {activeTab === "history" && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-4 rounded-[6px] border border-hairline bg-canvas px-3 py-2 text-[11px] text-ink-muted">
                      <span>
                        Created:{" "}
                        <span className="font-mono text-ink-secondary tabular-nums">
                          {formatDateTime(task.created_at)}
                        </span>
                      </span>
                      <span>
                        Updated:{" "}
                        <span className="font-mono text-ink-secondary tabular-nums">
                          {formatDateTime(task.updated_at)}
                        </span>
                      </span>
                    </div>
                    <AuditTimeline taskId={task.task_id} />
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete task #{taskId}?</DialogTitle>
            <DialogDescription>
              This permanently removes the task and all subtasks, notes,
              comments, and attachments.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={deleteTask.isPending}
              onClick={() => {
                deleteTask.mutate(taskId, {
                  onSuccess: () => {
                    setDeleteDialogOpen(false);
                    if (mode === "page") {
                      router.replace("/tasks");
                    } else {
                      onClose?.();
                    }
                  },
                });
              }}
            >
              Delete permanently
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function TaskInspector() {
  const shouldReduceMotion = useReducedMotion();
  const activeTaskId = useWorkspaceStore((s) => s.activeTaskId);
  const setActiveTaskId = useWorkspaceStore((s) => s.setActiveTaskId);

  return (
    <AnimatePresence>
      {activeTaskId && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={() => setActiveTaskId(null)}
            className="fixed inset-0 bg-black/45"
          />
          <motion.aside
            initial={shouldReduceMotion ? false : { x: "100%" }}
            animate={{ x: 0 }}
            exit={shouldReduceMotion ? undefined : { x: "100%" }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 420, damping: 36 }
            }
            className="relative z-10 h-full w-full max-w-2xl border-l border-hairline bg-surface"
          >
            <TaskDetailView
              taskId={activeTaskId}
              mode="drawer"
              onClose={() => setActiveTaskId(null)}
            />
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
