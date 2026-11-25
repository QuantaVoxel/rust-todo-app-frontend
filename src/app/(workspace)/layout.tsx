import { Suspense, type ReactNode } from "react";
import { WorkspaceShell } from "@/components/layout/workspace-shell";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh w-full items-center justify-center bg-canvas text-[13px] text-ink-muted">
          Loading workspace...
        </div>
      }
    >
      <WorkspaceShell>{children}</WorkspaceShell>
    </Suspense>
  );
}
