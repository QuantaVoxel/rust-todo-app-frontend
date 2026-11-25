"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Search, ShieldBan, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { formatDateTime } from "@/lib/utils/format";
import { useCurrentUser, useUserDirectory } from "@/features/tasks/queries";

export const connectionKeys = {
  all: ["connections"] as const,
  list: (status: ConnectionStatus) => ["connections", status] as const,
};

export function ConnectionsManager() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const userMap = useUserDirectory();
  const [activeTab, setActiveTab] = useState<ConnectionStatus>("accepted");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: connections = [], isLoading } = useQuery({
    queryKey: connectionKeys.list(activeTab),
    queryFn: () =>
      apiFetch<UserConnectionResponse[]>(endpoints.connections(activeTab)),
  });

  // Always keep pending connections fetched to show incoming request count badge
  const { data: pendingConnections = [] } = useQuery({
    queryKey: connectionKeys.list("pending"),
    queryFn: () =>
      apiFetch<UserConnectionResponse[]>(endpoints.connections("pending")),
  });

  const incomingPendingCount = pendingConnections.filter(
    (c) => me && c.user_id_2 === me.user_id
  ).length;

  const { data: users = [] } = useQuery({
    queryKey: ["users", "search", "connections", debouncedSearch],
    queryFn: () =>
      apiFetch<UserSearchResult[]>(endpoints.usersSearch(debouncedSearch)),
    enabled: debouncedSearch.length >= 1,
  });

  const sendRequest = useMutation({
    mutationFn: ({ targetUser }: { targetUser: UserSearchResult }) =>
      apiFetch<UserConnectionResponse>(endpoints.connections(), {
        method: "POST",
        body: { target_user_id: targetUser.user_id },
      }),
    onSuccess: (_, vars) => {
      setFeedback({
        type: "success",
        text: `Connection request sent to @${vars.targetUser.username}.`,
      });
      queryClient.invalidateQueries({ queryKey: connectionKeys.all });
    },
    onError: (err) => {
      setFeedback({
        type: "error",
        text:
          err instanceof ApiClientError
            ? err.message
            : "Failed to send connection request.",
      });
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
    onSuccess: (_, vars) => {
      setFeedback({
        type: "success",
        text:
          vars.status === "accepted"
            ? "Connection request accepted."
            : "User blocked.",
      });
      queryClient.invalidateQueries({ queryKey: connectionKeys.all });
    },
  });

  const deleteConnection = useMutation({
    mutationFn: (connectionId: number) =>
      apiFetch<string>(endpoints.connection(connectionId), {
        method: "DELETE",
      }),
    onSuccess: () => {
      setFeedback({ type: "success", text: "Connection removed." });
      queryClient.invalidateQueries({ queryKey: connectionKeys.all });
    },
  });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-hairline px-5">
        <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-ink-primary">
          Connections
        </h1>
        {feedback && (
          <span
            role="status"
            className={cn(
              "text-[12px] font-medium",
              feedback.type === "error" ? "text-danger" : "text-success"
            )}
          >
            {feedback.text}
          </span>
        )}
      </header>

      <div className="grid flex-1 min-h-0 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_340px]">
        {/* Left: Connections List */}
        <div className="flex min-h-0 flex-col overflow-hidden bg-surface">
          <div className="flex gap-6 border-b border-hairline px-5">
            {(["accepted", "pending", "blocked"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex items-center gap-2 border-b-2 py-2.5 text-[13px] font-medium capitalize transition-precision -mb-px cursor-pointer",
                  activeTab === tab
                    ? "border-accent text-ink-primary"
                    : "border-transparent text-ink-muted hover:text-ink-secondary"
                )}
              >
                <span>{tab}</span>
                {tab === "pending" && incomingPendingCount > 0 && (
                  <span className="rounded-[4px] bg-accent px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none text-white tabular-nums">
                    {incomingPendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-5 space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : connections.length === 0 ? (
              <p className="px-5 py-10 text-[13px] text-ink-muted">
                No {activeTab} connections.
              </p>
            ) : (
              <div className="divide-y divide-hairline">
                {connections.map((conn) => {
                  const isIncoming = conn.user_id_2 === me?.user_id;
                  const otherUserId =
                    conn.user_id_1 === me?.user_id
                      ? conn.user_id_2
                      : conn.user_id_1;
                  const otherUser = userMap.get(otherUserId);

                  return (
                    <div
                      key={conn.connection_id}
                      className="flex min-h-[52px] items-center justify-between gap-3 px-5 py-2.5"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2.5">
                          <span className="text-[13px] font-medium text-ink-primary">
                            {otherUser ? `@${otherUser.username}` : `User #${otherUserId}`}
                          </span>
                          {otherUser?.email && (
                            <span className="text-[12px] text-ink-secondary">
                              {otherUser.email}
                            </span>
                          )}
                          <span className="rounded-[4px] bg-subtle px-1.5 py-0.5 text-[11px] text-ink-muted">
                            {isIncoming ? "Incoming" : "Outgoing"}
                          </span>
                        </div>
                        {conn.created_at && (
                          <p className="font-mono text-[11px] text-ink-muted tabular-nums">
                            {formatDateTime(conn.created_at)}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {activeTab === "pending" && isIncoming && (
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
                            <Check className="h-3.5 w-3.5" strokeWidth={1.75} />
                            <span>Accept</span>
                          </Button>
                        )}
                        {activeTab !== "blocked" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={updateConnection.isPending}
                            onClick={() =>
                              updateConnection.mutate({
                                connectionId: conn.connection_id,
                                status: "blocked",
                              })
                            }
                            aria-label="Block user"
                            title="Block user"
                          >
                            <ShieldBan className="h-3.5 w-3.5" strokeWidth={1.75} />
                          </Button>
                        )}
                        <button
                          type="button"
                          aria-label={
                            activeTab === "pending" && !isIncoming
                              ? "Cancel request"
                              : "Remove connection"
                          }
                          title={
                            activeTab === "pending" && !isIncoming
                              ? "Cancel request"
                              : "Remove connection"
                          }
                          onClick={() =>
                            deleteConnection.mutate(conn.connection_id)
                          }
                          className="rounded-[4px] p-1.5 text-ink-muted hover:bg-subtle hover:text-danger cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Find Users */}
        <aside className="border-t border-hairline bg-canvas p-5 lg:border-l lg:border-t-0 overflow-y-auto">
          <div className="space-y-4">
            <div>
              <h2 className="text-[14px] font-semibold text-ink-primary">
                Add connection
              </h2>
              <p className="mt-1 text-[12px] text-ink-secondary">
                Search for teammates by username or email to connect.
              </p>
            </div>

            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted"
                strokeWidth={1.75}
              />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search username or email..."
                className="pl-8 text-[13px]"
              />
            </div>

            {debouncedSearch.length > 0 && (
              <div className="divide-y divide-hairline rounded-[6px] border border-hairline bg-surface">
                {users.length === 0 ? (
                  <p className="px-3 py-4 text-center text-[12px] text-ink-muted">
                    No matching users.
                  </p>
                ) : (
                  users.map((u) => (
                    <div
                      key={u.user_id}
                      className="flex items-center justify-between gap-2 px-3 py-2"
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
                        variant="secondary"
                        size="sm"
                        disabled={sendRequest.isPending}
                        onClick={() => sendRequest.mutate({ targetUser: u })}
                      >
                        <UserPlus className="h-3.5 w-3.5" strokeWidth={1.75} />
                        <span>Connect</span>
                      </Button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
