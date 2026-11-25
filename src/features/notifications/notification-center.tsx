"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  formatDistanceToNow,
  isToday,
  isYesterday,
  parseISO,
} from "date-fns";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Bell,
  Check,
  CheckCheck,
  Info,
  MessageSquare,
  Share2,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type {
  NotificationResponse,
  UnreadCountResponse,
} from "@/lib/api/types";
import { cn } from "@/lib/utils/cn";
import { formatDateTime } from "@/lib/utils/format";
import { notificationKeys, useRealtime } from "./realtime-provider";

type ReadFilterTab = "all" | "unread" | "read";
type TypeFilter = "all" | "reminder" | "comment" | "share" | "system";

function parseReadFilter(raw: string | null): ReadFilterTab {
  if (raw === "false") return "unread";
  if (raw === "true") return "read";
  return "all";
}

function getTypeIcon(type: string) {
  const normalized = type.toLowerCase();
  if (normalized === "reminder") return Bell;
  if (normalized === "comment") return MessageSquare;
  if (normalized === "share") return Share2;
  return Info;
}

function formatRelative(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: () =>
      apiFetch<UnreadCountResponse>(endpoints.notificationsUnreadCount()),
    staleTime: 60 * 1000,
  });
}

export function useNotificationsList(isRead?: boolean) {
  return useQuery({
    queryKey: notificationKeys.list(isRead),
    queryFn: () =>
      apiFetch<NotificationResponse[]>(endpoints.notifications(isRead)),
  });
}

