"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, Plus, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useStatusesLookup } from "@/features/tasks/queries";
import { cn } from "@/lib/utils/cn";
import {
  useCreateSubtask,
  useDeleteSubtask,
  useSubtasks,
  useUpdateSubtask,
} from "./queries";

export function SubtaskList({
  taskId,
  canEdit,
}: {
  taskId: number;
  canEdit: boolean;
}) {
  const shouldReduceMotion = useReducedMotion();
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const { data: statuses = [] } = useStatusesLookup();
  const { data: subtasks = [], isLoading } = useSubtasks(taskId);
  const createSubtask = useCreateSubtask(taskId);
  const updateSubtask = useUpdateSubtask(taskId);
  const deleteSubtask = useDeleteSubtask(taskId);

  const pendingStatus = statuses.find((s) => s.name === "pending");
  const completedStatus = statuses.find((s) => s.name === "completed");

  const completedCount = subtasks.filter(
    (s) => s.status_id === completedStatus?.status_id
  ).length;
  const ratio = subtasks.length > 0 ? completedCount / subtasks.length : 0;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed || !pendingStatus) return;
    setNewTitle("");
    createSubtask.mutate({
      title: trimmed,
      status_id: pendingStatus.status_id,
    });
  };

  const handleToggle = (subtaskId: number, currentStatusId: number) => {
    if (!canEdit || !pendingStatus || !completedStatus) return;
    const isCompleted = currentStatusId === completedStatus.status_id;
    updateSubtask.mutate({
      subtaskId,
      payload: {
        status_id: isCompleted
          ? pendingStatus.status_id
          : completedStatus.status_id,
      },
    });
  };

  const commitEdit = (subtaskId: number, originalTitle: string) => {
    const trimmed = editingTitle.trim();
    setEditingId(null);
    if (trimmed && trimmed !== originalTitle) {
      updateSubtask.mutate({ subtaskId, payload: { title: trimmed } });
    }
  };

  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-[12px] font-semibold text-ink-secondary">
          Subtasks
        </h3>
        {subtasks.length > 0 && (
          <span className="font-mono text-[11px] text-ink-muted tabular-nums">
            {completedCount}/{subtasks.length} completed
          </span>
        )}
      </div>

      {subtasks.length > 0 && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-subtle">
          <motion.div
            className="h-full origin-left bg-[#16A34A]"
            animate={{ scaleX: ratio }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 320, damping: 30 }
            }
          />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-1.5">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : (
        <div className="divide-y divide-hairline rounded-[6px] border border-hairline bg-canvas">
          {subtasks.length === 0 ? (
            <p className="px-3 py-2.5 text-[12px] text-ink-muted">
              No subtasks yet.
            </p>
          ) : (
            subtasks.map((sub) => {
              const statusObj = statuses.find(
                (s) => s.status_id === sub.status_id
              );
              const isCompleted = statusObj?.name === "completed";
              const isEditing = editingId === sub.subtask_id;

              return (
                <div
                  key={sub.subtask_id}
                  className="group flex min-h-[38px] items-center gap-2.5 px-3 py-1.5"
                >
                  <motion.button
                    type="button"
                    disabled={!canEdit}
                    whileTap={shouldReduceMotion || !canEdit ? undefined : { scale: 0.88 }}
                    aria-label={`Toggle subtask ${sub.title}`}
                    onClick={() => handleToggle(sub.subtask_id, sub.status_id)}
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-precision disabled:opacity-60 cursor-pointer",
                      isCompleted
                        ? "border-[#16A34A] bg-[#16A34A] text-white"
                        : "border-strong bg-surface hover:border-accent"
                    )}
                  >
                    {isCompleted && (
                      <Check className="h-2.5 w-2.5" strokeWidth={2.5} />
                    )}
                  </motion.button>

                  {isEditing ? (
                    <input
                      autoFocus
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => commitEdit(sub.subtask_id, sub.title)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          commitEdit(sub.subtask_id, sub.title);
                        } else if (e.key === "Escape") {
                          setEditingId(null);
                        }
                      }}
                      className="flex-1 bg-transparent text-[13px] text-ink-primary focus:outline-none"
                    />
                  ) : (
                    <span
                      onDoubleClick={() => {
                        if (!canEdit) return;
                        setEditingId(sub.subtask_id);
                        setEditingTitle(sub.title);
                      }}
                      className={cn(
                        "flex-1 text-[13px]",
                        isCompleted
                          ? "line-through text-ink-muted"
                          : "text-ink-primary",
                        canEdit && "cursor-text"
                      )}
                    >
                      {sub.title}
                    </span>
                  )}

                  {canEdit && sub.subtask_id > 0 && (
                    <button
                      type="button"
                      aria-label={`Delete subtask ${sub.title}`}
                      onClick={() => deleteSubtask.mutate(sub.subtask_id)}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 rounded-[4px] p-1 text-ink-muted hover:bg-subtle hover:text-danger transition-precision cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  )}
                </div>
              );
            })
          )}

          {canEdit && (
            <form
              onSubmit={handleAdd}
              className="flex items-center gap-2 px-3 py-1.5"
            >
              <Plus
                className="h-3.5 w-3.5 shrink-0 text-ink-muted"
                strokeWidth={1.75}
              />
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="+ Add subtask..."
                className="h-7 flex-1 bg-transparent text-[13px] text-ink-primary placeholder:text-ink-muted focus:outline-none"
              />
              {newTitle.trim() && (
                <button
                  type="submit"
                  className="rounded-[4px] bg-accent px-2 py-0.5 text-[11px] font-medium text-white hover:bg-accent-hover cursor-pointer"
                >
                  Add
                </button>
              )}
            </form>
          )}
        </div>
      )}
    </section>
  );
}
