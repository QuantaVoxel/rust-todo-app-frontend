"use client";

import { usePathname } from "next/navigation";
import * as Tooltip from "@radix-ui/react-tooltip";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { NotificationBell } from "@/features/notifications/notification-center";
import { useRealtime } from "@/features/notifications/realtime-provider";
import { useWorkspaceStore, type SmartView } from "@/stores/workspace-store";

const SMART_VIEW_LABELS: Record<SmartView, string> = {
  all: "All Tasks",
  owned: "My Tasks",
  shared: "Shared with Me",
  upcoming: "Upcoming",
  archived: "Archived",
};

function getBreadcrumb(
  pathname: string,
  smartView: SmartView
): { section: string; page: string } {
  if (pathname.startsWith("/classifications")) {
    return { section: "Organize", page: "Classifications" };
  }
  if (pathname.startsWith("/connections")) {
    return { section: "Collaborate", page: "Connections" };
  }
  if (pathname.startsWith("/notifications")) {
    return { section: "Collaborate", page: "Notifications" };
  }
  if (pathname.startsWith("/activity")) {
    return { section: "System", page: "Activity Logs" };
  }
  if (pathname.startsWith("/settings")) {
    return { section: "System", page: "Settings" };
  }
  return { section: "Workspace", page: SMART_VIEW_LABELS[smartView] ?? "Tasks" };
}

export function Header({ onOpenMobile }: { onOpenMobile: () => void }) {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();
  const smartView = useWorkspaceStore((s) => s.smartView);
  const sidebarCollapsed = useWorkspaceStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar);
  const setCommandPaletteOpen = useWorkspaceStore(
    (s) => s.setCommandPaletteOpen
  );

  const { status: realtimeStatus } = useRealtime();
  const crumb = getBreadcrumb(pathname, smartView);

  const isLive = realtimeStatus === "ws" || realtimeStatus === "sse";
  const liveLabel =
    realtimeStatus === "ws"
      ? "Live connected (WebSocket)"
      : realtimeStatus === "sse"
        ? "Live connected (SSE)"
        : realtimeStatus === "reconnecting"
          ? "Reconnecting..."
          : "Connecting...";

  return (
    <Tooltip.Provider delayDuration={200}>
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-hairline bg-surface px-4 md:px-6">
        {/* Left: Mobile Trigger, Desktop Collapse, Contextual Breadcrumb */}
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenMobile}
            aria-label="Open navigation"
            className="flex h-8 w-8 items-center justify-center rounded-[6px] text-ink-secondary hover:bg-subtle hover:text-ink-primary transition-precision focus-ring lg:hidden cursor-pointer"
          >
            <Menu className="h-4 w-4" strokeWidth={1.75} />
          </button>

          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label={
                  sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
                }
                className="hidden h-8 w-8 items-center justify-center rounded-[6px] text-ink-secondary hover:bg-subtle hover:text-ink-primary transition-precision focus-ring lg:inline-flex cursor-pointer"
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4" strokeWidth={1.75} />
                ) : (
                  <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} />
                )}
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                side="bottom"
                sideOffset={6}
                className="z-50 rounded-[6px] border border-hairline bg-surface px-2.5 py-1 text-[11px] text-ink-primary"
              >
                {sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}{" "}
                <kbd className="ml-1 font-mono text-ink-muted">[</kbd>
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>

          <div className="hidden h-4 w-px bg-hairline lg:block" />

          <AnimatePresence mode="wait">
            <motion.div
              key={`${crumb.section}-${crumb.page}`}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, y: -2 }}
              transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
              className="flex min-w-0 items-center gap-1.5 text-[13px]"
            >
              <span className="hidden sm:inline text-ink-muted">
                {crumb.section}
              </span>
              <span className="hidden sm:inline text-ink-muted">/</span>
              <span className="truncate font-semibold text-ink-primary">
                {crumb.page}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right: Command Palette Trigger + Live Status + Notification Bell */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            aria-label="Open command palette"
            className="flex h-8 w-[180px] sm:w-[240px] items-center justify-between rounded-[6px] border border-hairline bg-canvas px-2.5 text-[12px] text-ink-muted hover:border-strong hover:text-ink-secondary transition-precision focus-ring cursor-pointer"
          >
            <span className="flex items-center gap-2 truncate">
              <Search className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              <span className="truncate">Search tasks, jump to...</span>
            </span>
            <kbd className="ml-2 shrink-0 rounded-[4px] border border-hairline bg-surface px-1.5 py-0.5 font-mono text-[10px] text-ink-muted tabular-nums">
              ⌘K
            </kbd>
          </button>

          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <div
                tabIndex={0}
                aria-label={liveLabel}
                className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-hairline bg-canvas focus-ring"
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    isLive ? "bg-success" : "bg-warning animate-pulse"
                  )}
                />
              </div>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                side="bottom"
                sideOffset={6}
                className="z-50 rounded-[6px] border border-hairline bg-surface px-2.5 py-1 text-[11px] text-ink-primary"
              >
                {liveLabel}
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>

          <NotificationBell />
        </div>
      </header>
    </Tooltip.Provider>
  );
}
