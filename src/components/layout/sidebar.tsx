"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Archive,
  Bell,
  CalendarClock,
  CheckSquare,
  Inbox,
  LogOut,
  Search,
  Settings,
  Share2,
  Tags,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useWorkspaceStore, type SmartView } from "@/stores/workspace-store";

interface NavItemProps {
  label: string;
  href: string;
  active: boolean;
  icon: React.ReactNode;
  onClick?: () => void;
  badge?: number;
}

function NavItem({ label, href, active, icon, onClick, badge }: NavItemProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex h-8 items-center justify-between rounded-[6px] px-2.5 text-[13px] font-medium transition-precision focus-ring",
        active
          ? "bg-accent-tint text-accent"
          : "text-ink-secondary hover:bg-subtle hover:text-ink-primary"
      )}
    >
      <span className="flex items-center gap-2.5 truncate">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      {badge !== undefined && badge > 0 && (
        <span className="ml-2 rounded-[4px] bg-accent px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none text-white tabular-nums">
          {badge}
        </span>
      )}
    </Link>
  );
}

const SMART_VIEWS: Array<{
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

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const smartView = useWorkspaceStore((s) => s.smartView);
  const setSmartView = useWorkspaceStore((s) => s.setSmartView);
  const setCommandPaletteOpen = useWorkspaceStore(
    (s) => s.setCommandPaletteOpen
  );

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  return (
    <aside className="flex h-full w-[240px] shrink-0 flex-col border-r border-hairline bg-canvas px-3 py-3.5 select-none">
      {/* Brand Header */}
      <div className="mb-3 flex items-center justify-between px-1.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-accent" />
          <span className="text-[14px] font-semibold tracking-[-0.015em] text-ink-primary">
            Todo Workspace
          </span>
        </div>
      </div>

      {/* Quick Command Search */}
      <button
        type="button"
        onClick={() => setCommandPaletteOpen(true)}
        className="mb-4 flex h-8 w-full items-center justify-between rounded-[6px] border border-hairline bg-surface px-2.5 text-[12px] text-ink-muted hover:border-strong hover:text-ink-secondary transition-precision focus-ring cursor-pointer"
        aria-label="Buka pencarian cepat"
      >
        <span className="flex items-center gap-2">
          <Search className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span>Cari task...</span>
        </span>
        <kbd className="rounded-[4px] bg-subtle px-1.5 py-0.5 font-mono text-[10px] text-ink-muted tabular-nums">
          ⌘K
        </kbd>
      </button>

      {/* Navigation Sections */}
      <nav className="flex-1 space-y-5 overflow-y-auto pr-0.5">
        <div>
          <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-muted">
            Workspace
          </p>
          <div className="space-y-0.5">
            {SMART_VIEWS.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname.startsWith("/tasks") && smartView === item.id;
              return (
                <NavItem
                  key={item.id}
                  label={item.label}
                  href="/tasks"
                  active={isActive}
                  icon={<Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />}
                  onClick={() => setSmartView(item.id)}
                />
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-muted">
            Taxonomy
          </p>
          <div className="space-y-0.5">
            <NavItem
              label="Classifications"
              href="/classifications"
              active={pathname.startsWith("/classifications")}
              icon={<Tags className="h-4 w-4 shrink-0" strokeWidth={1.75} />}
            />
          </div>
        </div>

        <div>
          <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-muted">
            Social & Audit
          </p>
          <div className="space-y-0.5">
            <NavItem
              label="Connections"
              href="/connections"
              active={pathname.startsWith("/connections")}
              icon={<Users className="h-4 w-4 shrink-0" strokeWidth={1.75} />}
            />
            <NavItem
              label="Notifications"
              href="/notifications"
              active={pathname.startsWith("/notifications")}
              icon={<Bell className="h-4 w-4 shrink-0" strokeWidth={1.75} />}
            />
            <NavItem
              label="Activity Logs"
              href="/activity"
              active={pathname.startsWith("/activity")}
              icon={<Activity className="h-4 w-4 shrink-0" strokeWidth={1.75} />}
            />
          </div>
        </div>
      </nav>

      {/* Bottom Footer Controls */}
      <div className="mt-3 border-t border-hairline pt-2.5 space-y-1">
        <div className="flex items-center justify-between px-2.5 py-1 text-[11px] text-ink-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            <span>API Ready</span>
          </span>
          <span className="font-mono text-[10px] tabular-nums">v2</span>
        </div>
        <NavItem
          label="Settings"
          href="/settings"
          active={pathname.startsWith("/settings")}
          icon={<Settings className="h-4 w-4 shrink-0" strokeWidth={1.75} />}
        />
        <button
          type="button"
          onClick={handleLogout}
          className="flex h-8 w-full items-center gap-2.5 rounded-[6px] px-2.5 text-[13px] font-medium text-ink-secondary hover:bg-subtle hover:text-danger transition-precision focus-ring cursor-pointer"
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  );
}
