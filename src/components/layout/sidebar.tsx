"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import {
  Activity,
  Archive,
  Bell,
  CalendarClock,
  CheckSquare,
  ChevronUp,
  Inbox,
  LogOut,
  Moon,
  Plus,
  Settings,
  Share2,
  Sun,
  Tags,
  Users,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type {
  UserConnectionResponse,
  UserSettingResponse,
} from "@/lib/api/types";
import { cn } from "@/lib/utils/cn";
import { getInitials } from "@/lib/utils/format";
import { useCurrentUser } from "@/features/tasks/queries";
import { useUnreadCount } from "@/features/notifications/notification-center";
import { useWorkspaceStore, type SmartView } from "@/stores/workspace-store";

interface NavItemConfig {
  id: string;
  label: string;
  href: string;
  active: boolean;
  icon: React.ReactNode;
  badge?: number;
  onClick?: () => void;
}

function SidebarNavItem({
  item,
  collapsed,
}: {
  item: NavItemConfig;
  collapsed: boolean;
}) {
  const shouldReduceMotion = useReducedMotion();

  const linkEl = (
    <Link
      href={item.href}
      onClick={item.onClick}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        "relative flex h-8 items-center rounded-[6px] text-[13px] font-medium transition-precision focus-ring",
        collapsed ? "justify-center px-0" : "justify-between px-2.5",
        item.active
          ? "text-ink-primary"
          : "text-ink-secondary hover:bg-subtle/70 hover:text-ink-primary"
      )}
    >
      {item.active && (
        <motion.span
          layoutId="sidebar-active-indicator"
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 420, damping: 32 }
          }
          className="absolute inset-0 -z-10 rounded-[6px] bg-surface border border-hairline"
        >
          <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r bg-accent" />
        </motion.span>
      )}

      <span className="flex min-w-0 items-center gap-2.5">
        <span className={cn(item.active ? "text-accent" : "text-current")}>
          {item.icon}
        </span>
        {!collapsed && <span className="truncate">{item.label}</span>}
      </span>

      {!collapsed && item.badge !== undefined && item.badge > 0 && (
        <span className="ml-2 rounded-[4px] bg-accent px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none text-white tabular-nums">
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      )}

      {collapsed && item.badge !== undefined && item.badge > 0 && (
        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
      )}
    </Link>
  );

  if (!collapsed) return linkEl;

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{linkEl}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          sideOffset={8}
          className="z-50 flex items-center gap-2 rounded-[6px] border border-hairline bg-surface px-2.5 py-1 text-[12px] font-medium text-ink-primary"
        >
          <span>{item.label}</span>
          {item.badge !== undefined && item.badge > 0 && (
            <span className="rounded-[4px] bg-accent px-1.5 py-0.5 font-mono text-[10px] text-white tabular-nums">
              {item.badge}
            </span>
          )}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

const WORKSPACE_VIEWS: Array<{
  id: SmartView;
  label: string;
  icon: typeof Inbox;
}> = [
  { id: "all", label: "All Tasks", icon: Inbox },
  { id: "owned", label: "My Tasks", icon: CheckSquare },
  { id: "shared", label: "Shared with Me", icon: Share2 },
  { id: "upcoming", label: "Upcoming", icon: CalendarClock },
  { id: "archived", label: "Archived", icon: Archive },
];

