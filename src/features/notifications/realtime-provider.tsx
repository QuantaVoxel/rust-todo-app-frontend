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
import { useQueryClient } from "@tanstack/react-query";
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
  list: (isRead?: boolean) => ["notifications", "list", isRead ?? "all"] as const,
  unreadCount: ["notifications", "unread-count"] as const,
};

const WS_BASE_URL =
  process.env.NEXT_PUBLIC_WS_BASE_URL ?? "ws://localhost:8080";
const ASSET_BASE_URL =
  process.env.NEXT_PUBLIC_ASSET_BASE_URL ?? "http://localhost:8080";

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const wsFailuresRef = useRef(0);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unmountedRef = useRef(false);

  const pushToast = useCallback((message: string, type: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev.slice(-2), { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const handleIncomingNotification = useCallback(
    (payload: RealtimeNotificationEvent) => {
      if (payload.event === "notification.created" && payload.notification_id) {
        const newItem: NotificationResponse = {
          notification_id: payload.notification_id,
          user_id: payload.user_id ?? 0,
          notification_type: payload.notification_type ?? "system",
          message: payload.message ?? "New notification",
          is_read: Boolean(payload.is_read),
          created_at: payload.created_at ?? new Date().toISOString(),
        };

        queryClient.setQueryData<NotificationResponse[]>(
          notificationKeys.list(undefined),
          (old) => (old ? [newItem, ...old] : [newItem])
        );
        queryClient.setQueryData<NotificationResponse[]>(
          notificationKeys.list(false),
          (old) => (old ? [newItem, ...old] : [newItem])
        );
        queryClient.setQueryData<UnreadCountResponse>(
          notificationKeys.unreadCount,
          (old) => ({ unread_count: (old?.unread_count ?? 0) + 1 })
        );

        const nType = payload.notification_type?.toLowerCase();
        if (nType === "share" || nType === "comment") {
          queryClient.invalidateQueries({ queryKey: taskKeys.all });
        }

        pushToast(newItem.message, newItem.notification_type);
      } else if (
        payload.event === "notification.updated" &&
        payload.notification_id
      ) {
        queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      }
    },
    [queryClient, pushToast]
  );

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
    };
  }, [handleIncomingNotification]);

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

      {/* Bottom-Right Subtle Toasts */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 flex w-full max-w-[360px] flex-col gap-2"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className="flex items-start justify-between gap-3 rounded-[8px] border border-strong bg-surface px-3.5 py-2.5 text-[13px] text-ink-primary"
            >
              <div className="flex items-start gap-2.5">
                <Bell
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent"
                  strokeWidth={1.75}
                />
                <p className="leading-snug">{t.message}</p>
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() =>
                  setToasts((prev) => prev.filter((item) => item.id !== t.id))
                }
                className="rounded-[4px] p-0.5 text-ink-muted hover:text-ink-primary cursor-pointer"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </div>
          ))}
        </div>
      )}
    </RealtimeContext.Provider>
  );
}
