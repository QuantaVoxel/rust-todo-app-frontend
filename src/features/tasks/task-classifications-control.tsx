"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Plus } from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils/cn";
import {
  taskKeys,
  useCategoriesList,
  useLabelsList,
  useTagsList,
} from "./queries";

export function TaskClassificationsControl({
  taskId,
  canEdit,
}: {
  taskId: number;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: tags = [] } = useTagsList();
  const { data: categories = [] } = useCategoriesList();
  const { data: labels = [] } = useLabelsList();

  const [attachedTagIds, setAttachedTagIds] = useState<number[]>([]);
  const [attachedCatIds, setAttachedCatIds] = useState<number[]>([]);
  const [attachedLabelIds, setAttachedLabelIds] = useState<number[]>([]);

  const toggleTag = useMutation({
    mutationFn: ({ tagId, attached }: { tagId: number; attached: boolean }) =>
      apiFetch(endpoints.taskTag(taskId, tagId), {
        method: attached ? "DELETE" : "PUT",
      }),
    onSuccess: (_, vars) => {
      setAttachedTagIds((prev) =>
        vars.attached
          ? prev.filter((id) => id !== vars.tagId)
          : [...prev, vars.tagId]
      );
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });

  const toggleCategory = useMutation({
    mutationFn: ({ catId, attached }: { catId: number; attached: boolean }) =>
      apiFetch(endpoints.taskCategory(taskId, catId), {
        method: attached ? "DELETE" : "PUT",
      }),
    onSuccess: (_, vars) => {
      setAttachedCatIds((prev) =>
        vars.attached
          ? prev.filter((id) => id !== vars.catId)
          : [...prev, vars.catId]
      );
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });

  const toggleLabel = useMutation({
    mutationFn: ({
      labelId,
      attached,
    }: {
      labelId: number;
      attached: boolean;
    }) =>
      apiFetch(endpoints.taskLabel(taskId, labelId), {
        method: attached ? "DELETE" : "PUT",
      }),
    onSuccess: (_, vars) => {
      setAttachedLabelIds((prev) =>
        vars.attached
          ? prev.filter((id) => id !== vars.labelId)
          : [...prev, vars.labelId]
      );
      queryClient.invalidateQueries({
        queryKey: ["tasks", taskId, "history", "labels"],
      });
    },
  });

  return (
    <div className="space-y-2.5">
      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-medium text-ink-muted">
            Tags:
          </span>
          {tags.map((t) => {
            const active = attachedTagIds.includes(t.tag_id);
            return (
              <button
                key={t.tag_id}
                type="button"
                disabled={!canEdit || toggleTag.isPending}
                onClick={() =>
                  toggleTag.mutate({ tagId: t.tag_id, attached: active })
                }
                className={cn(
                  "inline-flex items-center gap-1 rounded-[5px] border px-1.5 py-0.5 text-[11px] transition-precision cursor-pointer disabled:opacity-60",
                  active
                    ? "border-accent bg-accent-tint text-accent"
                    : "border-hairline bg-surface text-ink-secondary hover:border-strong"
                )}
              >
                {active ? (
                  <Check className="h-2.5 w-2.5" strokeWidth={2} />
                ) : (
                  <Plus className="h-2.5 w-2.5" strokeWidth={1.75} />
                )}
                <span>#{t.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-medium text-ink-muted">
            Categories:
          </span>
          {categories.map((c) => {
            const active = attachedCatIds.includes(c.category_id);
            return (
              <button
                key={c.category_id}
                type="button"
                disabled={!canEdit || toggleCategory.isPending}
                onClick={() =>
                  toggleCategory.mutate({
                    catId: c.category_id,
                    attached: active,
                  })
                }
                className={cn(
                  "inline-flex items-center gap-1 rounded-[5px] border px-1.5 py-0.5 text-[11px] transition-precision cursor-pointer disabled:opacity-60",
                  active
                    ? "border-accent bg-accent-tint text-accent"
                    : "border-hairline bg-surface text-ink-secondary hover:border-strong"
                )}
              >
                {active ? (
                  <Check className="h-2.5 w-2.5" strokeWidth={2} />
                ) : (
                  <Plus className="h-2.5 w-2.5" strokeWidth={1.75} />
                )}
                <span>{c.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {labels.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-medium text-ink-muted">
            Labels:
          </span>
          {labels.map((l) => {
            const active = attachedLabelIds.includes(l.label_id);
            return (
              <button
                key={l.label_id}
                type="button"
                disabled={!canEdit || toggleLabel.isPending}
                onClick={() =>
                  toggleLabel.mutate({
                    labelId: l.label_id,
                    attached: active,
                  })
                }
                className={cn(
                  "inline-flex items-center gap-1 rounded-[5px] border px-1.5 py-0.5 text-[11px] transition-precision cursor-pointer disabled:opacity-60",
                  active
                    ? "border-accent bg-accent-tint text-accent"
                    : "border-hairline bg-surface text-ink-secondary hover:border-strong"
                )}
              >
                {active ? (
                  <Check className="h-2.5 w-2.5" strokeWidth={2} />
                ) : (
                  <Plus className="h-2.5 w-2.5" strokeWidth={1.75} />
                )}
                <span>{l.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
