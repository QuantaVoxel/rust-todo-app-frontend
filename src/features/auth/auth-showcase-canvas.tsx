"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Lock, ShieldCheck, Terminal } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type AuthPhase = "idle" | "typing_password" | "submitting" | "success";

const REALTIME_EVENTS = [
  "Live · Reminder triggered for #42",
  "collab_user commented on #43",
  "Task #44 synced via WebSocket",
];

const STATUS_CYCLE = ["pending", "in_progress", "completed"] as const;

export function AuthShowcaseCanvas({ authPhase }: { authPhase: AuthPhase }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const [cycleIndex, setCycleIndex] = useState(0);
  const [eventIndex, setEventIndex] = useState(0);

  useEffect(() => {
    if (shouldReduceMotion) return;

    const taskTimer = setInterval(() => {
      setCycleIndex((prev) => (prev + 1) % STATUS_CYCLE.length);
    }, 2800);

    const eventTimer = setInterval(() => {
      setEventIndex((prev) => (prev + 1) % REALTIME_EVENTS.length);
    }, 3600);

    return () => {
      clearInterval(taskTimer);
      clearInterval(eventTimer);
    };
  }, [shouldReduceMotion]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (shouldReduceMotion || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    containerRef.current.style.setProperty("--mx", `${x}px`);
    containerRef.current.style.setProperty("--my", `${y}px`);
  };

  const activeStatus = STATUS_CYCLE[cycleIndex];
  const activeProgress =
    activeStatus === "pending" ? 0.15 : activeStatus === "in_progress" ? 0.65 : 1;

  const statusMeta =
    authPhase === "success"
      ? {
          label: "Workspace unlocked",
          tone: "text-success border-success/30 bg-success-tint",
          icon: ShieldCheck,
        }
      : authPhase === "submitting"
        ? {
            label: "Verifying credentials...",
            tone: "text-accent border-accent/30 bg-accent-tint",
            icon: Lock,
          }
        : authPhase === "typing_password"
          ? {
              label: "Securing session input",
              tone: "text-ink-primary border-strong bg-subtle",
              icon: Lock,
            }
          : {
              label: REALTIME_EVENTS[eventIndex],
              tone: "text-ink-secondary border-hairline bg-surface",
              icon: Terminal,
            };

  const StatusBadgeIcon = statusMeta.icon;

  return (
    <aside
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative hidden lg:col-span-7 lg:flex flex-col justify-between overflow-hidden bg-canvas p-10 xl:p-14"
      style={
        {
          "--mx": "50%",
          "--my": "45%",
        } as React.CSSProperties
      }
    >
      {/* Subtle 1px dot-grid base */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            "radial-gradient(var(--border-strong) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      {/* Cursor-tracking radial mask highlight */}
      {!shouldReduceMotion && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(var(--accent-primary) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
            opacity: 0.45,
            WebkitMaskImage:
              "radial-gradient(240px circle at var(--mx) var(--my), black 0%, transparent 100%)",
            maskImage:
              "radial-gradient(240px circle at var(--mx) var(--my), black 0%, transparent 100%)",
          }}
        />
      )}

      {/* Top Bar: Simulated Real-Time / Reactive State Pill */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-[2px] bg-accent" />
          <span className="font-mono text-[12px] font-medium text-ink-secondary">
            todo-workspace.v2
          </span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={statusMeta.label}
            initial={shouldReduceMotion ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, y: 6 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className={cn(
              "inline-flex items-center gap-2 rounded-[6px] border px-2.5 py-1 font-mono text-[11px] tabular-nums",
              statusMeta.tone
            )}
          >
            <StatusBadgeIcon className="h-3 w-3 shrink-0" strokeWidth={1.75} />
            <span>{statusMeta.label}</span>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Center: Editorial Statement + Choreographed Mini Task Stack */}
      <div className="relative z-10 mx-auto w-full max-w-[500px] space-y-8">
        <div className="space-y-2.5">
          <h2 className="text-[28px] font-semibold leading-[1.2] tracking-[-0.025em] text-ink-primary">
            Structured execution, zero visual noise.
          </h2>
          <p className="text-[14px] leading-relaxed text-ink-secondary">
            Manage hierarchical tasks, role-based collaboration, and live
            notifications in a keyboard-first workspace.
          </p>
        </div>

        {/* Choreographed 3-Task Stack */}
        <div className="space-y-2.5">
          {/* Card 1: Choreographed State Loop */}
          <div className="rounded-[8px] border border-strong bg-surface p-3.5">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-precision",
                  activeStatus === "completed"
                    ? "border-[#16A34A] bg-[#16A34A]"
                    : activeStatus === "in_progress"
                      ? "border-[#2563EB] bg-[#2563EB]/20"
                      : "border-dashed border-[#71717A]"
                )}
              >
                {activeStatus === "completed" && (
                  <motion.svg
                    viewBox="0 0 12 12"
                    className="h-2.5 w-2.5 text-white"
                    fill="none"
                  >
                    <motion.path
                      d="M2.5 6.5L5 9L9.5 3.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
                    />
                  </motion.svg>
                )}
              </div>

              <span className="font-mono text-[11px] text-ink-muted tabular-nums">
                #42
              </span>
              <span
                className={cn(
                  "flex-1 truncate text-[13px] font-medium transition-precision",
                  activeStatus === "completed"
                    ? "line-through text-ink-muted"
                    : "text-ink-primary"
                )}
              >
                Audit Salvo JWT refresh rotation
              </span>

              <AnimatePresence mode="wait">
                <motion.span
                  key={activeStatus}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, y: -3 }}
                  transition={{ duration: 0.16 }}
                  className={cn(
                    "rounded-[4px] px-1.5 py-0.5 font-mono text-[10px] font-medium",
                    activeStatus === "completed"
                      ? "bg-success-tint text-success"
                      : activeStatus === "in_progress"
                        ? "bg-[#2563EB]/15 text-[#60A5FA]"
                        : "bg-subtle text-ink-muted"
                  )}
                >
                  {activeStatus}
                </motion.span>
              </AnimatePresence>
            </div>

            {/* GPU-accelerated Progress Bar */}
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-subtle">
              <motion.div
                className="h-full origin-left bg-accent"
                animate={{ scaleX: activeProgress }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 260, damping: 28 }
                }
              />
            </div>
          </div>

          {/* Card 2: Static Realistic Task */}
          <div className="flex items-center gap-3 rounded-[8px] border border-hairline bg-surface/90 p-3.5">
            <span className="h-4 w-4 shrink-0 rounded-full border-[1.5px] border-[#2563EB] bg-[#2563EB]/20" />
            <span className="font-mono text-[11px] text-ink-muted tabular-nums">
              #43
            </span>
            <span className="flex-1 truncate text-[13px] font-medium text-ink-primary">
              Finalize Q4 taxonomy labels
            </span>
            <span className="font-mono text-[11px] text-[#D97706] tabular-nums">
              High
            </span>
          </div>

          {/* Card 3: Completed Realistic Task */}
          <div className="flex items-center gap-3 rounded-[8px] border border-hairline bg-surface/70 p-3.5">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#16A34A] text-white">
              <Check className="h-2.5 w-2.5" strokeWidth={2.2} />
            </span>
            <span className="font-mono text-[11px] text-ink-muted tabular-nums">
              #44
            </span>
            <span className="flex-1 truncate text-[13px] font-medium text-ink-muted line-through">
              Configure WebSocket heartbeat
            </span>
            <span className="font-mono text-[11px] text-ink-muted tabular-nums">
              Done
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Bar: Keyboard Legend */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-t border-hairline pt-5 text-[12px] text-ink-muted">
        <span>Keyboard-first workspace</span>
        <div className="flex items-center gap-4 font-mono text-[11px] tabular-nums">
          <span>
            <kbd className="rounded-[4px] border border-hairline bg-surface px-1.5 py-0.5 text-ink-secondary">
              N
            </kbd>{" "}
            New task
          </span>
          <span>
            <kbd className="rounded-[4px] border border-hairline bg-surface px-1.5 py-0.5 text-ink-secondary">
              ⌘K
            </kbd>{" "}
            Command
          </span>
          <span>
            <kbd className="rounded-[4px] border border-hairline bg-surface px-1.5 py-0.5 text-ink-secondary">
              J/K
            </kbd>{" "}
            Navigate
          </span>
        </div>
      </div>
    </aside>
  );
}
