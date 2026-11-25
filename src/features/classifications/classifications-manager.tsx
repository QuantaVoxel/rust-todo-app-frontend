"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  apiFetch,
  ApiClientError,
  applyApiValidationErrors,
} from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils/cn";
import {
  lookupKeys,
  useCategoriesList,
  useLabelsList,
  useTagsList,
} from "@/features/tasks/queries";

type TaxonomyTab = "tags" | "categories" | "labels";

const itemSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(255, "Maximum 255 characters"),
  description: z.string().optional(),
});

type ItemFormValues = z.infer<typeof itemSchema>;

export function ClassificationsManager() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TaxonomyTab>("tags");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [forceTarget, setForceTarget] = useState<{
    id: number;
    name: string;
    message: string;
  } | null>(null);

  const { data: tags = [], isLoading: tagsLoading } = useTagsList();
  const { data: categories = [], isLoading: catsLoading } = useCategoriesList();
  const { data: labels = [], isLoading: labelsLoading } = useLabelsList();

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: { name: "", description: "" },
  });

  const invalidateCurrent = () => {
    if (activeTab === "tags") {
      queryClient.invalidateQueries({ queryKey: lookupKeys.tags });
    } else if (activeTab === "categories") {
      queryClient.invalidateQueries({ queryKey: lookupKeys.categories });
    } else {
      queryClient.invalidateQueries({ queryKey: lookupKeys.labels });
    }
  };

  const createItem = useMutation({
    mutationFn: (values: ItemFormValues) => {
      if (activeTab === "tags") {
        return apiFetch(endpoints.tags(), {
          method: "POST",
          body: { name: values.name },
        });
      }
      if (activeTab === "categories") {
        return apiFetch(endpoints.categories(), {
          method: "POST",
          body: {
            name: values.name,
            description: values.description?.trim() || null,
          },
        });
      }
      return apiFetch(endpoints.labels(), {
        method: "POST",
        body: { name: values.name },
      });
    },
    onSuccess: () => {
      form.reset();
      invalidateCurrent();
    },
  });

  const updateItem = useMutation({
    mutationFn: ({
      id,
      name,
      description,
    }: {
      id: number;
      name: string;
      description?: string;
    }) => {
      if (activeTab === "tags") {
        return apiFetch(endpoints.tag(id), { method: "PATCH", body: { name } });
      }
      if (activeTab === "categories") {
        return apiFetch(endpoints.category(id), {
          method: "PATCH",
          body: { name, description: description?.trim() || null },
        });
      }
      return apiFetch(endpoints.label(id), { method: "PATCH", body: { name } });
    },
    onSuccess: () => {
      setEditingId(null);
      invalidateCurrent();
    },
  });

  const deleteItem = useMutation({
    mutationFn: ({ id, force }: { id: number; force: boolean }) => {
      if (activeTab === "tags") {
        return apiFetch(endpoints.tag(id, force), { method: "DELETE" });
      }
      if (activeTab === "categories") {
        return apiFetch(endpoints.category(id, force), { method: "DELETE" });
      }
      return apiFetch(endpoints.label(id, force), { method: "DELETE" });
    },
    onSuccess: () => {
      setForceTarget(null);
      invalidateCurrent();
    },
  });

  const handleDeleteClick = (id: number, name: string) => {
    deleteItem.mutate(
      { id, force: false },
      {
        onError: (err) => {
          if (err instanceof ApiClientError && err.status === 409) {
            setForceTarget({ id, name, message: err.message });
          } else {
            setForceTarget({
              id,
              name,
              message:
                err instanceof ApiClientError
                  ? err.message
                  : "This item may still be linked to tasks.",
            });
          }
        },
      }
    );
  };

  const onCreateSubmit = async (values: ItemFormValues) => {
    try {
      await createItem.mutateAsync(values);
    } catch (err) {
      applyApiValidationErrors(err, form.setError);
    }
  };

  const isLoading =
    activeTab === "tags"
      ? tagsLoading
      : activeTab === "categories"
        ? catsLoading
        : labelsLoading;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-hairline px-6">
        <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-ink-primary">
          Classifications
        </h1>
      </header>

      <div className="border-b border-hairline px-6">
        <div className="flex gap-6">
          {(
            [
              { id: "tags", label: "Tags", count: tags.length },
              { id: "categories", label: "Categories", count: categories.length },
              { id: "labels", label: "Labels", count: labels.length },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setEditingId(null);
                form.reset();
              }}
              className={cn(
                "flex items-center gap-2 border-b-2 py-3 text-[13px] font-medium transition-precision -mb-px cursor-pointer",
                activeTab === tab.id
                  ? "border-accent text-ink-primary"
                  : "border-transparent text-ink-muted hover:text-ink-secondary"
              )}
            >
              <span>{tab.label}</span>
              <span className="rounded-[4px] bg-subtle px-1.5 py-0.5 font-mono text-[11px] text-ink-muted tabular-nums">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-5">
          {/* Create Form */}
          <form
            onSubmit={form.handleSubmit(onCreateSubmit)}
            className="rounded-[8px] border border-hairline bg-canvas p-4 space-y-3"
          >
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <div className="flex-1">
                <Input
                  placeholder={
                    activeTab === "tags"
                      ? "New tag name..."
                      : activeTab === "categories"
                        ? "New category name..."
                        : "New label name..."
                  }
                  hasError={Boolean(form.formState.errors.name)}
                  {...form.register("name")}
                />
                {form.formState.errors.name && (
                  <p className="mt-1 text-[12px] text-danger">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>
              {activeTab === "categories" && (
                <Input
                  placeholder="Description (optional)"
                  className="flex-1"
                  {...form.register("description")}
                />
              )}
              <Button
                type="submit"
                variant="primary"
                disabled={createItem.isPending}
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span>Add</span>
              </Button>
            </div>
          </form>

          {/* Items List */}
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          ) : (
            <div className="divide-y divide-hairline rounded-[8px] border border-hairline bg-canvas">
              {activeTab === "tags" &&
                (tags.length === 0 ? (
                  <p className="px-4 py-4 text-[13px] text-ink-muted">
                    No tags created yet.
                  </p>
                ) : (
                  tags.map((tag) => (
                    <div
                      key={tag.tag_id}
                      className="flex min-h-[44px] items-center justify-between gap-3 px-4 py-2"
                    >
                      {editingId === tag.tag_id ? (
                        <div className="flex flex-1 items-center gap-2">
                          <Input
                            autoFocus
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-8 flex-1 text-[13px]"
                          />
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() =>
                              updateItem.mutate({
                                id: tag.tag_id,
                                name: editName.trim(),
                              })
                            }
                          >
                            Save
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono text-[11px] text-ink-muted tabular-nums">
                              #{tag.tag_id}
                            </span>
                            <span className="text-[13px] font-medium text-ink-primary">
                              {tag.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              aria-label={`Edit ${tag.name}`}
                              onClick={() => {
                                setEditingId(tag.tag_id);
                                setEditName(tag.name);
                              }}
                              className="rounded-[4px] p-1.5 text-ink-muted hover:bg-subtle hover:text-ink-primary cursor-pointer"
                            >
                              <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete ${tag.name}`}
                              onClick={() =>
                                handleDeleteClick(tag.tag_id, tag.name)
                              }
                              className="rounded-[4px] p-1.5 text-ink-muted hover:bg-subtle hover:text-danger cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                ))}

              {activeTab === "categories" &&
                (categories.length === 0 ? (
                  <p className="px-4 py-4 text-[13px] text-ink-muted">
                    No categories created yet.
                  </p>
                ) : (
                  categories.map((cat) => (
                    <div
                      key={cat.category_id}
                      className="flex min-h-[48px] items-center justify-between gap-3 px-4 py-2.5"
                    >
                      {editingId === cat.category_id ? (
                        <div className="flex flex-1 flex-wrap items-center gap-2">
                          <Input
                            autoFocus
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-8 flex-1 text-[13px]"
                          />
                          <Input
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            placeholder="Description"
                            className="h-8 flex-1 text-[13px]"
                          />
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() =>
                              updateItem.mutate({
                                id: cat.category_id,
                                name: editName.trim(),
                                description: editDesc,
                              })
                            }
                          >
                            Save
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div>
                            <p className="text-[13px] font-medium text-ink-primary">
                              {cat.name}
                            </p>
                            {cat.description && (
                              <p className="text-[12px] text-ink-secondary">
                                {cat.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              aria-label={`Edit ${cat.name}`}
                              onClick={() => {
                                setEditingId(cat.category_id);
                                setEditName(cat.name);
                                setEditDesc(cat.description ?? "");
                              }}
                              className="rounded-[4px] p-1.5 text-ink-muted hover:bg-subtle hover:text-ink-primary cursor-pointer"
                            >
                              <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete ${cat.name}`}
                              onClick={() =>
                                handleDeleteClick(cat.category_id, cat.name)
                              }
                              className="rounded-[4px] p-1.5 text-ink-muted hover:bg-subtle hover:text-danger cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                ))}

              {activeTab === "labels" &&
                (labels.length === 0 ? (
                  <p className="px-4 py-4 text-[13px] text-ink-muted">
                    No labels created yet.
                  </p>
                ) : (
                  labels.map((lbl) => (
                    <div
                      key={lbl.label_id}
                      className="flex min-h-[44px] items-center justify-between gap-3 px-4 py-2"
                    >
                      {editingId === lbl.label_id ? (
                        <div className="flex flex-1 items-center gap-2">
                          <Input
                            autoFocus
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-8 flex-1 text-[13px]"
                          />
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() =>
                              updateItem.mutate({
                                id: lbl.label_id,
                                name: editName.trim(),
                              })
                            }
                          >
                            Save
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono text-[11px] text-ink-muted tabular-nums">
                              #{lbl.label_id}
                            </span>
                            <span className="text-[13px] font-medium text-ink-primary">
                              {lbl.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              aria-label={`Edit ${lbl.name}`}
                              onClick={() => {
                                setEditingId(lbl.label_id);
                                setEditName(lbl.name);
                              }}
                              className="rounded-[4px] p-1.5 text-ink-muted hover:bg-subtle hover:text-ink-primary cursor-pointer"
                            >
                              <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete ${lbl.name}`}
                              onClick={() =>
                                handleDeleteClick(lbl.label_id, lbl.name)
                              }
                              className="rounded-[4px] p-1.5 text-ink-muted hover:bg-subtle hover:text-danger cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Force Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(forceTarget)}
        onOpenChange={(o) => !o && setForceTarget(null)}
      >
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Force delete &quot;{forceTarget?.name}&quot;?</DialogTitle>
            <DialogDescription>{forceTarget?.message}</DialogDescription>
          </DialogHeader>
          <p className="text-[13px] text-ink-secondary">
            Deleting with <code className="font-mono text-ink-primary">?force=true</code>{" "}
            will unlink this item from all associated tasks.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setForceTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={deleteItem.isPending}
              onClick={() =>
                forceTarget &&
                deleteItem.mutate({ id: forceTarget.id, force: true })
              }
            >
              Force delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
