"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyApiValidationErrors } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import { useWorkspaceStore } from "@/stores/workspace-store";
import {
  useCreateTask,
  usePrioritiesLookup,
  useStatusesLookup,
  useTagsList,
} from "./queries";

const quickCreateSchema = z.object({
  title: z
    .string()
    .min(1, "Task title is required")
    .max(255, "Maximum 255 characters"),
  description: z.string().optional(),
  status_id: z.number().int().positive(),
  priority_id: z.number().int().positive().nullable().optional(),
  due_date: z.string().optional(),
});

type QuickCreateValues = z.infer<typeof quickCreateSchema>;

export function QuickCreateModal() {
  const open = useWorkspaceStore((s) => s.quickCreateOpen);
  const setOpen = useWorkspaceStore((s) => s.setQuickCreateOpen);
  const setActiveTaskId = useWorkspaceStore((s) => s.setActiveTaskId);

  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const { data: statuses = [] } = useStatusesLookup();
  const { data: priorities = [] } = usePrioritiesLookup();
  const { data: tags = [] } = useTagsList();
  const createTask = useCreateTask();

  const defaultStatusId = statuses[0]?.status_id ?? 1;

  const form = useForm<QuickCreateValues>({
    resolver: zodResolver(quickCreateSchema),
    defaultValues: {
      title: "",
      description: "",
      status_id: defaultStatusId,
      priority_id: null,
      due_date: "",
    },
  });

  useEffect(() => {
    if (open && statuses.length > 0) {
      form.setValue("status_id", statuses[0].status_id);
    }
  }, [open, statuses, form]);

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  const onSubmit = async (values: QuickCreateValues) => {
    try {
      const dueDateIso = values.due_date
        ? new Date(`${values.due_date}T17:00:00Z`).toISOString()
        : null;

      const created = await createTask.mutateAsync({
        title: values.title,
        description: values.description?.trim() ? values.description.trim() : null,
        status_id: values.status_id,
        priority_id: values.priority_id ?? null,
        due_date: dueDateIso,
        tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined,
      });

      form.reset();
      setSelectedTagIds([]);
      setOpen(false);
      setActiveTaskId(created.task_id);
    } catch (error) {
      applyApiValidationErrors(error, form.setError);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create task</DialogTitle>
          <DialogDescription>
            Add a new task to your workspace. Press Esc to cancel.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label
              htmlFor="qc-title"
              className="mb-1.5 block text-[12px] font-medium text-ink-secondary"
            >
              Title
            </label>
            <Input
              id="qc-title"
              autoFocus
              placeholder="e.g., Audit Salvo middleware endpoints"
              hasError={Boolean(form.formState.errors.title)}
              {...form.register("title")}
            />
            {form.formState.errors.title && (
              <p className="mt-1 text-[12px] text-danger">
                {form.formState.errors.title.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="qc-desc"
              className="mb-1.5 block text-[12px] font-medium text-ink-secondary"
            >
              Description
            </label>
            <textarea
              id="qc-desc"
              rows={3}
              placeholder="Optional context or acceptance criteria..."
              className="w-full rounded-[6px] border border-hairline bg-subtle px-3 py-2 text-[13px] text-ink-primary placeholder:text-ink-muted focus:border-strong focus:bg-surface focus-ring"
              {...form.register("description")}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="qc-status"
                className="mb-1 block text-[12px] font-medium text-ink-secondary"
              >
                Status
              </label>
              <select
                id="qc-status"
                className="h-9 w-full rounded-[6px] border border-hairline bg-subtle px-2.5 text-[13px] text-ink-primary focus-ring"
                {...form.register("status_id", { valueAsNumber: true })}
              >
                {statuses.map((s) => (
                  <option key={s.status_id} value={s.status_id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="qc-priority"
                className="mb-1 block text-[12px] font-medium text-ink-secondary"
              >
                Priority
              </label>
              <select
                id="qc-priority"
                className="h-9 w-full rounded-[6px] border border-hairline bg-subtle px-2.5 text-[13px] text-ink-primary focus-ring"
                onChange={(e) => {
                  const val = e.target.value;
                  form.setValue("priority_id", val ? Number(val) : null);
                }}
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
              <label
                htmlFor="qc-due"
                className="mb-1 block text-[12px] font-medium text-ink-secondary"
              >
                Due date
              </label>
              <Input
                id="qc-due"
                type="date"
                className="font-mono text-[12px]"
                {...form.register("due_date")}
              />
            </div>
          </div>

          {tags.length > 0 && (
            <div>
              <p className="mb-1.5 text-[12px] font-medium text-ink-secondary">
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const active = selectedTagIds.includes(tag.tag_id);
                  return (
                    <button
                      key={tag.tag_id}
                      type="button"
                      onClick={() => toggleTag(tag.tag_id)}
                      className={cn(
                        "rounded-[6px] border px-2 py-1 text-[12px] font-medium transition-precision cursor-pointer",
                        active
                          ? "border-accent bg-accent-tint text-accent"
                          : "border-hairline bg-subtle text-ink-secondary hover:text-ink-primary"
                      )}
                    >
                      #{tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-hairline pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={createTask.isPending}
            >
              {createTask.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
              )}
              Create task
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
