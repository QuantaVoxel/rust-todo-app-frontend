import { create } from "zustand";

export type ViewMode = "list" | "board";
export type SmartView = "all" | "owned" | "shared" | "upcoming" | "archived";

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
  toggleSidebar: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setQuickCreateOpen: (open: boolean) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeTaskId: null,
  viewMode: "list",
  smartView: "all",
  sidebarCollapsed: false,
  commandPaletteOpen: false,
  quickCreateOpen: false,

  setActiveTaskId: (activeTaskId) => set({ activeTaskId }),
  setViewMode: (viewMode) => set({ viewMode }),
  setSmartView: (smartView) => set({ smartView }),
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setQuickCreateOpen: (quickCreateOpen) => set({ quickCreateOpen }),
}));
