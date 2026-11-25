"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, parseISO } from "date-fns";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Check,
  Loader2,
  MoreHorizontal,
  Search,
  ShieldBan,
  Trash2,
  UserPlus,
  Users,
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type {
  ConnectionStatus,
  UserConnectionResponse,
  UserSearchResult,
} from "@/lib/api/types";
import { cn } from "@/lib/utils/cn";
import { useCurrentUser, useUserDirectory } from "@/features/tasks/queries";

export const connectionKeys = {
  all: ["connections"] as const,
  list: (status?: ConnectionStatus) =>
    ["connections", status ?? "all"] as const,
};

function parseStatusTab(raw: string | null): ConnectionStatus {
  if (raw === "pending" || raw === "blocked" || raw === "accepted") return raw;
  return "accepted";
}

function formatRelativeTime(iso?: string): string {
  if (!iso) return "";
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

export function ConnectionsManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const shouldReduceMotion = useReducedMotion();

  const activeTab = parseStatusTab(searchParams.get("status"));
  const { data: me } = useCurrentUser();
  const userMap = useUserDirectory();

  const [findOpen, setFindOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sendingToUserId, setSendingToUserId] = useState<number | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [confirmAction, setConfirmAction] = useState<{
    type: "block" | "remove" | "decline" | "unblock";
    connectionId: number;
    displayName: string;
  } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Fetch all connections for status-aware search & tab counts
  const { data: allConnections = [], isLoading } = useQuery({
    queryKey: connectionKeys.list(),
    queryFn: () => apiFetch<UserConnectionResponse[]>(endpoints.connections()),
  });

  const { data: searchResults = [], isFetching: isSearching } = useQuery({
    queryKey: ["users", "search", "connections", debouncedSearch],
    queryFn: () =>
      apiFetch<UserSearchResult[]>(endpoints.usersSearch(debouncedSearch)),
    enabled: findOpen && debouncedSearch.length >= 2,
  });

  const switchTab = (status: ConnectionStatus) => {
    router.replace(`/connections?status=${status}`);
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: connectionKeys.all });
    queryClient.invalidateQueries({ queryKey: ["users"] });
  };

  const sendRequest = useMutation({
    mutationFn: (targetUserId: number) => {
      setSendingToUserId(targetUserId);
      setSearchError(null);
      return apiFetch<UserConnectionResponse>(endpoints.connections(), {
        method: "POST",
        body: { target_user_id: targetUserId },
      });
    },
    onSuccess: () => {
      invalidateAll();
    },
    onError: (err) => {
      setSearchError(
        err instanceof ApiClientError
          ? err.message
          : "Could not send connection request."
      );
    },
    onSettled: () => {
      setSendingToUserId(null);
    },
  });

  const updateConnection = useMutation({
    mutationFn: ({
      connectionId,
      status,
    }: {
      connectionId: number;
      status: "accepted" | "blocked";
    }) =>
      apiFetch<UserConnectionResponse>(endpoints.connection(connectionId), {
        method: "PATCH",
        body: { status },
      }),
    onSuccess: () => {
      setConfirmAction(null);
      invalidateAll();
    },
  });

  const deleteConnection = useMutation({
    mutationFn: (connectionId: number) =>
      apiFetch<string>(endpoints.connection(connectionId), {
        method: "DELETE",
      }),
    onSuccess: () => {
      setConfirmAction(null);
      invalidateAll();
    },
  });

  const acceptedList = useMemo(
    () =>
      allConnections.filter((c) => c.status.toLowerCase() === "accepted"),
    [allConnections]
  );

  const pendingList = useMemo(
    () => allConnections.filter((c) => c.status.toLowerCase() === "pending"),
    [allConnections]
  );

  const incomingPending = useMemo(
    () => pendingList.filter((c) => me && c.user_id_2 === me.user_id),
    [pendingList, me]
  );

  const outgoingPending = useMemo(
    () => pendingList.filter((c) => me && c.user_id_1 === me.user_id),
    [pendingList, me]
  );

  const blockedList = useMemo(
    () => allConnections.filter((c) => c.status.toLowerCase() === "blocked"),
    [allConnections]
  );

  const getOtherUser = (conn: UserConnectionResponse) => {
    const otherId =
      conn.user_id_1 === me?.user_id ? conn.user_id_2 : conn.user_id_1;
    const info = userMap.get(otherId);
    const username = info?.username ?? `user_${otherId}`;
    return {
      userId: otherId,
      username,
      email: info?.email ?? "",
      initials: username.slice(0, 2).toUpperCase(),
    };
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Page Header */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-hairline px-6 py-4">
        <div>
          <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-ink-primary">
            Connections
          </h1>
          <p className="mt-0.5 text-[13px] text-ink-secondary">
            Manage collaborators and people you share tasks with.
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={() => {
            setSearchError(null);
            setFindOpen(true);
          }}
        >
          <UserPlus className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span>Find People</span>
        </Button>
      </header>

      {/* Segmented Status Tabs (`layoutId`) */}
      <div className="flex shrink-0 items-center justify-between border-b border-hairline bg-canvas/40 px-6 py-2.5">
        <div
          role="tablist"
          aria-label="Connection status"
          className="flex items-center gap-1 rounded-[8px] border border-hairline bg-canvas p-1"
        >
          {(
            [
              {
                id: "accepted",
                label: "Accepted",
                count: acceptedList.length,
                highlight: false,
              },
              {
                id: "pending",
                label: "Pending",
                count: incomingPending.length,
                highlight: incomingPending.length > 0,
              },
              {
                id: "blocked",
                label: "Blocked",
                count: blockedList.length,
                highlight: false,
              },
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
                    layoutId="connections-tab"
                    transition={
                      shouldReduceMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 460, damping: 34 }
                    }
                    className="absolute inset-0 -z-10 rounded-[6px] border border-hairline bg-surface"
                  />
                )}
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className={cn(
                      "rounded-[4px] px-1.5 py-0.5 font-mono text-[10px] leading-none tabular-nums",
                      tab.highlight
                        ? "bg-accent text-white font-semibold"
                        : "bg-subtle text-ink-muted"
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Connections List Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-4xl space-y-6">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : activeTab === "accepted" ? (
            acceptedList.length === 0 ? (
              <EmptyConnections
                title="No connections yet"
                description="Connect with teammates to collaborate and share tasks."
                actionLabel="Find People"
                onAction={() => setFindOpen(true)}
              />
            ) : (
              <div className="divide-y divide-hairline rounded-[8px] border border-hairline bg-canvas">
                <AnimatePresence mode="popLayout">
                  {acceptedList.map((conn) => {
                    const other = getOtherUser(conn);
                    const relTime = formatRelativeTime(conn.created_at);
                    return (
                      <motion.div
                        key={conn.connection_id}
                        layout={!shouldReduceMotion}
                        initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={shouldReduceMotion ? undefined : { opacity: 0 }}
                        transition={{ duration: 0.16 }}
                        className="flex min-h-[60px] items-center justify-between gap-4 px-4 py-3"
                      >
                        <UserIdentityCell
                          initials={other.initials}
                          username={other.username}
                          email={other.email}
                          meta={relTime ? `Connected ${relTime}` : undefined}
                        />

                        <div className="flex items-center gap-2">
                          <Badge variant="success">Connected</Badge>
                          <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Actions for @${other.username}`}
                              >
                                <MoreHorizontal
                                  className="h-4 w-4"
                                  strokeWidth={1.75}
                                />
                              </Button>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                              <DropdownMenu.Content
                                align="end"
                                sideOffset={6}
                                className="z-50 w-44 rounded-[8px] border border-hairline bg-surface p-1 text-[12px] text-ink-primary"
                              >
                                <DropdownMenu.Item
                                  onSelect={() =>
                                    setConfirmAction({
                                      type: "block",
                                      connectionId: conn.connection_id,
                                      displayName: `@${other.username}`,
                                    })
                                  }
                                  className="flex items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-ink-secondary hover:bg-subtle hover:text-ink-primary cursor-pointer focus:outline-none"
                                >
                                  <ShieldBan
                                    className="h-3.5 w-3.5"
                                    strokeWidth={1.75}
                                  />
                                  <span>Block User</span>
                                </DropdownMenu.Item>
                                <DropdownMenu.Item
                                  onSelect={() =>
                                    setConfirmAction({
                                      type: "remove",
                                      connectionId: conn.connection_id,
                                      displayName: `@${other.username}`,
                                    })
                                  }
                                  className="flex items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-danger hover:bg-danger-tint cursor-pointer focus:outline-none"
                                >
                                  <Trash2
                                    className="h-3.5 w-3.5"
                                    strokeWidth={1.75}
                                  />
                                  <span>Remove Connection</span>
                                </DropdownMenu.Item>
                              </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                          </DropdownMenu.Root>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )
          ) : activeTab === "pending" ? (
            pendingList.length === 0 ? (
              <EmptyConnections
                title="All caught up"
                description="You have no pending incoming or outgoing connection requests."
              />
            ) : (
              <div className="space-y-6">
                {/* Incoming Requests */}
                {incomingPending.length > 0 && (
                  <section className="space-y-2">
                    <h2 className="text-[12px] font-semibold text-ink-secondary">
                      Incoming Requests ({incomingPending.length})
                    </h2>
                    <div className="divide-y divide-hairline rounded-[8px] border border-hairline bg-canvas">
                      <AnimatePresence mode="popLayout">
                        {incomingPending.map((conn) => {
                          const other = getOtherUser(conn);
                          const relTime = formatRelativeTime(conn.created_at);
                          return (
                            <motion.div
                              key={conn.connection_id}
                              layout={!shouldReduceMotion}
                              initial={
                                shouldReduceMotion ? false : { opacity: 0, y: 4 }
                              }
                              animate={{ opacity: 1, y: 0 }}
                              exit={
                                shouldReduceMotion ? undefined : { opacity: 0 }
                              }
                              transition={{ duration: 0.16 }}
                              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                            >
                              <UserIdentityCell
                                initials={other.initials}
                                username={other.username}
                                email={other.email}
                                meta={
                                  relTime ? `Requested ${relTime}` : undefined
                                }
                              />

                              <div className="flex items-center gap-1.5">
                                <Button
                                  type="button"
                                  variant="primary"
                                  size="sm"
                                  disabled={updateConnection.isPending}
                                  onClick={() =>
                                    updateConnection.mutate({
                                      connectionId: conn.connection_id,
                                      status: "accepted",
                                    })
                                  }
                                >
                                  <Check
                                    className="h-3.5 w-3.5"
                                    strokeWidth={1.75}
                                  />
                                  <span>Accept</span>
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() =>
                                    setConfirmAction({
                                      type: "decline",
                                      connectionId: conn.connection_id,
                                      displayName: `@${other.username}`,
                                    })
                                  }
                                >
                                  Decline
                                </Button>
                                <DropdownMenu.Root>
                                  <DropdownMenu.Trigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      aria-label={`More options for @${other.username}`}
                                    >
                                      <MoreHorizontal
                                        className="h-4 w-4"
                                        strokeWidth={1.75}
                                      />
                                    </Button>
                                  </DropdownMenu.Trigger>
                                  <DropdownMenu.Portal>
                                    <DropdownMenu.Content
                                      align="end"
                                      sideOffset={6}
                                      className="z-50 w-40 rounded-[8px] border border-hairline bg-surface p-1 text-[12px] text-ink-primary"
                                    >
                                      <DropdownMenu.Item
                                        onSelect={() =>
                                          setConfirmAction({
                                            type: "block",
                                            connectionId: conn.connection_id,
                                            displayName: `@${other.username}`,
                                          })
                                        }
                                        className="flex items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-danger hover:bg-danger-tint cursor-pointer focus:outline-none"
                                      >
                                        <ShieldBan
                                          className="h-3.5 w-3.5"
                                          strokeWidth={1.75}
                                        />
                                        <span>Block User</span>
                                      </DropdownMenu.Item>
                                    </DropdownMenu.Content>
                                  </DropdownMenu.Portal>
                                </DropdownMenu.Root>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  </section>
                )}

                {/* Sent Requests */}
                {outgoingPending.length > 0 && (
                  <section className="space-y-2">
                    <h2 className="text-[12px] font-semibold text-ink-secondary">
                      Sent Requests ({outgoingPending.length})
                    </h2>
                    <div className="divide-y divide-hairline rounded-[8px] border border-hairline bg-canvas">
                      <AnimatePresence mode="popLayout">
                        {outgoingPending.map((conn) => {
                          const other = getOtherUser(conn);
                          const relTime = formatRelativeTime(conn.created_at);
                          return (
                            <motion.div
                              key={conn.connection_id}
                              layout={!shouldReduceMotion}
                              initial={
                                shouldReduceMotion ? false : { opacity: 0, y: 4 }
                              }
                              animate={{ opacity: 1, y: 0 }}
                              exit={
                                shouldReduceMotion ? undefined : { opacity: 0 }
                              }
                              transition={{ duration: 0.16 }}
                              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                            >
                              <UserIdentityCell
                                initials={other.initials}
                                username={other.username}
                                email={other.email}
                                meta={relTime ? `Sent ${relTime}` : undefined}
                              />

                              <div className="flex items-center gap-2">
                                <Badge variant="neutral">
                                  Awaiting response
                                </Badge>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setConfirmAction({
                                      type: "remove",
                                      connectionId: conn.connection_id,
                                      displayName: `@${other.username}`,
                                    })
                                  }
                                >
                                  Cancel
                                </Button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  </section>
                )}
              </div>
            )
          ) : blockedList.length === 0 ? (
            <EmptyConnections
              title="No blocked users"
              description="Users you block will appear here."
            />
          ) : (
            <div className="divide-y divide-hairline rounded-[8px] border border-hairline bg-canvas">
              <AnimatePresence mode="popLayout">
                {blockedList.map((conn) => {
                  const other = getOtherUser(conn);
                  return (
                    <motion.div
                      key={conn.connection_id}
                      layout={!shouldReduceMotion}
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={shouldReduceMotion ? undefined : { opacity: 0 }}
                      transition={{ duration: 0.16 }}
                      className="flex min-h-[60px] items-center justify-between gap-4 px-4 py-3"
                    >
                      <UserIdentityCell
                        initials={other.initials}
                        username={other.username}
                        email={other.email}
                      />

                      <div className="flex items-center gap-2">
                        <Badge variant="danger">Blocked</Badge>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            setConfirmAction({
                              type: "unblock",
                              connectionId: conn.connection_id,
                              displayName: `@${other.username}`,
                            })
                          }
                        >
                          Unblock
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Find People Dialog (Status-Aware Search) */}
      <Dialog open={findOpen} onOpenChange={setFindOpen}>
        <DialogContent className="max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Find People</DialogTitle>
            <DialogDescription>
              Search by username or email (minimum 2 characters) to connect.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted"
                strokeWidth={1.75}
              />
              <Input
                autoFocus
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setSearchError(null);
                }}
                placeholder="Type username or email..."
                className="pl-8 text-[13px]"
              />
            </div>

            {searchError && (
              <p className="text-[12px] text-danger">{searchError}</p>
            )}

            <div className="max-h-[280px] divide-y divide-hairline overflow-y-auto rounded-[6px] border border-hairline bg-canvas">
              {debouncedSearch.length < 2 ? (
                <p className="px-4 py-6 text-center text-[12px] text-ink-muted">
                  Enter at least 2 characters to search users.
                </p>
              ) : isSearching ? (
                <div className="p-3 space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : searchResults.length === 0 ? (
                <p className="px-4 py-6 text-center text-[12px] text-ink-muted">
                  No matching users found.
                </p>
              ) : (
                searchResults.map((u) => {
                  const existing = allConnections.find(
                    (c) =>
                      (c.user_id_1 === u.user_id &&
                        c.user_id_2 === me?.user_id) ||
                      (c.user_id_2 === u.user_id && c.user_id_1 === me?.user_id)
                  );
                  const status = existing?.status.toLowerCase();
                  const isIncoming =
                    existing && me && existing.user_id_2 === me.user_id;
                  const isSending = sendingToUserId === u.user_id;

                  return (
                    <div
                      key={u.user_id}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                    >
                      <UserIdentityCell
                        initials={u.username.slice(0, 2).toUpperCase()}
                        username={u.username}
                        email={u.email}
                      />

                      {status === "accepted" ? (
                        <Badge variant="success">Connected</Badge>
                      ) : status === "blocked" ? (
                        <Badge variant="danger">Blocked</Badge>
                      ) : status === "pending" && isIncoming && existing ? (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          disabled={updateConnection.isPending}
                          onClick={() =>
                            updateConnection.mutate({
                              connectionId: existing.connection_id,
                              status: "accepted",
                            })
                          }
                        >
                          Accept
                        </Button>
                      ) : status === "pending" ? (
                        <Badge variant="neutral">Request Sent</Badge>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={isSending}
                          onClick={() => sendRequest.mutate(u.user_id)}
                        >
                          {isSending && (
                            <Loader2
                              className="h-3 w-3 animate-spin"
                              strokeWidth={1.75}
                            />
                          )}
                          <span>{isSending ? "Sending" : "Connect"}</span>
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Destructive Action Confirmation Dialog */}
      <Dialog
        open={Boolean(confirmAction)}
        onOpenChange={(o) => !o && setConfirmAction(null)}
      >
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.type === "block"
                ? `Block ${confirmAction.displayName}?`
                : confirmAction?.type === "decline"
                  ? `Decline request from ${confirmAction.displayName}?`
                  : confirmAction?.type === "unblock"
                    ? `Unblock ${confirmAction.displayName}?`
                    : `Remove ${confirmAction?.displayName}?`}
            </DialogTitle>
            <DialogDescription>
              {confirmAction?.type === "block"
                ? "They will no longer be able to send you connection requests."
                : confirmAction?.type === "unblock"
                  ? "This removes the block record so you can connect again later."
                  : "This removes the connection between your accounts."}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmAction(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={
                confirmAction?.type === "unblock" ? "primary" : "danger"
              }
              disabled={updateConnection.isPending || deleteConnection.isPending}
              onClick={() => {
                if (!confirmAction) return;
                if (confirmAction.type === "block") {
                  updateConnection.mutate({
                    connectionId: confirmAction.connectionId,
                    status: "blocked",
                  });
                } else {
                  deleteConnection.mutate(confirmAction.connectionId);
                }
              }}
            >
              {confirmAction?.type === "block"
                ? "Block user"
                : confirmAction?.type === "decline"
                  ? "Decline"
                  : confirmAction?.type === "unblock"
                    ? "Unblock"
                    : "Remove"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UserIdentityCell({
  initials,
  username,
  email,
  meta,
}: {
  initials: string;
  username: string;
  email?: string;
  meta?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface font-mono text-[11px] font-semibold text-ink-primary">
        {initials}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] font-medium text-ink-primary">
            @{username}
          </span>
          {meta && (
            <span className="hidden sm:inline font-mono text-[11px] text-ink-muted tabular-nums">
              {meta}
            </span>
          )}
        </div>
        {email && (
          <p className="truncate text-[12px] text-ink-secondary">{email}</p>
        )}
      </div>
    </div>
  );
}

function EmptyConnections({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[8px] border border-hairline bg-canvas px-6 py-12 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[8px] border border-hairline bg-subtle text-ink-muted">
        <Users className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <p className="text-[14px] font-medium text-ink-primary">{title}</p>
      <p className="mt-1 max-w-sm text-[13px] text-ink-secondary">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="mt-4"
          onClick={onAction}
        >
          <UserPlus className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span>{actionLabel}</span>
        </Button>
      )}
    </div>
  );
}
