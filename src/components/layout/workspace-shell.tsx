"use client";

import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";

export function WorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-canvas text-ink-primary">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto bg-surface">
        {children}
      </main>
    </div>
  );
}
