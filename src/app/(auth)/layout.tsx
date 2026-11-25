import type { ReactNode } from "react";

const SHORTCUTS = [
  { key: "C", label: "Create a new task from anywhere" },
  { key: "⌘K", label: "Jump to views, tasks, or actions" },
  { key: "J / K", label: "Move selection up and down" },
  { key: "Enter", label: "Open the contextual task inspector" },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen w-full bg-canvas text-ink-primary lg:grid-cols-[44%_56%]">
      {/* Left Editorial / Product Context Pane */}
      <aside className="hidden lg:flex flex-col justify-between border-r border-hairline bg-canvas p-10 xl:p-14">
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-accent" />
          <span className="text-[14px] font-semibold tracking-[-0.015em] text-ink-primary">
            Todo Workspace
          </span>
        </div>

        <div className="max-w-[420px] space-y-8">
          <div className="space-y-3">
            <h2 className="text-[28px] font-semibold leading-[1.2] tracking-[-0.025em] text-ink-primary">
              Quiet software for deliberate work.
            </h2>
            <p className="text-[14px] leading-relaxed text-ink-secondary">
              Built for speed over ceremony. Manage hierarchical tasks,
              collaborate with clear role boundaries, and stay synchronized in
              real time.
            </p>
          </div>

          {/* Grounded Product Specimen (Task Row Preview) */}
          <div className="overflow-hidden rounded-[8px] border border-hairline bg-surface">
            <div className="flex h-[44px] items-center gap-3 border-b border-hairline px-3.5">
              <span className="h-3.5 w-3.5 rounded-full border-[1.5px] border-[#2563EB]" />
              <span className="font-mono text-[12px] text-ink-muted tabular-nums">
                #42
              </span>
              <span className="flex-1 truncate text-[13px] font-medium text-ink-primary">
                Audit Salvo API endpoints
              </span>
              <span className="font-mono text-[11px] text-ink-muted tabular-nums">
                75%
              </span>
              <span className="font-mono text-[11px] text-ink-secondary tabular-nums">
                25 Nov
              </span>
            </div>
            <div className="flex h-[44px] items-center gap-3 px-3.5">
              <span className="h-3.5 w-3.5 rounded-full border-[1.5px] border-dashed border-[#71717A]" />
              <span className="font-mono text-[12px] text-ink-muted tabular-nums">
                #43
              </span>
              <span className="flex-1 truncate text-[13px] font-medium text-ink-primary">
                Prepare Q4 release checklist
              </span>
              <span className="font-mono text-[11px] text-[#D97706] tabular-nums">
                High
              </span>
            </div>
          </div>

          {/* Keyboard-First Legend */}
          <div className="space-y-2.5 border-t border-hairline pt-6">
            <p className="text-[12px] font-medium text-ink-secondary">
              Keyboard-first navigation
            </p>
            <ul className="space-y-2">
              {SHORTCUTS.map((item) => (
                <li
                  key={item.key}
                  className="flex items-center justify-between text-[13px]"
                >
                  <span className="text-ink-muted">{item.label}</span>
                  <kbd className="rounded-[4px] border border-hairline bg-subtle px-1.5 py-0.5 font-mono text-[11px] text-ink-secondary tabular-nums">
                    {item.key}
                  </kbd>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="text-[12px] text-ink-muted">
          Next.js 16 BFF + Rust Salvo Engine
        </p>
      </aside>

      {/* Right Form Pane */}
      <main className="flex flex-col items-center justify-center bg-surface px-6 py-12 lg:px-12">
        <div className="mb-8 flex w-full max-w-[400px] items-center gap-2 lg:hidden">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-accent" />
          <span className="text-[14px] font-semibold tracking-[-0.015em] text-ink-primary">
            Todo Workspace
          </span>
        </div>
        {children}
      </main>
    </div>
  );
}
