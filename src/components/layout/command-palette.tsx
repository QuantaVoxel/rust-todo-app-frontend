"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Bell,
  LayoutGrid,
  List,
  Plus,
  Search,
  Settings,
  Tags,
  Users,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { PaginatedResponse, TaskResponse } from "@/lib/api/types";
import { StatusIcon } from "@/features/tasks/task-indicators";
import { useWorkspaceStore } from "@/stores/workspace-store";

export function CommandPalette() {
  const router = useRouter();
  const open = useWorkspaceStore((s) => s.commandPaletteOpen);
  const setOpen = useWorkspaceStore((s) => s.setCommandPaletteOpen);
  const setActiveTaskId = useWorkspaceStore((s) => s.setActiveTaskId);
  const setQuickCreateOpen = useWorkspaceStore((s) => s.setQuickCreateOpen);
  const setViewMode = useWorkspaceStore((s) => s.setViewMode);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, setOpen]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: searchResults } = useQuery({
    queryKey: ["command-palette", "tasks", debouncedQuery],
    queryFn: () =>
      apiFetch<PaginatedResponse<TaskResponse>>(
        endpoints.tasks({ search: debouncedQuery, per_page: 6 })
      ),
    enabled: open && debouncedQuery.length >= 2,
    staleTime: 15 * 1000,
  });

  const tasks = searchResults?.data ?? [];

  const closeAndRun = (fn: () => void) => {
    setOpen(false);
    setQuery("");
    fn();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[540px] p-0 overflow-hidden">
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        <div className="flex items-center border-b border-hairline px-3.5">
          <Search
            className="mr-2.5 h-4 w-4 shrink-0 text-ink-muted"
            strokeWidth={1.75}
          />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks or jump to a view..."
            className="h-11 w-full bg-transparent text-[14px] text-ink-primary placeholder:text-ink-muted focus:outline-none"
          />
        </div>

        <div className="max-h-[360px] overflow-y-auto p-2 space-y-3">
          {debouncedQuery.length >= 2 && (
            <div>
              <p className="px-2 py-1 text-[11px] font-medium text-ink-muted">
                Tasks
              </p>
              {tasks.length === 0 ? (
                <p className="px-2 py-2 text-[12px] text-ink-muted">
                  No matching tasks found.
                </p>
              ) : (
                <div className="space-y-0.5">
                  {tasks.map((task) => (
                    <button
                      key={task.task_id}
                      type="button"
                      onClick={() =>
                        closeAndRun(() => {
                          router.push("/tasks");
                          setActiveTaskId(task.task_id);
                        })
                      }
                      className="flex h-9 w-full items-center gap-2.5 rounded-[6px] px-2.5 text-left text-[13px] text-ink-primary hover:bg-subtle transition-precision cursor-pointer"
                    >
                      <StatusIcon
                        status={task.status}
                        className="h-3.5 w-3.5 shrink-0"
                      />
                      <span className="font-mono text-[11px] text-ink-muted tabular-nums">
                        #{task.task_id}
                      </span>
                      <span className="flex-1 truncate">{task.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <p className="px-2 py-1 text-[11px] font-medium text-ink-muted">
              Actions
            </p>
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => closeAndRun(() => setQuickCreateOpen(true))}
                className="flex h-8 w-full items-center justify-between rounded-[6px] px-2.5 text-[13px] text-ink-primary hover:bg-subtle transition-precision cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <Plus className="h-3.5 w-3.5 text-accent" strokeWidth={1.75} />
                  <span>Create new task</span>
                </span>
                <kbd className="rounded-[4px] bg-subtle px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
                  C
                </kbd>
              </button>
              <button
                type="button"
                onClick={() =>
                  closeAndRun(() => {
                    router.push("/tasks");
                    setViewMode("list");
                  })
                }
                className="flex h-8 w-full items-center gap-2.5 rounded-[6px] px-2.5 text-[13px] text-ink-secondary hover:bg-subtle hover:text-ink-primary transition-precision cursor-pointer"
              >
                <List className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span>Switch to List view</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  closeAndRun(() => {
                    router.push("/tasks");
                    setViewMode("board");
                  })
                }
                className="flex h-8 w-full items-center gap-2.5 rounded-[6px] px-2.5 text-[13px] text-ink-secondary hover:bg-subtle hover:text-ink-primary transition-precision cursor-pointer"
              >
                <LayoutGrid className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span>Switch to Board view</span>
              </button>
            </div>
          </div>

          <div>
            <p className="px-2 py-1 text-[11px] font-medium text-ink-muted">
              Navigate
            </p>
            <div className="space-y-0.5">
              {[
                { label: "Classifications", href: "/classifications", icon: Tags },
                { label: "Connections", href: "/connections", icon: Users },
                { label: "Notifications", href: "/notifications", icon: Bell },
                { label: "Activity Logs", href: "/activity", icon: Activity },
                { label: "Settings", href: "/settings", icon: Settings },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => closeAndRun(() => router.push(item.href))}
                    className="flex h-8 w-full items-center gap-2.5 rounded-[6px] px-2.5 text-[13px] text-ink-secondary hover:bg-subtle hover:text-ink-primary transition-precision cursor-pointer"
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
