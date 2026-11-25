"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Bell, X } from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type {
  NotificationResponse,
  RealtimeNotificationEvent,
  UnreadCountResponse,
} from "@/lib/api/types";
import { taskKeys } from "@/features/tasks/queries";

export type RealtimeStatus = "connecting" | "ws" | "sse" | "reconnecting";

interface ToastItem {
  id: number;
  message: string;
  type: string;
}

interface RealtimeContextValue {
  status: RealtimeStatus;
  markRead: (notificationId: number) => Promise<void>;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  status: "connecting",
  markRead: async () => {},
});

export function useRealtime() {
  return useContext(RealtimeContext);
}

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (isRead?: boolean) =>
    [
      "notifications",
      "list",
      isRead === undefined ? "all" : isRead ? "read" : "unread",
    ] as const,
  unreadCount: ["notifications", "unread-count"] as const,
};

const WS_BASE_URL =
  process.env.NEXT_PUBLIC_WS_BASE_URL ?? "ws://localhost:8080";
const ASSET_BASE_URL =
  process.env.NEXT_PUBLIC_ASSET_BASE_URL ?? "http://localhost:8080";

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const shouldReduceMotion = useReducedMotion();
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const [toast, setToast] = useState<ToastItem | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const wsFailuresRef = useRef(0);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  const pushToast = useCallback((message: string, type: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    const id = Date.now();
    setToast({ id, message, type: type.toLowerCase() });
    toastTimerRef.current = setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, 4500);
  }, []);

  const handleIncomingNotification = useCallback(
    (payload: RealtimeNotificationEvent) => {
      if (payload.event === "notification.created" && payload.notification_id) {
        const normalizedType = (
          payload.notification_type ?? "system"
        ).toLowerCase();
        const newItem: NotificationResponse = {
          notification_id: payload.notification_id,
          user_id: payload.user_id ?? 0,
          notification_type: normalizedType,
          message: payload.message ?? "New notification",
          is_read: Boolean(payload.is_read),
          created_at: payload.created_at ?? new Date().toISOString(),
        };

        queryClient.setQueryData<NotificationResponse[]>(
          notificationKeys.list(undefined),
          (old) =>
            old
              ? [
                  newItem,
                  ...old.filter(
                    (n) => n.notification_id !== newItem.notification_id
                  ),
                ]
              : [newItem]
        );
        queryClient.setQueryData<NotificationResponse[]>(
          notificationKeys.list(false),
          (old) =>
            old
              ? [
                  newItem,
                  ...old.filter(
                    (n) => n.notification_id !== newItem.notification_id
                  ),
                ]
              : [newItem]
        );
        queryClient.setQueryData<UnreadCountResponse>(
          notificationKeys.unreadCount,
          (old) => ({ unread_count: (old?.unread_count ?? 0) + 1 })
        );

        if (normalizedType === "share" || normalizedType === "comment") {
          queryClient.invalidateQueries({ queryKey: taskKeys.all });
        }

        pushToast(newItem.message, normalizedType);
      } else if (
        payload.event === "notification.updated" &&
        payload.notification_id
      ) {
        queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      }
    },
    [queryClient, pushToast]
  );

  // Revalidate lightweight unread count when tab regains visibility
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        queryClient.invalidateQueries({
          queryKey: notificationKeys.unreadCount,
        });
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [queryClient]);

  useEffect(() => {
    unmountedRef.current = false;

    const cleanupConnections = () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
    };

    const connectSSE = (token: string) => {
      if (unmountedRef.current) return;
      const sseUrl = `${ASSET_BASE_URL.replace(/\/+$/, "")}/api/v1/notifications/stream?token=${encodeURIComponent(token)}`;
      const es = new EventSource(sseUrl);
      sseRef.current = es;

      es.addEventListener("connected", () => {
        if (unmountedRef.current) return;
        reconnectAttemptRef.current = 0;
        setStatus("sse");
        queryClient.invalidateQueries({
          queryKey: notificationKeys.unreadCount,
        });
      });

      es.addEventListener("notification", (evt) => {
        try {
          const parsed = JSON.parse(
            (evt as MessageEvent<string>).data
          ) as RealtimeNotificationEvent;
          handleIncomingNotification(parsed);
        } catch {
          // ignore malformed event
        }
      });

      es.onerror = () => {
        es.close();
        sseRef.current = null;
        if (!unmountedRef.current) {
          scheduleReconnect();
        }
      };
    };

    const connectWS = (token: string) => {
      if (unmountedRef.current) return;
      const wsUrl = `${WS_BASE_URL.replace(/\/+$/, "")}/api/v1/notifications/ws?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      let opened = false;

      ws.onopen = () => {
        opened = true;
        wsFailuresRef.current = 0;
        reconnectAttemptRef.current = 0;
        setStatus("ws");
        queryClient.invalidateQueries({
          queryKey: notificationKeys.unreadCount,
        });

        heartbeatTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000);
      };

      ws.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(
            String(evt.data)
          ) as RealtimeNotificationEvent;
          handleIncomingNotification(parsed);
        } catch {
          // ignore non-json
        }
      };

      ws.onclose = () => {
        if (heartbeatTimerRef.current) {
          clearInterval(heartbeatTimerRef.current);
          heartbeatTimerRef.current = null;
        }
        wsRef.current = null;
        if (!opened) {
          wsFailuresRef.current += 1;
        }
        if (!unmountedRef.current) {
          scheduleReconnect();
        }
      };

      ws.onerror = () => {
        // handled in onclose
      };
    };

    const startConnection = async () => {
      if (unmountedRef.current) return;
      setStatus("connecting");
      try {
        const res = await fetch("/api/auth/ws-token", { cache: "no-store" });
        if (!res.ok) {
          scheduleReconnect();
          return;
        }
        const data = (await res.json()) as { access_token?: string };
        if (!data.access_token || unmountedRef.current) {
          scheduleReconnect();
          return;
        }

        if (wsFailuresRef.current >= 2) {
          connectSSE(data.access_token);
        } else {
          connectWS(data.access_token);
        }
      } catch {
        scheduleReconnect();
      }
    };

    const scheduleReconnect = () => {
      if (unmountedRef.current) return;
      setStatus("reconnecting");
      const delay = Math.min(
        30000,
        1000 * Math.pow(2, reconnectAttemptRef.current)
      );
      reconnectAttemptRef.current += 1;
      reconnectTimerRef.current = setTimeout(() => {
        startConnection();
      }, delay);
    };

    startConnection();

    return () => {
      unmountedRef.current = true;
      cleanupConnections();
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, [handleIncomingNotification, queryClient]);

  const markRead = useCallback(
    async (notificationId: number) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({ type: "mark_read", notification_id: notificationId })
        );
      } else {
        await apiFetch(endpoints.notification(notificationId), {
          method: "PATCH",
          body: { is_read: true },
        });
      }
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
    [queryClient]
  );

  return (
    <RealtimeContext.Provider value={{ status, markRead }}>
      {children}

      {/* Single Non-Intrusive Clickable Live Toast */}
      <AnimatePresence>
        {toast && (
          <div
            aria-live="polite"
            className="fixed bottom-4 right-4 z-50 w-full max-w-[360px]"
          >
            <motion.div
              key={toast.id}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
              transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
              onClick={() => {
                setToast(null);
                router.push("/notifications");
              }}
              className="flex cursor-pointer items-start justify-between gap-3 rounded-[8px] border border-strong bg-surface px-3.5 py-2.5 text-[13px] text-ink-primary hover:border-accent transition-precision"
            >
              <div className="flex items-start gap-2.5">
                <Bell
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent"
                  strokeWidth={1.75}
                />
                <div className="space-y-0.5">
                  <p className="leading-snug">{toast.message}</p>
                  <p className="font-mono text-[10px] capitalize text-ink-muted">
                    {toast.type} · Click to view
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={(e) => {
                  e.stopPropagation();
                  setToast(null);
                }}
                className="rounded-[4px] p-0.5 text-ink-muted hover:text-ink-primary cursor-pointer"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </RealtimeContext.Provider>
  );
}
