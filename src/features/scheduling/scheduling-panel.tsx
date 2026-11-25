"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Plus, Repeat, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type {
  RecurrenceFrequency,
  RecurrenceResponse,
  ReminderResponse,
} from "@/lib/api/types";
import { formatDateTime } from "@/lib/utils/format";

export const schedulingKeys = {
  reminders: (taskId: number) => ["tasks", taskId, "reminders"] as const,
  recurrence: (taskId: number) => ["tasks", taskId, "recurrence"] as const,
};

export function SchedulingPanel({
  taskId,
  canEdit,
}: {
  taskId: number;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [reminderInput, setReminderInput] = useState("");
  const [reminderError, setReminderError] = useState<string | null>(null);

  const [frequency, setFrequency] = useState<RecurrenceFrequency>("weekly");
  const [nextDueInput, setNextDueInput] = useState("");
  const [recurrenceError, setRecurrenceError] = useState<string | null>(null);

  const { data: reminders = [], isLoading: remLoading } = useQuery({
    queryKey: schedulingKeys.reminders(taskId),
    queryFn: () =>
      apiFetch<ReminderResponse[]>(endpoints.taskReminders(taskId)),
  });

  const { data: recurrence, isLoading: recLoading } = useQuery({
    queryKey: schedulingKeys.recurrence(taskId),
    queryFn: async () => {
      try {
        return await apiFetch<RecurrenceResponse>(
          endpoints.taskRecurrence(taskId)
        );
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 404) {
          return null;
        }
        throw err;
      }
    },
  });

  const createReminder = useMutation({
    mutationFn: (reminder_time: string) =>
      apiFetch<ReminderResponse>(endpoints.taskReminders(taskId), {
        method: "POST",
        body: { reminder_time },
      }),
    onSuccess: () => {
      setReminderInput("");
      setReminderError(null);
      queryClient.invalidateQueries({
        queryKey: schedulingKeys.reminders(taskId),
      });
    },
    onError: (err) => {
      setReminderError(
        err instanceof ApiClientError ? err.message : "Failed to add reminder."
      );
    },
  });

  const deleteReminder = useMutation({
    mutationFn: (reminderId: number) =>
      apiFetch<string>(endpoints.reminder(reminderId), { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: schedulingKeys.reminders(taskId),
      });
    },
  });

  const upsertRecurrence = useMutation({
    mutationFn: (payload: {
      frequency: RecurrenceFrequency;
      next_due_date: string;
    }) =>
      apiFetch<RecurrenceResponse>(endpoints.taskRecurrence(taskId), {
        method: "PUT",
        body: payload,
      }),
    onSuccess: () => {
      setRecurrenceError(null);
      queryClient.invalidateQueries({
        queryKey: schedulingKeys.recurrence(taskId),
      });
    },
    onError: (err) => {
      setRecurrenceError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to save recurrence rule."
      );
    },
  });

  const deleteRecurrence = useMutation({
    mutationFn: () =>
      apiFetch<string>(endpoints.taskRecurrence(taskId), { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: schedulingKeys.recurrence(taskId),
      });
    },
  });

  return (
    <div className="space-y-5">
      {/* Reminders */}
      <section className="space-y-2.5">
        <div className="flex items-center gap-2">
          <BellRing className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.75} />
          <h3 className="text-[12px] font-semibold text-ink-secondary">
            Reminders
          </h3>
        </div>

        {remLoading ? (
          <Skeleton className="h-12 w-full" />
        ) : (
          <div className="space-y-1.5">
            {reminders.length === 0 ? (
              <p className="rounded-[6px] border border-hairline bg-canvas px-3 py-2 text-[12px] text-ink-muted">
                No reminders scheduled.
              </p>
            ) : (
              reminders.map((r) => (
                <div
                  key={r.reminder_id}
                  className="flex items-center justify-between rounded-[6px] border border-hairline bg-canvas px-3 py-2"
                >
                  <span className="font-mono text-[12px] text-ink-primary tabular-nums">
                    {formatDateTime(r.reminder_time)}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={r.notification_sent ? "success" : "neutral"}
                    >
                      {r.notification_sent ? "Sent" : "Scheduled"}
                    </Badge>
                    {canEdit && (
                      <button
                        type="button"
                        aria-label="Delete reminder"
                        onClick={() => deleteReminder.mutate(r.reminder_id)}
                        className="rounded-[4px] p-1 text-ink-muted hover:bg-subtle hover:text-danger cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}

            {canEdit && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!reminderInput) return;
                  createReminder.mutate(new Date(reminderInput).toISOString());
                }}
                className="flex items-center gap-2 pt-1"
              >
                <Input
                  type="datetime-local"
                  value={reminderInput}
                  onChange={(e) => setReminderInput(e.target.value)}
                  className="h-8 flex-1 font-mono text-[11px]"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  disabled={!reminderInput || createReminder.isPending}
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Add
                </Button>
              </form>
            )}
            {reminderError && (
              <p className="text-[12px] text-danger">{reminderError}</p>
            )}
          </div>
        )}
      </section>

      {/* Recurrence 1:1 */}
      <section className="space-y-2.5">
        <div className="flex items-center gap-2">
          <Repeat className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.75} />
          <h3 className="text-[12px] font-semibold text-ink-secondary">
            Recurrence
          </h3>
        </div>

        {recLoading ? (
          <Skeleton className="h-14 w-full" />
        ) : (
          <div className="space-y-2.5 rounded-[6px] border border-hairline bg-canvas p-3">
            {recurrence ? (
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-[12px] font-medium text-ink-primary capitalize">
                    Repeats {recurrence.frequency.toLowerCase()}
                  </p>
                  <p className="font-mono text-[11px] text-ink-muted tabular-nums">
                    Next spawn: {formatDateTime(recurrence.next_due_date)}
                  </p>
                </div>
                {canEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteRecurrence.mutate()}
                    className="text-danger hover:text-danger"
                  >
                    Remove
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-[12px] text-ink-muted">
                No recurrence rule configured.
              </p>
            )}

            {canEdit && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!nextDueInput) {
                    setRecurrenceError("Next due date is required.");
                    return;
                  }
                  upsertRecurrence.mutate({
                    frequency,
                    next_due_date: new Date(
                      `${nextDueInput}T09:00:00Z`
                    ).toISOString(),
                  });
                }}
                className="flex flex-wrap items-center gap-2 border-t border-hairline pt-2.5"
              >
                <select
                  aria-label="Recurrence frequency"
                  value={frequency}
                  onChange={(e) =>
                    setFrequency(e.target.value as RecurrenceFrequency)
                  }
                  className="h-8 rounded-[6px] border border-hairline bg-surface px-2 text-[12px] text-ink-primary focus-ring"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
                <Input
                  type="date"
                  value={nextDueInput}
                  onChange={(e) => setNextDueInput(e.target.value)}
                  className="h-8 flex-1 font-mono text-[11px]"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  disabled={upsertRecurrence.isPending}
                >
                  {recurrence ? "Update" : "Set rule"}
                </Button>
              </form>
            )}
            {recurrenceError && (
              <p className="text-[12px] text-danger">{recurrenceError}</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
