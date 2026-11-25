import { create } from "zustand";

export type ViewMode = "list" | "board";
export type SmartView = "all" | "owned" | "shared" | "upcoming" | "archived";

const SIDEBAR_STORAGE_KEY = "todo_sidebar_collapsed";

interface WorkspaceState {
  activeTaskId: number | null;
  viewMode: ViewMode;
  smartView: SmartView;
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  quickCreateOpen: boolean;

  setActiveTaskId: (id: number | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setSmartView: (view: SmartView) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setQuickCreateOpen: (open: boolean) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeTaskId: null,
  viewMode: "board",
  smartView: "all",
  sidebarCollapsed: false,
  commandPaletteOpen: false,
  quickCreateOpen: false,

  setActiveTaskId: (activeTaskId) => set({ activeTaskId }),
  setViewMode: (viewMode) => set({ viewMode }),
  setSmartView: (smartView) => set({ smartView }),
  setSidebarCollapsed: (sidebarCollapsed) => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(
          SIDEBAR_STORAGE_KEY,
          String(sidebarCollapsed)
        );
      } catch {
        // ignore storage errors
      }
    }
    set({ sidebarCollapsed });
  },
  toggleSidebar: () =>
    set((state) => {
      const next = !state.sidebarCollapsed;
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
        } catch {
          // ignore storage errors
        }
      }
      return { sidebarCollapsed: next };
    }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setQuickCreateOpen: (quickCreateOpen) => set({ quickCreateOpen }),
}));
