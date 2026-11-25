"use client";

import * as Popover from "@radix-ui/react-popover";
import { useQuery } from "@tanstack/react-query";
import {
  BellRing,
  Calendar,
  ChevronRight,
  CircleDot,
  Flag,
  Link2,
  MapPin,
  Repeat,
  Tags,
} from "lucide-react";
import { IntegrationPanel, integrationKeys } from "@/features/context/integration-panel";
import { LocationPanel, locationKeys } from "@/features/context/location-panel";
import { SchedulingPanel, schedulingKeys } from "@/features/scheduling/scheduling-panel";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type {
  ExternalIntegrationResponse,
  LocationResponse,
  RecurrenceResponse,
  ReminderResponse,
  TaskPriorityLookup,
  TaskResponse,
  TaskStatusLookup,
} from "@/lib/api/types";
import { formatShortDate } from "@/lib/utils/format";
import { TaskClassificationsControl } from "./task-classifications-control";
import { formatStatusLabel, PriorityIndicator, StatusIcon } from "./task-indicators";

interface PropertyRowProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}

function PropertyRow({ icon, label, children }: PropertyRowProps) {
  return (
    <div className="flex min-h-[38px] items-center justify-between gap-3 px-3.5 py-1.5">
      <div className="flex w-[132px] shrink-0 items-center gap-2 text-[12px] text-ink-muted">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-end">
        {children}
      </div>
    </div>
  );
}

