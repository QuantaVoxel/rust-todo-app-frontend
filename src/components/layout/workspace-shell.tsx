"use client";

import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { RealtimeProvider } from "@/features/notifications/realtime-provider";
import { CommandPalette } from "./command-palette";
import { Sidebar } from "./sidebar";

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <RealtimeProvider>
      <div className="flex h-screen w-full overflow-hidden bg-canvas text-ink-primary">
      {/* Desktop Sidebar Rail */}
      <div className="hidden lg:block h-full">
        <Sidebar />
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 h-full">
            <Sidebar onCloseMobile={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex flex-1 min-w-0 flex-col overflow-hidden bg-surface">
        {/* Mobile Top Bar */}
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-hairline bg-canvas px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="rounded-[6px] p-1.5 text-ink-secondary hover:bg-subtle hover:text-ink-primary focus-ring"
          >
            <Menu className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <span className="h-2 w-2 rounded-[2px] bg-accent" />
          <span className="text-[13px] font-semibold tracking-[-0.01em]">
            Todo Workspace
          </span>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
      </main>
      <CommandPalette />
    </div>
    </RealtimeProvider>
  );
}
