"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  ArrowUpRight,
  Folder,
  Hash,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from "lucide-react";
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
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils/cn";
import {
  lookupKeys,
  taskKeys,
  useCategoriesList,
  useLabelsList,
  useTagsList,
} from "@/features/tasks/queries";

type TaxonomyTab = "tags" | "categories" | "labels";
type SortMode = "newest" | "az" | "za";

function parseTab(raw: string | null): TaxonomyTab {
  if (raw === "categories" || raw === "labels" || raw === "tags") return raw;
  return "tags";
}

export function ClassificationsManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const shouldReduceMotion = useReducedMotion();

  const activeTab = parseTab(searchParams.get("tab"));

  const createInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");

  // Inline create state (never cleared on error!)
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);

  // Inline edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // 2-Stage Force Delete Dialog state
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
    stage: "confirm" | "force";
    warningMessage?: string;
  } | null>(null);

  const { data: tags = [], isLoading: tagsLoading } = useTagsList();
  const { data: categories = [], isLoading: catsLoading } = useCategoriesList();
  const { data: labels = [], isLoading: labelsLoading } = useLabelsList();

  const switchTab = (tab: TaxonomyTab) => {
    setEditingId(null);
    setCreateError(null);
    setSearch("");
    router.replace(`/classifications?tab=${tab}`);
  };

  const invalidateTaxonomy = () => {
    if (activeTab === "tags") {
      queryClient.invalidateQueries({ queryKey: lookupKeys.tags });
    } else if (activeTab === "categories") {
      queryClient.invalidateQueries({ queryKey: lookupKeys.categories });
    } else {
      queryClient.invalidateQueries({ queryKey: lookupKeys.labels });
    }
    queryClient.invalidateQueries({ queryKey: taskKeys.all });
  };

  const createItem = useMutation({
    mutationFn: () => {
      const trimmedName = newName.trim();
      if (activeTab === "tags") {
        return apiFetch(endpoints.tags(), {
          method: "POST",
          body: { name: trimmedName },
        });
      }
      if (activeTab === "categories") {
        return apiFetch(endpoints.categories(), {
          method: "POST",
          body: {
            name: trimmedName,
            description: newDesc.trim() || null,
          },
        });
      }
      return apiFetch(endpoints.labels(), {
        method: "POST",
        body: { name: trimmedName },
      });
    },
    onSuccess: () => {
      setNewName("");
      setNewDesc("");
      setCreateError(null);
      invalidateTaxonomy();
    },
    onError: (err) => {
      const msg =
        err instanceof ApiClientError
          ? err.details?.[0]?.issue ?? err.message
          : "Failed to create item.";
      setCreateError(msg);
      setShakeKey((k) => k + 1);
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
      invalidateTaxonomy();
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
      setDeleteTarget(null);
      invalidateTaxonomy();
    },
    onError: (err, vars) => {
      if (!vars.force && deleteTarget) {
        setDeleteTarget({
          ...deleteTarget,
          stage: "force",
          warningMessage:
            err instanceof ApiClientError
              ? err.message
              : "This item is still attached to one or more tasks.",
        });
      }
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setCreateError("Name is required.");
      setShakeKey((k) => k + 1);
      return;
    }
    createItem.mutate();
  };

  const normalizedSearch = search.trim().toLowerCase();

  const filteredTags = useMemo(() => {
    const base = normalizedSearch
      ? tags.filter((t) => t.name.toLowerCase().includes(normalizedSearch))
      : [...tags];
    if (sortMode === "az") return base.sort((a, b) => a.name.localeCompare(b.name));
    if (sortMode === "za") return base.sort((a, b) => b.name.localeCompare(a.name));
    return base.sort((a, b) => b.tag_id - a.tag_id);
  }, [tags, normalizedSearch, sortMode]);

  const filteredCategories = useMemo(() => {
    const base = normalizedSearch
      ? categories.filter(
          (c) =>
            c.name.toLowerCase().includes(normalizedSearch) ||
            c.description?.toLowerCase().includes(normalizedSearch)
        )
      : [...categories];
    if (sortMode === "az") return base.sort((a, b) => a.name.localeCompare(b.name));
    if (sortMode === "za") return base.sort((a, b) => b.name.localeCompare(a.name));
    return base.sort((a, b) => b.category_id - a.category_id);
  }, [categories, normalizedSearch, sortMode]);

  const filteredLabels = useMemo(() => {
    const base = normalizedSearch
      ? labels.filter((l) => l.name.toLowerCase().includes(normalizedSearch))
      : [...labels];
    if (sortMode === "az") return base.sort((a, b) => a.name.localeCompare(b.name));
    if (sortMode === "za") return base.sort((a, b) => b.name.localeCompare(a.name));
    return base.sort((a, b) => b.label_id - a.label_id);
  }, [labels, normalizedSearch, sortMode]);

  const isLoading =
    activeTab === "tags"
      ? tagsLoading
      : activeTab === "categories"
        ? catsLoading
        : labelsLoading;

  const singular =
    activeTab === "tags"
      ? "tag"
      : activeTab === "categories"
        ? "category"
        : "label";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Page Header */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-hairline px-6 py-4">
        <div>
          <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-ink-primary">
            Classifications
          </h1>
          <p className="mt-0.5 text-[13px] text-ink-secondary">
            Organize tasks across tags, categories, and labels.
          </p>
        </div>

        {/* Segmented Tab Switcher (`layoutId`) */}
        <div
          role="tablist"
          aria-label="Classification type"
          className="flex items-center gap-1 rounded-[8px] border border-hairline bg-canvas p-1"
        >
          {(
            [
              { id: "tags", label: "Tags", count: tags.length },
              {
                id: "categories",
                label: "Categories",
                count: categories.length,
              },
              { id: "labels", label: "Labels", count: labels.length },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => switchTab(tab.id)}
                className={cn(
                  "relative z-10 flex h-8 items-center gap-2 rounded-[6px] px-3 text-[13px] font-medium transition-precision cursor-pointer focus-ring",
                  active
                    ? "text-ink-primary"
                    : "text-ink-muted hover:text-ink-secondary"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="classifications-tab"
                    transition={
                      shouldReduceMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 460, damping: 34 }
                    }
                    className="absolute inset-0 -z-10 rounded-[6px] border border-hairline bg-surface"
                  />
                )}
                <span>{tab.label}</span>
                <span className="rounded-[4px] bg-subtle px-1.5 py-0.5 font-mono text-[10px] text-ink-muted tabular-nums">
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Toolbar: Search + Sort */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-hairline bg-canvas/50 px-6 py-2.5">
        <div className="relative min-w-[200px] flex-1 max-w-[320px]">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted"
            strokeWidth={1.75}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Filter ${activeTab}...`}
            className="h-8 pl-8 pr-7 text-[12px]"
          />
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-primary cursor-pointer"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          )}
        </div>

        <select
          aria-label="Sort items"
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          className="h-8 rounded-[6px] border border-hairline bg-subtle px-2.5 text-[12px] text-ink-secondary focus-ring"
        >
          <option value="newest">Sort: Newest</option>
          <option value="az">Name: A–Z</option>
          <option value="za">Name: Z–A</option>
        </select>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-5xl space-y-5">
          {/* Quick Inline Creation Bar */}
          <motion.form
            key={shakeKey}
            onSubmit={handleCreateSubmit}
            animate={
              createError && !shouldReduceMotion
                ? { x: [0, -6, 6, -4, 4, 0] }
                : { x: 0 }
            }
            transition={{ duration: 0.3 }}
            className="rounded-[8px] border border-hairline bg-canvas p-3"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-2">
                <Plus
                  className="h-4 w-4 shrink-0 text-accent"
                  strokeWidth={1.75}
                />
                <Input
                  ref={createInputRef}
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (createError) setCreateError(null);
                  }}
                  placeholder={`+ Create new ${singular}...`}
                  hasError={Boolean(createError)}
                  className="h-8 flex-1 text-[13px]"
                />
              </div>

              {activeTab === "categories" && (
                <Input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Description (optional)"
                  className="h-8 flex-1 text-[13px]"
                />
              )}

              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="h-8 px-3"
                disabled={createItem.isPending}
              >
                Add {singular}
              </Button>
            </div>
            {createError && (
              <p className="mt-1.5 pl-6 text-[12px] text-danger">
                {createError}
              </p>
            )}
          </motion.form>

          {/* Items View */}
          {isLoading ? (
            activeTab === "categories" ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            )
          ) : activeTab === "tags" ? (
            filteredTags.length === 0 ? (
              <EmptyState
                hasSearch={Boolean(normalizedSearch)}
                singular="tag"
                onResetSearch={() => setSearch("")}
                onFocusCreate={() => createInputRef.current?.focus()}
              />
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {filteredTags.map((tag) => (
                    <motion.div
                      key={tag.tag_id}
                      layout={!shouldReduceMotion}
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={
                        shouldReduceMotion ? undefined : { opacity: 0, scale: 0.96 }
                      }
                      transition={{ duration: 0.16 }}
                      className="group flex min-h-[48px] items-center justify-between gap-2 rounded-[8px] border border-hairline bg-canvas px-3 py-2 hover:border-strong transition-precision"
                    >
                      {editingId === tag.tag_id ? (
                        <InlineRenameInput
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
                          <div
                            onDoubleClick={() => {
                              setEditingId(tag.tag_id);
                              setEditName(tag.name);
                            }}
                            className="flex min-w-0 items-center gap-2 cursor-text"
                          >
                            <span className="inline-flex items-center gap-1 rounded-[5px] border border-hairline bg-surface px-2 py-0.5 text-[12px] font-medium text-ink-primary">
                              <Hash
                                className="h-3 w-3 text-accent"
                                strokeWidth={1.75}
                              />
                              <span className="truncate max-w-[140px]">
                                {tag.name}
                              </span>
                            </span>
                          </div>

                          <div className="flex shrink-0 items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-precision">
                            <Link
                              href={`/tasks?tag_id=${tag.tag_id}`}
                              title="View tasks with this tag"
                              aria-label={`Filter tasks by ${tag.name}`}
                              className="rounded-[4px] p-1 text-ink-muted hover:bg-subtle hover:text-accent"
                            >
                              <ArrowUpRight
                                className="h-3.5 w-3.5"
                                strokeWidth={1.75}
                              />
                            </Link>
                            <button
                              type="button"
                              aria-label={`Rename ${tag.name}`}
                              onClick={() => {
                                setEditingId(tag.tag_id);
                                setEditName(tag.name);
                              }}
                              className="rounded-[4px] p-1 text-ink-muted hover:bg-subtle hover:text-ink-primary cursor-pointer"
                            >
                              <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete ${tag.name}`}
                              onClick={() =>
                                setDeleteTarget({
                                  id: tag.tag_id,
                                  name: tag.name,
                                  stage: "confirm",
                                })
                              }
                              className="rounded-[4px] p-1 text-ink-muted hover:bg-danger-tint hover:text-danger cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </button>
                          </div>
                        </>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )
          ) : activeTab === "labels" ? (
            filteredLabels.length === 0 ? (
              <EmptyState
                hasSearch={Boolean(normalizedSearch)}
                singular="label"
                onResetSearch={() => setSearch("")}
                onFocusCreate={() => createInputRef.current?.focus()}
              />
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {filteredLabels.map((lbl) => (
                    <motion.div
                      key={lbl.label_id}
                      layout={!shouldReduceMotion}
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={
                        shouldReduceMotion ? undefined : { opacity: 0, scale: 0.96 }
                      }
                      transition={{ duration: 0.16 }}
                      className="group flex min-h-[48px] items-center justify-between gap-2 rounded-[8px] border border-hairline bg-canvas px-3 py-2 hover:border-strong transition-precision"
                    >
                      {editingId === lbl.label_id ? (
                        <InlineRenameInput
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
                          <div
                            onDoubleClick={() => {
                              setEditingId(lbl.label_id);
                              setEditName(lbl.name);
                            }}
                            className="flex min-w-0 items-center gap-2 cursor-text"
                          >
                            <span className="inline-flex items-center gap-1.5 rounded-[5px] border border-hairline bg-surface px-2 py-0.5 text-[12px] font-medium text-ink-primary">
                              <Tag
                                className="h-3 w-3 text-ink-muted"
                                strokeWidth={1.75}
                              />
                              <span className="truncate max-w-[160px]">
                                {lbl.name}
                              </span>
                            </span>
                          </div>

                          <div className="flex shrink-0 items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-precision">
                            <button
                              type="button"
                              aria-label={`Rename ${lbl.name}`}
                              onClick={() => {
                                setEditingId(lbl.label_id);
                                setEditName(lbl.name);
                              }}
                              className="rounded-[4px] p-1 text-ink-muted hover:bg-subtle hover:text-ink-primary cursor-pointer"
                            >
                              <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete ${lbl.name}`}
                              onClick={() =>
                                setDeleteTarget({
                                  id: lbl.label_id,
                                  name: lbl.name,
                                  stage: "confirm",
                                })
                              }
                              className="rounded-[4px] p-1 text-ink-muted hover:bg-danger-tint hover:text-danger cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </button>
                          </div>
                        </>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )
          ) : filteredCategories.length === 0 ? (
            <EmptyState
              hasSearch={Boolean(normalizedSearch)}
              singular="category"
              onResetSearch={() => setSearch("")}
              onFocusCreate={() => createInputRef.current?.focus()}
            />
          ) : (
            <div className="divide-y divide-hairline rounded-[8px] border border-hairline bg-canvas">
              <AnimatePresence mode="popLayout">
                {filteredCategories.map((cat) => (
                  <motion.div
                    key={cat.category_id}
                    layout={!shouldReduceMotion}
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={shouldReduceMotion ? undefined : { opacity: 0 }}
                    transition={{ duration: 0.16 }}
                    className="group flex min-h-[56px] items-center justify-between gap-4 px-4 py-3 hover:bg-subtle/40 transition-precision"
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
                        <div className="grid flex-1 grid-cols-1 gap-1 sm:grid-cols-[220px_1fr] sm:items-center sm:gap-4">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Folder
                              className="h-4 w-4 shrink-0 text-ink-muted"
                              strokeWidth={1.75}
                            />
                            <span className="truncate text-[13px] font-medium text-ink-primary">
                              {cat.name}
                            </span>
                          </div>
                          <p className="text-[12px] text-ink-secondary line-clamp-2">
                            {cat.description || "No description"}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-precision">
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
                              setDeleteTarget({
                                id: cat.category_id,
                                name: cat.name,
                                stage: "confirm",
                              })
                            }
                            className="rounded-[4px] p-1.5 text-ink-muted hover:bg-danger-tint hover:text-danger cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                          </button>
                        </div>
                      </>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Smart 2-Stage Force Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent className="max-w-[440px]">
          <AnimatePresence mode="wait">
            {deleteTarget?.stage === "confirm" ? (
              <motion.div
                key="stage-confirm"
                initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                <DialogHeader>
                  <DialogTitle>Delete &quot;{deleteTarget.name}&quot;?</DialogTitle>
                  <DialogDescription>
                    This removes the {singular} if it is not attached to any
                    tasks.
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setDeleteTarget(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={deleteItem.isPending}
                    onClick={() =>
                      deleteItem.mutate({ id: deleteTarget.id, force: false })
                    }
                  >
                    Delete
                  </Button>
                </div>
              </motion.div>
            ) : deleteTarget?.stage === "force" ? (
              <motion.div
                key="stage-force"
                initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                <DialogHeader>
                  <div className="mb-1 flex items-center gap-2 text-warning">
                    <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
                    <DialogTitle>
                      &quot;{deleteTarget.name}&quot; is in use
                    </DialogTitle>
                  </div>
                  <DialogDescription>
                    This {singular} is still attached to one or more tasks.
                    Force deleting will unlink it from all tasks permanently.
                  </DialogDescription>
                </DialogHeader>

                {activeTab === "labels" && (
                  <p className="rounded-[6px] border border-hairline bg-canvas px-3 py-2 text-[12px] text-ink-secondary">
                    Note: Unlinking labels is recorded in each task&apos;s audit
                    history.
                  </p>
                )}

                <div className="mt-5 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setDeleteTarget(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={deleteItem.isPending}
                    onClick={() =>
                      deleteItem.mutate({ id: deleteTarget.id, force: true })
                    }
                  >
                    Force Delete &amp; Unlink
                  </Button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InlineRenameInput({
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
    <div className="flex flex-1 items-center gap-1.5">
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
        className="h-7 flex-1 text-[12px]"
      />
      <Button type="button" variant="primary" size="sm" onClick={onSave}>
        Save
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
        Esc
      </Button>
    </div>
  );
}

function EmptyState({
  hasSearch,
  singular,
  onResetSearch,
  onFocusCreate,
}: {
  hasSearch: boolean;
  singular: string;
  onResetSearch: () => void;
  onFocusCreate: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[8px] border border-hairline bg-canvas px-6 py-12 text-center">
      {hasSearch ? (
        <>
          <p className="text-[14px] font-medium text-ink-primary">
            No matching {singular} found
          </p>
          <p className="mt-1 text-[13px] text-ink-secondary">
            Clear your search filter to view all items.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={onResetSearch}
          >
            Reset search
          </Button>
        </>
      ) : (
        <>
          <p className="text-[14px] font-medium text-ink-primary">
            No {singular} created yet
          </p>
          <p className="mt-1 text-[13px] text-ink-secondary">
            Create your first {singular} using the inline bar above.
          </p>
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="mt-4"
            onClick={onFocusCreate}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
            Create {singular}
          </Button>
        </>
      )}
    </div>
  );
}
