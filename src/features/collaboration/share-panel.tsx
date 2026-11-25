"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Trash2, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type {
  SharePermission,
  TaskShareResponse,
  UserSearchResult,
} from "@/lib/api/types";
import { taskKeys, useTaskShares } from "@/features/tasks/queries";

export function SharePanel({
  taskId,
  canManage,
}: {
  taskId: number;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedPerm, setSelectedPerm] = useState<SharePermission>("view");

  const { data: shares = [] } = useTaskShares(taskId, true);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: users = [] } = useQuery({
    queryKey: ["users", "search", debouncedSearch],
    queryFn: () =>
      apiFetch<UserSearchResult[]>(endpoints.usersSearch(debouncedSearch)),
    enabled: modalOpen && debouncedSearch.length >= 1,
  });

  const upsertShare = useMutation({
    mutationFn: ({
      userId,
      permission,
    }: {
      userId: number;
      permission: SharePermission;
    }) =>
      apiFetch<TaskShareResponse>(endpoints.taskShareUser(taskId, userId), {
        method: "PUT",
        body: { permission },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.shares(taskId) });
    },
  });

  const revokeShare = useMutation({
    mutationFn: (userId: number) =>
      apiFetch<string>(endpoints.taskShareUser(taskId, userId), {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.shares(taskId) });
    },
  });

  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-[12px] font-semibold text-ink-secondary">
          Collaborators
        </h3>
        {canManage && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setModalOpen(true)}
          >
            <UserPlus className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>Share</span>
          </Button>
        )}
      </div>

      {shares.length === 0 ? (
        <p className="rounded-[6px] border border-hairline bg-canvas px-3 py-2 text-[12px] text-ink-muted">
          Not shared with anyone yet.
        </p>
      ) : (
        <div className="divide-y divide-hairline rounded-[6px] border border-hairline bg-canvas">
          {shares.map((s) => (
            <div
              key={s.user_id}
              className="flex items-center justify-between px-3 py-2 text-[12px]"
            >
              <span className="font-mono text-ink-primary tabular-nums">
                {s.username ? `@${s.username}` : `User #${s.user_id}`}
              </span>
              <div className="flex items-center gap-2">
                {canManage ? (
                  <>
                    <select
                      aria-label={`Permission for user ${s.user_id}`}
                      value={s.permission.toLowerCase()}
                      onChange={(e) =>
                        upsertShare.mutate({
                          userId: s.user_id,
                          permission: e.target.value as SharePermission,
                        })
                      }
                      className="h-7 rounded-[4px] border border-hairline bg-surface px-1.5 text-[11px] text-ink-primary focus-ring"
                    >
                      <option value="view">view</option>
                      <option value="comment">comment</option>
                      <option value="edit">edit</option>
                    </select>
                    <button
                      type="button"
                      aria-label="Revoke access"
                      onClick={() => revokeShare.mutate(s.user_id)}
                      className="rounded-[4px] p-1 text-ink-muted hover:bg-subtle hover:text-danger cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  </>
                ) : (
                  <Badge variant="neutral">{s.permission.toLowerCase()}</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Share Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Share task</DialogTitle>
            <DialogDescription>
              Search by username or email to grant task access.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted"
                  strokeWidth={1.75}
                />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search user..."
                  className="h-9 pl-8 text-[13px]"
                />
              </div>
              <select
                aria-label="Default permission"
                value={selectedPerm}
                onChange={(e) =>
                  setSelectedPerm(e.target.value as SharePermission)
                }
                className="h-9 rounded-[6px] border border-hairline bg-subtle px-2.5 text-[12px] text-ink-primary focus-ring"
              >
                <option value="view">view</option>
                <option value="comment">comment</option>
                <option value="edit">edit</option>
              </select>
            </div>

            <div className="max-h-[240px] divide-y divide-hairline overflow-y-auto rounded-[6px] border border-hairline bg-canvas">
              {debouncedSearch.length === 0 ? (
                <p className="px-3 py-4 text-center text-[12px] text-ink-muted">
                  Type a username or email to search.
                </p>
              ) : users.length === 0 ? (
                <p className="px-3 py-4 text-center text-[12px] text-ink-muted">
                  No users found.
                </p>
              ) : (
                users.map((u) => {
                  const alreadyShared = shares.some(
                    (s) => s.user_id === u.user_id
                  );
                  return (
                    <div
                      key={u.user_id}
                      className="flex items-center justify-between px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-ink-primary">
                          @{u.username}
                        </p>
                        <p className="truncate text-[11px] text-ink-muted">
                          {u.email}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant={alreadyShared ? "ghost" : "primary"}
                        size="sm"
                        disabled={upsertShare.isPending}
                        onClick={() =>
                          upsertShare.mutate({
                            userId: u.user_id,
                            permission: selectedPerm,
                          })
                        }
                      >
                        {alreadyShared ? "Update" : "Invite"}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
