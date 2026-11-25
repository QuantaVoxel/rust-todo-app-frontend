import { CheckSquare } from "lucide-react";

export default function TasksPage() {
  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 items-center justify-between border-b border-hairline px-6">
        <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-ink-primary">
          Tasks
        </h1>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[8px] border border-hairline bg-subtle text-ink-secondary">
          <CheckSquare className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <h2 className="text-[15px] font-semibold text-ink-primary">
          Workspace Foundation Ready
        </h2>
        <p className="mt-1 max-w-sm text-[13px] text-ink-secondary">
          App Shell, Design System, BFF Auth, dan API Client sudah terpasang.
          Siap melanjutkan ke implementasi Task List, Kanban Board, dan Lookups.
        </p>
      </div>
    </div>
  );
}
