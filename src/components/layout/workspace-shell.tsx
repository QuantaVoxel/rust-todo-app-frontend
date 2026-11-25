"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { RealtimeProvider } from "@/features/notifications/realtime-provider";
import { CommandPalette } from "./command-palette";
import { Header } from "./header";
import { Sidebar } from "./sidebar";

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer on ESC
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  return (
    <RealtimeProvider>
      <div className="flex h-dvh w-full overflow-hidden bg-canvas text-ink-primary">
        {/* Desktop Collapsible Sidebar Rail */}
        <div className="hidden lg:block h-full shrink-0">
          <Sidebar />
        </div>

        {/* Mobile Slide-Over Drawer */}
        <AnimatePresence>
          {mobileOpen && (
            <div className="fixed inset-0 z-50 flex lg:hidden">
              <motion.div
                initial={shouldReduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0 }}
                transition={{ duration: 0.16 }}
                className="fixed inset-0 bg-black/50"
                onClick={() => setMobileOpen(false)}
              />
              <motion.div
                initial={shouldReduceMotion ? false : { x: -240 }}
                animate={{ x: 0 }}
                exit={shouldReduceMotion ? undefined : { x: -240 }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 420, damping: 34 }
                }
                className="relative z-10 h-full"
              >
                <Sidebar
                  isMobile
                  onCloseMobile={() => setMobileOpen(false)}
                />
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Right Column: Sticky Header + Scroll-Isolated Main Content */}
        <div className="flex flex-1 min-w-0 flex-col overflow-hidden bg-surface">
          <Header onOpenMobile={() => setMobileOpen(true)} />

          <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            <motion.div
              key={pathname}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
              className="mx-auto h-full w-full max-w-[1600px]"
            >
              {children}
            </motion.div>
          </main>
        </div>

        <CommandPalette />
      </div>
    </RealtimeProvider>
  );
}