export function TaskPropertiesTable({
  task,
  statuses,
  priorities,
  canEdit,
  onUpdate,
}: {
  task: TaskResponse;
  statuses: TaskStatusLookup[];
  priorities: TaskPriorityLookup[];
  canEdit: boolean;
  onUpdate: (payload: {
    status_id?: number;
    priority_id?: number | null;
    due_date?: string | null;
  }) => void;
}) {
  const { data: reminders = [] } = useQuery({
    queryKey: schedulingKeys.reminders(task.task_id),
    queryFn: () =>
      apiFetch<ReminderResponse[]>(endpoints.taskReminders(task.task_id)),
  });

  const { data: recurrence } = useQuery({
    queryKey: schedulingKeys.recurrence(task.task_id),
    queryFn: async () => {
      try {
        return await apiFetch<RecurrenceResponse>(
          endpoints.taskRecurrence(task.task_id)
        );
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 404) return null;
        throw err;
      }
    },
  });

  const { data: locations = [] } = useQuery({
    queryKey: locationKeys.task(task.task_id),
    queryFn: () =>
      apiFetch<LocationResponse[]>(endpoints.taskLocations(task.task_id)),
  });

  const { data: integrations = [] } = useQuery({
    queryKey: integrationKeys.task(task.task_id),
    queryFn: () =>
      apiFetch<ExternalIntegrationResponse[]>(
        endpoints.taskIntegrations(task.task_id)
      ),
  });

  return (
    <section className="space-y-2">
      <h3 className="text-[12px] font-semibold text-ink-secondary">
        Properties &amp; Context
      </h3>

      <div className="divide-y divide-hairline rounded-[8px] border border-hairline bg-canvas">
        {/* Status */}
        <PropertyRow
          icon={<CircleDot className="h-3.5 w-3.5" strokeWidth={1.75} />}
          label="Status"
        >
          <div className="flex items-center gap-2">
            <StatusIcon status={task.status} className="h-3.5 w-3.5" />
            <select
              aria-label="Task status"
              disabled={!canEdit}
              value={task.status_id}
              onChange={(e) =>
                onUpdate({ status_id: Number(e.target.value) })
              }
              className="h-7 rounded-[6px] border border-transparent bg-transparent px-1.5 text-right text-[12px] font-medium text-ink-primary hover:border-hairline hover:bg-surface focus-ring disabled:opacity-70 cursor-pointer"
            >
              {statuses.map((s) => (
                <option key={s.status_id} value={s.status_id}>
                  {formatStatusLabel(s.name)}
                </option>
              ))}
            </select>
          </div>
        </PropertyRow>

        {/* Priority */}
        <PropertyRow
          icon={<Flag className="h-3.5 w-3.5" strokeWidth={1.75} />}
          label="Priority"
        >
          <div className="flex items-center gap-2">
            <PriorityIndicator priority={task.priority} />
            <select
              aria-label="Task priority"
              disabled={!canEdit}
              value={task.priority_id ?? ""}
              onChange={(e) =>
                onUpdate({
                  priority_id: e.target.value ? Number(e.target.value) : null,
                })
              }
              className="h-7 rounded-[6px] border border-transparent bg-transparent px-1.5 text-right text-[12px] font-medium text-ink-primary hover:border-hairline hover:bg-surface focus-ring disabled:opacity-70 cursor-pointer"
            >
              <option value="">None</option>
              {priorities.map((p) => (
                <option key={p.priority_id} value={p.priority_id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </PropertyRow>

        {/* Due Date */}
        <PropertyRow
          icon={<Calendar className="h-3.5 w-3.5" strokeWidth={1.75} />}
          label="Due date"
        >
          <input
            type="date"
            aria-label="Task due date"
            disabled={!canEdit}
            value={task.due_date ? task.due_date.slice(0, 10) : ""}
            onChange={(e) =>
              onUpdate({
                due_date: e.target.value
                  ? new Date(`${e.target.value}T17:00:00Z`).toISOString()
                  : null,
              })
            }
            className="h-7 rounded-[6px] border border-transparent bg-transparent px-1.5 font-mono text-[12px] text-ink-primary hover:border-hairline hover:bg-surface focus-ring disabled:opacity-70 cursor-pointer"
          />
        </PropertyRow>

        {/* Classifications Popover */}
        <PropertyRow
          icon={<Tags className="h-3.5 w-3.5" strokeWidth={1.75} />}
          label="Classifications"
        >
          <Popover.Root>
            <Popover.Trigger asChild>
              <button
                type="button"
                className="inline-flex h-7 items-center gap-1.5 rounded-[6px] px-2 text-[12px] text-ink-secondary hover:bg-surface hover:text-ink-primary transition-precision focus-ring cursor-pointer"
              >
                <span>Manage tags, categories, labels</span>
                <ChevronRight className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.75} />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                align="end"
                sideOffset={6}
                className="z-50 w-[340px] rounded-[8px] border border-hairline bg-surface p-3.5 text-ink-primary focus:outline-none"
              >
                <p className="mb-2.5 text-[12px] font-semibold text-ink-primary">
                  Classifications
                </p>
                <TaskClassificationsControl
                  taskId={task.task_id}
                  canEdit={canEdit}
                />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </PropertyRow>

        {/* Reminders & Recurrence Popover */}
        <PropertyRow
          icon={<BellRing className="h-3.5 w-3.5" strokeWidth={1.75} />}
          label="Schedule"
        >
          <Popover.Root>
            <Popover.Trigger asChild>
              <button
                type="button"
                className="inline-flex h-7 items-center gap-2 rounded-[6px] px-2 text-[12px] text-ink-secondary hover:bg-surface hover:text-ink-primary transition-precision focus-ring cursor-pointer"
              >
                {recurrence && (
                  <span className="inline-flex items-center gap-1 rounded-[4px] bg-subtle px-1.5 py-0.5 text-[11px] capitalize text-ink-primary">
                    <Repeat className="h-3 w-3 text-accent" strokeWidth={1.75} />
                    {recurrence.frequency.toLowerCase()}
                  </span>
                )}
                <span className="font-mono text-[11px] tabular-nums">
                  {reminders.length > 0
                    ? `${reminders.length} reminder${reminders.length > 1 ? "s" : ""}`
                    : recurrence
                      ? `Next ${formatShortDate(recurrence.next_due_date)}`
                      : "None"}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.75} />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                align="end"
                sideOffset={6}
                className="z-50 w-[360px] max-h-[420px] overflow-y-auto rounded-[8px] border border-hairline bg-surface p-4 text-ink-primary focus:outline-none"
              >
                <SchedulingPanel taskId={task.task_id} canEdit={canEdit} />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </PropertyRow>

        {/* Locations Popover */}
        <PropertyRow
          icon={<MapPin className="h-3.5 w-3.5" strokeWidth={1.75} />}
          label="Locations"
        >
          <Popover.Root>
            <Popover.Trigger asChild>
              <button
                type="button"
                className="inline-flex h-7 items-center gap-1.5 rounded-[6px] px-2 text-[12px] text-ink-secondary hover:bg-surface hover:text-ink-primary transition-precision focus-ring cursor-pointer"
              >
                <span className="truncate max-w-[200px]">
                  {locations.length > 0
                    ? locations.map((l) => l.location_name).join(", ")
                    : "None"}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.75} />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                align="end"
                sideOffset={6}
                className="z-50 w-[340px] max-h-[380px] overflow-y-auto rounded-[8px] border border-hairline bg-surface p-4 text-ink-primary focus:outline-none"
              >
                <LocationPanel taskId={task.task_id} canEdit={canEdit} />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </PropertyRow>

        {/* External Integrations Popover */}
        <PropertyRow
          icon={<Link2 className="h-3.5 w-3.5" strokeWidth={1.75} />}
          label="Integrations"
        >
          <Popover.Root>
            <Popover.Trigger asChild>
              <button
                type="button"
                className="inline-flex h-7 items-center gap-1.5 rounded-[6px] px-2 text-[12px] text-ink-secondary hover:bg-surface hover:text-ink-primary transition-precision focus-ring cursor-pointer"
              >
                <span className="font-mono text-[11px] truncate max-w-[200px]">
                  {integrations.length > 0
                    ? integrations.map((i) => i.external_app_task_id).join(", ")
                    : "None"}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.75} />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                align="end"
                sideOffset={6}
                className="z-50 w-[360px] max-h-[380px] overflow-y-auto rounded-[8px] border border-hairline bg-surface p-4 text-ink-primary focus:outline-none"
              >
                <IntegrationPanel taskId={task.task_id} canEdit={canEdit} />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </PropertyRow>
      </div>
    </section>
  );
}