export function Sidebar({
  isMobile = false,
  onCloseMobile,
}: {
  isMobile?: boolean;
  onCloseMobile?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const shouldReduceMotion = useReducedMotion();

  const smartView = useWorkspaceStore((s) => s.smartView);
  const setSmartView = useWorkspaceStore((s) => s.setSmartView);
  const sidebarCollapsed = useWorkspaceStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useWorkspaceStore((s) => s.setSidebarCollapsed);
  const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar);
  const setQuickCreateOpen = useWorkspaceStore((s) => s.setQuickCreateOpen);

  const collapsed = isMobile ? false : sidebarCollapsed;

  const { data: unreadData } = useUnreadCount();
  const { data: me } = useCurrentUser();
  const { data: pendingConnections = [] } = useQuery({
    queryKey: ["connections", "pending"],
    queryFn: () =>
      apiFetch<UserConnectionResponse[]>(endpoints.connections("pending")),
    staleTime: 30 * 1000,
  });

  const pendingIncomingCount = pendingConnections.filter(
    (c) => me && c.user_id_2 === me.user_id
  ).length;
  const unreadCount = unreadData?.unread_count ?? 0;

  // Hydrate collapsed preference from localStorage
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("todo_sidebar_collapsed");
      if (saved === "true") {
        setSidebarCollapsed(true);
      }
    } catch {
      // ignore
    }
  }, [setSidebarCollapsed]);

  // Keyboard shortcuts: `[` or `Cmd/Ctrl + B` to toggle sidebar
  useEffect(() => {
    if (isMobile) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      if (!isEditable && e.key === "[" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobile, toggleSidebar]);

  // Theme sync with /users/me/settings/theme
  const [localDarkOverride, setLocalDarkOverride] = useState<boolean | null>(
    null
  );
  const { data: userSettings } = useQuery({
    queryKey: ["users", "me", "settings"],
    queryFn: () => apiFetch<UserSettingResponse[]>(endpoints.meSettings()),
    staleTime: 5 * 60 * 1000,
  });
  const themeSetting = userSettings?.find(
    (s) => s.setting_key === "theme"
  )?.setting_value;
  const isDark =
    localDarkOverride ?? (themeSetting ? themeSetting === "dark" : true);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  const updateThemeMutation = useMutation({
    mutationFn: (themeValue: "dark" | "light") =>
      apiFetch<UserSettingResponse>(endpoints.meSettingKey("theme"), {
        method: "PUT",
        body: { setting_value: themeValue },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users", "me", "settings"] });
    },
  });

  const toggleTheme = () => {
    const nextDark = !isDark;
    setLocalDarkOverride(nextDark);
    updateThemeMutation.mutate(nextDark ? "dark" : "light");
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  const handleQuickNewTask = () => {
    if (!pathname.startsWith("/tasks")) {
      router.push("/tasks");
    }
    setQuickCreateOpen(true);
    onCloseMobile?.();
  };

  const fullName = [me?.profile?.first_name, me?.profile?.last_name]
    .filter(Boolean)
    .join(" ");
  const displayName = fullName || me?.username || "Workspace User";
  const initials = getInitials(
    me?.profile?.first_name,
    me?.profile?.last_name,
    me?.username
  );

  return (
    <Tooltip.Provider delayDuration={200}>
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 64 : 240 }}
        transition={
          shouldReduceMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 420, damping: 32 }
        }
        className="flex h-full shrink-0 flex-col border-r border-hairline bg-canvas px-2.5 py-3.5 select-none overflow-hidden"
      >
        {/* Brand Header */}
        <div
          className={cn(
            "mb-3 flex h-7 items-center",
            collapsed ? "justify-center" : "justify-between px-1.5"
          )}
        >
          <Link
            href="/tasks"
            className="flex items-center gap-2 focus-ring rounded-[4px]"
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-accent" />
            {!collapsed && (
              <span className="truncate text-[14px] font-semibold tracking-[-0.015em] text-ink-primary">
                Todo Workspace
              </span>
            )}
          </Link>

          {isMobile && onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close navigation"
              className="rounded-[6px] p-1 text-ink-muted hover:bg-subtle hover:text-ink-primary"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          )}
        </div>

        {/* Primary Quick Action: + New Task */}
        <div className="mb-4">
          {collapsed ? (
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  type="button"
                  onClick={handleQuickNewTask}
                  aria-label="New Task"
                  className="mx-auto flex h-8 w-8 items-center justify-center rounded-[6px] bg-accent text-white hover:bg-accent-hover transition-precision focus-ring cursor-pointer"
                >
                  <Plus className="h-4 w-4" strokeWidth={2} />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  side="right"
                  sideOffset={8}
                  className="z-50 rounded-[6px] border border-hairline bg-surface px-2.5 py-1 text-[12px] text-ink-primary"
                >
                  New Task <kbd className="ml-1 font-mono text-ink-muted">C</kbd>
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          ) : (
            <button
              type="button"
              onClick={handleQuickNewTask}
              className="flex h-8 w-full items-center justify-between rounded-[6px] bg-accent px-2.5 text-[13px] font-medium text-white hover:bg-accent-hover transition-precision focus-ring cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                <span>New Task</span>
              </span>
              <kbd className="rounded-[4px] bg-black/20 px-1.5 py-0.5 font-mono text-[10px] text-white/90 tabular-nums">
                C
              </kbd>
            </button>
          )}
        </div>

        {/* Structured Navigation Sections */}
        <nav className="flex-1 space-y-5 overflow-y-auto overflow-x-hidden pr-0.5">
          <div>
            {!collapsed && (
              <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
                Workspace
              </p>
            )}
            <div className="space-y-0.5">
              {WORKSPACE_VIEWS.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarNavItem
                    key={item.id}
                    collapsed={collapsed}
                    item={{
                      id: item.id,
                      label: item.label,
                      href: "/tasks",
                      active:
                        pathname.startsWith("/tasks") && smartView === item.id,
                      icon: (
                        <Icon
                          className="h-4 w-4 shrink-0"
                          strokeWidth={1.75}
                        />
                      ),
                      onClick: () => {
                        setSmartView(item.id);
                        onCloseMobile?.();
                      },
                    }}
                  />
                );
              })}
            </div>
          </div>

          <div>
            {!collapsed && (
              <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
                Organize
              </p>
            )}
            <div className="space-y-0.5">
              <SidebarNavItem
                collapsed={collapsed}
                item={{
                  id: "classifications",
                  label: "Classifications",
                  href: "/classifications",
                  active: pathname.startsWith("/classifications"),
                  icon: <Tags className="h-4 w-4 shrink-0" strokeWidth={1.75} />,
                  onClick: onCloseMobile,
                }}
              />
            </div>
          </div>

          <div>
            {!collapsed && (
              <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
                Collaborate
              </p>
            )}
            <div className="space-y-0.5">
              <SidebarNavItem
                collapsed={collapsed}
                item={{
                  id: "connections",
                  label: "Connections",
                  href: "/connections",
                  active: pathname.startsWith("/connections"),
                  badge: pendingIncomingCount,
                  icon: (
                    <Users className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  ),
                  onClick: onCloseMobile,
                }}
              />
              <SidebarNavItem
                collapsed={collapsed}
                item={{
                  id: "notifications",
                  label: "Notifications",
                  href: "/notifications",
                  active: pathname.startsWith("/notifications"),
                  badge: unreadCount,
                  icon: <Bell className="h-4 w-4 shrink-0" strokeWidth={1.75} />,
                  onClick: onCloseMobile,
                }}
              />
            </div>
          </div>

          <div>
            {!collapsed && (
              <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
                System
              </p>
            )}
            <div className="space-y-0.5">
              <SidebarNavItem
                collapsed={collapsed}
                item={{
                  id: "activity",
                  label: "Activity Logs",
                  href: "/activity",
                  active: pathname.startsWith("/activity"),
                  icon: (
                    <Activity className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  ),
                  onClick: onCloseMobile,
                }}
              />
              <SidebarNavItem
                collapsed={collapsed}
                item={{
                  id: "settings",
                  label: "Settings",
                  href: "/settings",
                  active: pathname.startsWith("/settings"),
                  icon: (
                    <Settings className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  ),
                  onClick: onCloseMobile,
                }}
              />
            </div>
          </div>
        </nav>

        {/* Sticky User Profile Footer + Popover Menu */}
        <div className="mt-3 border-t border-hairline pt-2.5">
          <Popover.Root>
            <Popover.Trigger asChild>
              <button
                type="button"
                aria-label="User menu"
                className={cn(
                  "flex w-full items-center rounded-[6px] p-1.5 text-left hover:bg-subtle transition-precision focus-ring cursor-pointer",
                  collapsed ? "justify-center" : "justify-between gap-2"
                )}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface font-mono text-[11px] font-semibold text-ink-primary">
                    {initials}
                  </span>
                  {!collapsed && (
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-medium text-ink-primary">
                        {displayName}
                      </p>
                      {me?.email && (
                        <p className="truncate text-[11px] text-ink-muted">
                          {me.email}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                {!collapsed && (
                  <ChevronUp
                    className="h-3.5 w-3.5 shrink-0 text-ink-muted"
                    strokeWidth={1.75}
                  />
                )}
              </button>
            </Popover.Trigger>

            <Popover.Portal>
              <Popover.Content
                side={collapsed ? "right" : "top"}
                align="start"
                sideOffset={8}
                className="z-50 w-[216px] rounded-[8px] border border-hairline bg-surface p-1.5 text-ink-primary focus:outline-none"
              >
                <div className="border-b border-hairline px-2.5 py-2 mb-1">
                  <p className="truncate text-[12px] font-semibold text-ink-primary">
                    {displayName}
                  </p>
                  {me?.username && (
                    <p className="truncate font-mono text-[11px] text-ink-muted">
                      @{me.username}
                    </p>
                  )}
                </div>

                <Link
                  href="/settings"
                  onClick={onCloseMobile}
                  className="flex h-8 w-full items-center gap-2.5 rounded-[6px] px-2.5 text-[12px] text-ink-secondary hover:bg-subtle hover:text-ink-primary transition-precision"
                >
                  <Settings className="h-3.5 w-3.5" strokeWidth={1.75} />
                  <span>Profile &amp; Settings</span>
                </Link>

                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex h-8 w-full items-center justify-between rounded-[6px] px-2.5 text-[12px] text-ink-secondary hover:bg-subtle hover:text-ink-primary transition-precision cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    {isDark ? (
                      <Moon className="h-3.5 w-3.5" strokeWidth={1.75} />
                    ) : (
                      <Sun className="h-3.5 w-3.5" strokeWidth={1.75} />
                    )}
                    <span>Theme</span>
                  </span>
                  <span className="font-mono text-[11px] text-ink-muted">
                    {isDark ? "Dark" : "Light"}
                  </span>
                </button>

                <div className="my-1 border-t border-hairline" />

                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex h-8 w-full items-center gap-2.5 rounded-[6px] px-2.5 text-[12px] text-danger hover:bg-danger-tint transition-precision cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
                  <span>Sign out</span>
                </button>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      </motion.aside>
    </Tooltip.Provider>
  );
}