export function NotificationBell() {
  const queryClient = useQueryClient();
  const { markRead } = useRealtime();
  const shouldReduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);

  const { data: unreadData } = useUnreadCount();
  const { data: notifications = [], isLoading } = useNotificationsList();
  const unreadCount = unreadData?.unread_count ?? 0;

  const markAllRead = useMutation({
    mutationFn: () =>
      apiFetch<string>(endpoints.notificationsReadAll(), { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      queryClient.setQueryData<UnreadCountResponse>(
        notificationKeys.unreadCount,
        { unread_count: 0 }
      );
    },
  });

  const deleteNotification = useMutation({
    mutationFn: (id: number) =>
      apiFetch<string>(endpoints.notification(id), { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-8 w-8 items-center justify-center rounded-[6px] border border-hairline bg-canvas text-ink-secondary hover:border-strong hover:text-ink-primary transition-precision focus-ring cursor-pointer"
        >
          <Bell className="h-4 w-4" strokeWidth={1.75} />
          <AnimatePresence mode="popLayout">
            {unreadCount > 0 && (
              <motion.span
                key={unreadCount}
                initial={shouldReduceMotion ? false : { scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={shouldReduceMotion ? undefined : { scale: 0.6, opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 28 }}
                className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[10px] font-semibold leading-none text-white tabular-nums"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[360px] rounded-[10px] border border-hairline bg-surface text-ink-primary focus:outline-none"
        >
          <div className="flex items-center justify-between border-b border-hairline px-3.5 py-2.5">
            <span className="text-[13px] font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline cursor-pointer"
              >
                <CheckCheck className="h-3 w-3" strokeWidth={1.75} />
                <span>Mark all as read</span>
              </button>
            )}
          </div>

          <div className="max-h-[340px] divide-y divide-hairline overflow-y-auto">
            {isLoading ? (
              <div className="p-3 space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12px] text-ink-muted">
                You&apos;re all caught up.
              </p>
            ) : (
              notifications.slice(0, 8).map((n) => {
                const TypeIcon = getTypeIcon(n.notification_type);
                const normalizedType = n.notification_type.toLowerCase();

                return (
                  <div
                    key={n.notification_id}
                    className={cn(
                      "flex items-start gap-2.5 px-3.5 py-2.5 text-[12px]",
                      !n.is_read && "bg-accent-tint/35"
                    )}
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] border border-hairline bg-canvas text-ink-secondary">
                      <TypeIcon className="h-3 w-3" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p
                        className={cn(
                          "leading-snug",
                          !n.is_read
                            ? "font-medium text-ink-primary"
                            : "text-ink-secondary"
                        )}
                      >
                        {n.message}
                      </p>
                      <p
                        title={formatDateTime(n.created_at)}
                        className="font-mono text-[10px] capitalize text-ink-muted tabular-nums"
                      >
                        {normalizedType} · {formatRelative(n.created_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      {!n.is_read && (
                        <button
                          type="button"
                          aria-label="Mark as read"
                          onClick={() => markRead(n.notification_id)}
                          className="rounded-[4px] p-1 text-ink-muted hover:bg-subtle hover:text-ink-primary cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5" strokeWidth={1.75} />
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label="Delete notification"
                        onClick={() =>
                          deleteNotification.mutate(n.notification_id)
                        }
                        className="rounded-[4px] p-1 text-ink-muted hover:bg-subtle hover:text-danger cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-hairline px-3.5 py-2 text-center">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-[12px] font-medium text-ink-secondary hover:text-ink-primary"
            >
              View all notifications
            </Link>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function NotificationsPageView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const shouldReduceMotion = useReducedMotion();
  const { status: realtimeStatus, markRead } = useRealtime();

  const readTab = parseReadFilter(searchParams.get("is_read"));
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const isReadQuery =
    readTab === "unread" ? false : readTab === "read" ? true : undefined;

  const { data: notifications = [], isLoading } =
    useNotificationsList(isReadQuery);
  const { data: unreadData } = useUnreadCount();
  const unreadCount = unreadData?.unread_count ?? 0;

  const switchReadTab = (tab: ReadFilterTab) => {
    setFocusedIndex(-1);
    if (tab === "all") {
      router.replace("/notifications");
    } else if (tab === "unread") {
      router.replace("/notifications?is_read=false");
    } else {
      router.replace("/notifications?is_read=true");
    }
  };

  const markAllRead = useMutation({
    mutationFn: () =>
      apiFetch<string>(endpoints.notificationsReadAll(), { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      queryClient.setQueryData<UnreadCountResponse>(
        notificationKeys.unreadCount,
        { unread_count: 0 }
      );
    },
  });

  const deleteNotification = useMutation({
    mutationFn: (id: number) =>
      apiFetch<string>(endpoints.notification(id), { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });

  const filtered = useMemo(() => {
    if (typeFilter === "all") return notifications;
    return notifications.filter(
      (n) => n.notification_type.toLowerCase() === typeFilter
    );
  }, [notifications, typeFilter]);

  const grouped = useMemo(() => {
    const today: NotificationResponse[] = [];
    const yesterday: NotificationResponse[] = [];
    const earlier: NotificationResponse[] = [];

    for (const item of filtered) {
      try {
        const dt = parseISO(item.created_at);
        if (isToday(dt)) {
          today.push(item);
        } else if (isYesterday(dt)) {
          yesterday.push(item);
        } else {
          earlier.push(item);
        }
      } catch {
        earlier.push(item);
      }
    }

    return [
      { label: "Today", items: today },
      { label: "Yesterday", items: yesterday },
      { label: "Earlier", items: earlier },
    ].filter((g) => g.items.length > 0);
  }, [filtered]);

  // Keyboard navigation: J/K to move, E/Enter to mark read
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;
      if (isEditable || filtered.length === 0) return;

      if (e.key === "ArrowDown" || e.key.toLowerCase() === "j") {
        e.preventDefault();
        setFocusedIndex((idx) => Math.min(filtered.length - 1, idx + 1));
      } else if (e.key === "ArrowUp" || e.key.toLowerCase() === "k") {
        e.preventDefault();
        setFocusedIndex((idx) => Math.max(0, idx - 1));
      } else if (
        (e.key.toLowerCase() === "e" || e.key === "Enter") &&
        focusedIndex >= 0 &&
        filtered[focusedIndex] &&
        !filtered[focusedIndex].is_read
      ) {
        e.preventDefault();
        markRead(filtered[focusedIndex].notification_id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filtered, focusedIndex, markRead]);

  const livePillText =
    realtimeStatus === "ws"
      ? "Live · WebSocket"
      : realtimeStatus === "sse"
        ? "Live · SSE"
        : "Reconnecting...";
  const isLive = realtimeStatus === "ws" || realtimeStatus === "sse";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Page Header */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-hairline px-6 py-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-3">
            <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-ink-primary">
              Notifications
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-[6px] border border-hairline bg-canvas px-2 py-0.5 font-mono text-[11px] text-ink-secondary">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  isLive ? "bg-success" : "bg-warning animate-pulse"
                )}
              />
              <span>{livePillText}</span>
            </span>
          </div>
          <p className="text-[13px] text-ink-secondary">
            Reminders, task shares, comments, and system updates in real time.
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => markAllRead.mutate()}
          disabled={unreadCount === 0 || markAllRead.isPending}
        >
          <CheckCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span>Mark all as read</span>
        </Button>
      </header>

      {/* 2-Dimensional Filter Bar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-hairline bg-canvas/50 px-6 py-2.5">
        {/* Read Status Segmented Tabs (`layoutId`) */}
        <div
          role="tablist"
          aria-label="Notification read status"
          className="flex items-center gap-1 rounded-[8px] border border-hairline bg-canvas p-1"
        >
          {(
            [
              { id: "all", label: "All" },
              { id: "unread", label: "Unread", count: unreadCount },
              { id: "read", label: "Read" },
            ] as const
          ).map((tab) => {
            const active = readTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => switchReadTab(tab.id)}
                className={cn(
                  "relative z-10 flex h-7 items-center gap-1.5 rounded-[6px] px-2.5 text-[12px] font-medium transition-precision cursor-pointer focus-ring",
                  active
                    ? "text-ink-primary"
                    : "text-ink-muted hover:text-ink-secondary"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="notifications-tab"
                    transition={
                      shouldReduceMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 460, damping: 34 }
                    }
                    className="absolute inset-0 -z-10 rounded-[6px] border border-hairline bg-surface"
                  />
                )}
                <span>{tab.label}</span>
                {"count" in tab && tab.count > 0 && (
                  <span className="rounded-[4px] bg-accent px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none text-white tabular-nums">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Type Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: "all", label: "All types" },
              { id: "reminder", label: "Reminder" },
              { id: "comment", label: "Comment" },
              { id: "share", label: "Share" },
              { id: "system", label: "System" },
            ] as const
          ).map((chip) => {
            const active = typeFilter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => {
                  setTypeFilter(chip.id);
                  setFocusedIndex(-1);
                }}
                className={cn(
                  "rounded-[6px] border px-2.5 py-1 text-[12px] font-medium transition-precision cursor-pointer",
                  active
                    ? "border-strong bg-surface text-ink-primary"
                    : "border-hairline bg-canvas text-ink-muted hover:text-ink-secondary"
                )}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chronological Grouped Inbox */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-4xl space-y-6">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[8px] border border-hairline bg-canvas px-6 py-12 text-center">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[8px] border border-hairline bg-subtle text-ink-muted">
                <Bell className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <p className="text-[14px] font-medium text-ink-primary">
                {typeFilter !== "all"
                  ? `No ${typeFilter} notifications`
                  : readTab === "unread"
                    ? "You're all caught up"
                    : "No notifications yet"}
              </p>
              <p className="mt-1 text-[13px] text-ink-secondary">
                {typeFilter !== "all"
                  ? "Reset the type filter to view all notifications."
                  : "New reminders, shares, and comments will appear here live."}
              </p>
              {typeFilter !== "all" && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-4"
                  onClick={() => setTypeFilter("all")}
                >
                  Reset filter
                </Button>
              )}
            </div>
          ) : (
            grouped.map((group) => (
              <section key={group.label} className="space-y-2">
                <h2 className="text-[12px] font-semibold text-ink-secondary">
                  {group.label}
                </h2>
                <div className="divide-y divide-hairline rounded-[8px] border border-hairline bg-canvas">
                  <AnimatePresence mode="popLayout">
                    {group.items.map((n) => {
                      const flatIndex = filtered.findIndex(
                        (item) => item.notification_id === n.notification_id
                      );
                      const isFocused = focusedIndex === flatIndex;
                      const TypeIcon = getTypeIcon(n.notification_type);
                      const normalizedType = n.notification_type.toLowerCase();

                      return (
                        <motion.div
                          key={n.notification_id}
                          layout={!shouldReduceMotion}
                          initial={
                            shouldReduceMotion ? false : { opacity: 0, y: 4 }
                          }
                          animate={{ opacity: 1, y: 0 }}
                          exit={shouldReduceMotion ? undefined : { opacity: 0 }}
                          transition={{ duration: 0.16 }}
                          onClick={() => setFocusedIndex(flatIndex)}
                          className={cn(
                            "group flex items-start justify-between gap-4 px-4 py-3 transition-precision",
                            !n.is_read
                              ? "bg-surface"
                              : "bg-canvas hover:bg-subtle/40",
                            isFocused && "ring-1 ring-inset ring-accent"
                          )}
                        >
                          <div className="flex min-w-0 items-start gap-3">
                            {/* Unread 6px Accent Dot */}
                            <div className="mt-2.5 flex w-2 shrink-0 justify-center">
                              {!n.is_read && (
                                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                              )}
                            </div>

                            {/* Semantic Monochrome Icon */}
                            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] border border-hairline bg-subtle text-ink-secondary">
                              <TypeIcon
                                className="h-3.5 w-3.5"
                                strokeWidth={1.75}
                              />
                            </span>

                            <div className="min-w-0 space-y-1">
                              <p
                                className={cn(
                                  "text-[13px] leading-snug",
                                  !n.is_read
                                    ? "font-medium text-ink-primary"
                                    : "text-ink-secondary"
                                )}
                              >
                                {n.message}
                              </p>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="neutral" className="capitalize">
                                  {normalizedType}
                                </Badge>
                                <span
                                  title={formatDateTime(n.created_at)}
                                  className="font-mono text-[11px] text-ink-muted tabular-nums"
                                >
                                  {formatRelative(n.created_at)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-precision">
                            {!n.is_read && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markRead(n.notification_id);
                                }}
                                title="Mark as read (E)"
                              >
                                <Check
                                  className="h-3.5 w-3.5"
                                  strokeWidth={1.75}
                                />
                                <span>Read</span>
                              </Button>
                            )}
                            <button
                              type="button"
                              aria-label="Delete notification"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification.mutate(n.notification_id);
                              }}
                              className="rounded-[4px] p-1.5 text-ink-muted hover:bg-danger-tint hover:text-danger cursor-pointer"
                            >
                              <Trash2
                                className="h-3.5 w-3.5"
                                strokeWidth={1.75}
                              />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
