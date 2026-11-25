"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Folder, Hash, Pencil, Plus, Search, Tag, Trash2, X } from "lucide-react";
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

const TAXONOMY_META: Record<
  TaxonomyTab,
  {
    title: string;
    singular: string;
    placeholder: string;
    guidance: string;
  }
> = {
  tags: {
    title: "Tags",
    singular: "tag",
    placeholder: "e.g., finance, backend, q4-release",
    guidance:
      "Tags group related tasks for fast filtering and are automatically copied when a recurring task spawns a new instance.",
  },
  categories: {
    title: "Categories",
    singular: "category",
    placeholder: "e.g., Engineering, Operations",
    guidance:
      "Categories organize tasks into broader areas of responsibility with an optional description for team context.",
  },
  labels: {
    title: "Labels",
    singular: "label",
    placeholder: "e.g., blocked, needs-review",
    guidance:
      "Labels track workflow states. Every attach and detach action is recorded in the task audit trail.",
  },
};

export function ClassificationsManager() {
  const queryClient = useQueryClient();
  const createInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<TaxonomyTab>("tags");
  const [search, setSearch] = useState("");
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
          setForceTarget({
            id,
            name,
            message:
              err instanceof ApiClientError
                ? err.message
                : "This item is still linked to one or more tasks.",
          });
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

  const normalizedSearch = search.trim().toLowerCase();

  const filteredTags = useMemo(
    () =>
      normalizedSearch
        ? tags.filter((t) => t.name.toLowerCase().includes(normalizedSearch))
        : tags,
    [tags, normalizedSearch]
  );

  const filteredCategories = useMemo(
    () =>
      normalizedSearch
        ? categories.filter(
            (c) =>
              c.name.toLowerCase().includes(normalizedSearch) ||
              c.description?.toLowerCase().includes(normalizedSearch)
          )
        : categories,
    [categories, normalizedSearch]
  );

  const filteredLabels = useMemo(
    () =>
      normalizedSearch
        ? labels.filter((l) => l.name.toLowerCase().includes(normalizedSearch))
        : labels,
    [labels, normalizedSearch]
  );

  const isLoading =
    activeTab === "tags"
      ? tagsLoading
      : activeTab === "categories"
        ? catsLoading
        : labelsLoading;

  const currentMeta = TAXONOMY_META[activeTab];
  const { ref: nameFormRef, ...nameRegister } = form.register("name");

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Top Header */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-hairline px-5">
        <div className="flex items-center gap-3">
          <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-ink-primary">
            Classifications
          </h1>
          <span className="rounded-[4px] bg-subtle px-1.5 py-0.5 font-mono text-[11px] text-ink-muted tabular-nums">
            {tags.length + categories.length + labels.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-[200px] sm:w-[240px]">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted"
              strokeWidth={1.75}
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Filter ${currentMeta.title.toLowerCase()}...`}
              className="h-8 pl-8 pr-7 text-[12px]"
            />
            {search && (
              <button
                type="button"
                aria-label="Clear filter"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-primary cursor-pointer"
              >
                <X className="h-3 w-3" strokeWidth={1.75} />
              </button>
            )}
          </div>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => createInputRef.current?.focus()}
            className="hidden sm:inline-flex"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>New {currentMeta.singular}</span>
          </Button>
        </div>
      </header>

      {/* Split-Pane Body */}
      <div className="grid flex-1 min-h-0 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_340px]">
        {/* Left Pane: Tabbed Registry List */}
        <div className="flex min-h-0 flex-col overflow-hidden bg-surface">
          <div className="flex shrink-0 items-center gap-6 border-b border-hairline px-5">
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
                  setSearch("");
                  form.reset();
                }}
                className={cn(
                  "flex items-center gap-2 border-b-2 py-2.5 text-[13px] font-medium transition-precision -mb-px cursor-pointer",
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

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div>
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="flex h-[44px] items-center gap-3 border-b border-hairline px-5"
                  >
                    <Skeleton className="h-3.5 w-3.5" />
                    <Skeleton className="h-3 w-8" />
                    <Skeleton className="h-3.5 w-44" />
                  </div>
                ))}
              </div>
            ) : (
              <div>
                {activeTab === "tags" &&
                  (filteredTags.length === 0 ? (
                    <EmptyTaxonomy
                      label={
                        normalizedSearch
                          ? "No tags match your filter."
                          : "No tags yet. Create one in the right panel."
                      }
                    />
                  ) : (
                    filteredTags.map((tag) => (
                      <div
                        key={tag.tag_id}
                        className="group flex min-h-[44px] items-center justify-between gap-3 border-b border-hairline px-5 py-1.5 hover:bg-subtle/60 transition-precision"
                      >
                        {editingId === tag.tag_id ? (
                          <InlineEditRow
                            value={editName}
                            onChange={setEditName}
                            onSave={() =>
                              updateItem.mutate({
                                id: tag.tag_id,
                                name: editName.trim(),
                              })
                            }
                            onCancel={() => setEditingId(null)}
                          />
                        ) : (
                          <>
                            <div className="flex min-w-0 items-center gap-3">
                              <Hash
                                className="h-3.5 w-3.5 shrink-0 text-ink-muted"
                                strokeWidth={1.75}
                              />
                              <span className="w-8 shrink-0 font-mono text-[11px] text-ink-muted tabular-nums">
                                #{tag.tag_id}
                              </span>
                              <span className="truncate text-[13px] font-medium text-ink-primary">
                                {tag.name}
                              </span>
                            </div>
                            <RowActions
                              label={tag.name}
                              onEdit={() => {
                                setEditingId(tag.tag_id);
                                setEditName(tag.name);
                              }}
                              onDelete={() =>
                                handleDeleteClick(tag.tag_id, tag.name)
                              }
                            />
                          </>
                        )}
                      </div>
                    ))
                  ))}

                {activeTab === "categories" &&
                  (filteredCategories.length === 0 ? (
                    <EmptyTaxonomy
                      label={
                        normalizedSearch
                          ? "No categories match your filter."
                          : "No categories yet. Create one in the right panel."
                      }
                    />
                  ) : (
                    filteredCategories.map((cat) => (
                      <div
                        key={cat.category_id}
                        className="group flex min-h-[48px] items-center justify-between gap-3 border-b border-hairline px-5 py-2 hover:bg-subtle/60 transition-precision"
                      >
                        {editingId === cat.category_id ? (
                          <div className="flex flex-1 flex-wrap items-center gap-2">
                            <Input
                              autoFocus
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") setEditingId(null);
                              }}
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
                            <div className="flex min-w-0 items-start gap-3">
                              <Folder
                                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-muted"
                                strokeWidth={1.75}
                              />
                              <span className="mt-0.5 w-8 shrink-0 font-mono text-[11px] text-ink-muted tabular-nums">
                                #{cat.category_id}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-[13px] font-medium text-ink-primary">
                                  {cat.name}
                                </p>
                                {cat.description && (
                                  <p className="truncate text-[12px] text-ink-secondary">
                                    {cat.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            <RowActions
                              label={cat.name}
                              onEdit={() => {
                                setEditingId(cat.category_id);
                                setEditName(cat.name);
                                setEditDesc(cat.description ?? "");
                              }}
                              onDelete={() =>
                                handleDeleteClick(cat.category_id, cat.name)
                              }
                            />
                          </>
                        )}
                      </div>
                    ))
                  ))}

                {activeTab === "labels" &&
                  (filteredLabels.length === 0 ? (
                    <EmptyTaxonomy
                      label={
                        normalizedSearch
                          ? "No labels match your filter."
                          : "No labels yet. Create one in the right panel."
                      }
                    />
                  ) : (
                    filteredLabels.map((lbl) => (
                      <div
                        key={lbl.label_id}
                        className="group flex min-h-[44px] items-center justify-between gap-3 border-b border-hairline px-5 py-1.5 hover:bg-subtle/60 transition-precision"
                      >
                        {editingId === lbl.label_id ? (
                          <InlineEditRow
                            value={editName}
                            onChange={setEditName}
                            onSave={() =>
                              updateItem.mutate({
                                id: lbl.label_id,
                                name: editName.trim(),
                              })
                            }
                            onCancel={() => setEditingId(null)}
                          />
                        ) : (
                          <>
                            <div className="flex min-w-0 items-center gap-3">
                              <Tag
                                className="h-3.5 w-3.5 shrink-0 text-ink-muted"
                                strokeWidth={1.75}
                              />
                              <span className="w-8 shrink-0 font-mono text-[11px] text-ink-muted tabular-nums">
                                #{lbl.label_id}
                              </span>
                              <span className="truncate text-[13px] font-medium text-ink-primary">
                                {lbl.name}
                              </span>
                            </div>
                            <RowActions
                              label={lbl.name}
                              onEdit={() => {
                                setEditingId(lbl.label_id);
                                setEditName(lbl.name);
                              }}
                              onDelete={() =>
                                handleDeleteClick(lbl.label_id, lbl.name)
                              }
                            />
                          </>
                        )}
                      </div>
                    ))
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Create & Taxonomy Context */}
        <aside className="border-t border-hairline bg-canvas p-5 lg:border-l lg:border-t-0 overflow-y-auto">
          <div className="space-y-5">
            <div>
              <h2 className="text-[14px] font-semibold text-ink-primary">
                Create {currentMeta.singular}
              </h2>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">
                {currentMeta.guidance}
              </p>
            </div>

            <form
              onSubmit={form.handleSubmit(onCreateSubmit)}
              className="space-y-3.5"
            >
              <div>
                <label
                  htmlFor="tax-name"
                  className="mb-1.5 block text-[12px] font-medium text-ink-secondary"
                >
                  Name
                </label>
                <Input
                  id="tax-name"
                  placeholder={currentMeta.placeholder}
                  hasError={Boolean(form.formState.errors.name)}
                  {...nameRegister}
                  ref={(el) => {
                    nameFormRef(el);
                    createInputRef.current = el;
                  }}
                />
                {form.formState.errors.name && (
                  <p className="mt-1 text-[12px] text-danger">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              {activeTab === "categories" && (
                <div>
                  <label
                    htmlFor="tax-desc"
                    className="mb-1.5 block text-[12px] font-medium text-ink-secondary"
                  >
                    Description{" "}
                    <span className="text-ink-muted">(Optional)</span>
                  </label>
                  <textarea
                    id="tax-desc"
                    rows={3}
                    placeholder="What belongs in this category..."
                    className="w-full rounded-[6px] border border-hairline bg-subtle px-3 py-2 text-[13px] text-ink-primary placeholder:text-ink-muted focus:border-strong focus:bg-surface focus-ring"
                    {...form.register("description")}
                  />
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                className="w-full h-9"
                disabled={createItem.isPending}
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span>Create {currentMeta.singular}</span>
              </Button>
            </form>
          </div>
        </aside>
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
            Deleting with{" "}
            <code className="font-mono text-ink-primary">?force=true</code> will
            unlink this {currentMeta.singular} from all associated tasks.
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

function EmptyTaxonomy({ label }: { label: string }) {
  return (
    <div className="px-5 py-10 text-[13px] text-ink-muted">{label}</div>
  );
}

function RowActions({
  label,
  onEdit,
  onDelete,
}: {
  label: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-precision">
      <button
        type="button"
        aria-label={`Edit ${label}`}
        onClick={onEdit}
        className="rounded-[4px] p-1.5 text-ink-muted hover:bg-subtle hover:text-ink-primary cursor-pointer"
      >
        <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        aria-label={`Delete ${label}`}
        onClick={onDelete}
        className="rounded-[4px] p-1.5 text-ink-muted hover:bg-subtle hover:text-danger cursor-pointer"
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
    </div>
  );
}

function InlineEditRow({
  value,
  onChange,
  onSave,
  onCancel,
}: {
  value: string;
  onChange: (val: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-1 items-center gap-2">
      <Input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSave();
          } else if (e.key === "Escape") {
            onCancel();
          }
        }}
        className="h-8 flex-1 text-[13px]"
      />
      <Button type="button" variant="primary" size="sm" onClick={onSave}>
        Save
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
