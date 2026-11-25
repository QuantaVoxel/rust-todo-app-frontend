"use client";

import { useState } from "react";
import Link from "next/link";
import * as Popover from "@radix-ui/react-popover";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Bell, Check, CheckCheck, Trash2 } from "lucide-react";
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
          align="start"
          sideOffset={8}
          className="z-50 w-[340px] rounded-[10px] border border-hairline bg-surface text-ink-primary focus:outline-none"
        >
          <div className="flex items-center justify-between border-b border-hairline px-3.5 py-2.5">
            <span className="text-[13px] font-semibold">Notifications</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllRead.mutate()}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline cursor-pointer"
                >
                  <CheckCheck className="h-3 w-3" strokeWidth={1.75} />
                  <span>Mark all read</span>
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[320px] divide-y divide-hairline overflow-y-auto">
            {isLoading ? (
              <div className="p-3 space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12px] text-ink-muted">
                All caught up. No notifications.
              </p>
            ) : (
              notifications.slice(0, 8).map((n) => (
                <div
                  key={n.notification_id}
                  className={cn(
                    "flex items-start justify-between gap-2.5 px-3.5 py-2.5 text-[12px]",
                    !n.is_read && "bg-accent-tint/40"
                  )}
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-ink-primary leading-snug">{n.message}</p>
                    <p className="font-mono text-[10px] text-ink-muted tabular-nums">
                      {n.notification_type} · {formatDateTime(n.created_at)}
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
                      onClick={() => deleteNotification.mutate(n.notification_id)}
                      className="rounded-[4px] p-1 text-ink-muted hover:bg-subtle hover:text-danger cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-hairline px-3.5 py-2 text-center">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-[12px] font-medium text-ink-secondary hover:text-ink-primary"
            >
              Open notification center
            </Link>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function NotificationsPageView() {
  const queryClient = useQueryClient();
  const { markRead } = useRealtime();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data: notifications = [], isLoading } = useNotificationsList(
    filter === "unread" ? false : undefined
  );

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
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-hairline px-6">
        <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-ink-primary">
          Notifications
        </h1>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => markAllRead.mutate()}
          disabled={markAllRead.isPending}
        >
          <CheckCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span>Mark all read</span>
        </Button>
      </header>

      <div className="flex gap-4 border-b border-hairline px-6">
        {(["all", "unread"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={cn(
              "border-b-2 py-2.5 text-[13px] font-medium capitalize -mb-px cursor-pointer",
              filter === tab
                ? "border-accent text-ink-primary"
                : "border-transparent text-ink-muted hover:text-ink-secondary"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-6 space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : notifications.length === 0 ? (
          <p className="px-6 py-10 text-[13px] text-ink-muted">
            No notifications in this view.
          </p>
        ) : (
          <div className="divide-y divide-hairline">
            {notifications.map((n) => (
              <div
                key={n.notification_id}
                className={cn(
                  "flex items-center justify-between gap-4 px-6 py-3.5",
                  !n.is_read && "bg-accent-tint/30"
                )}
              >
                <div className="space-y-0.5">
                  <p className="text-[13px] font-medium text-ink-primary">
                    {n.message}
                  </p>
                  <p className="font-mono text-[11px] text-ink-muted tabular-nums">
                    {n.notification_type} · {formatDateTime(n.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {!n.is_read && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => markRead(n.notification_id)}
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={1.75} />
                      <span>Read</span>
                    </Button>
                  )}
                  <button
                    type="button"
                    aria-label="Delete notification"
                    onClick={() => deleteNotification.mutate(n.notification_id)}
                    className="rounded-[4px] p-1.5 text-ink-muted hover:bg-subtle hover:text-danger cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
