import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

interface UiState {
  sidebarOpen: boolean;
  infoPanelOpen: boolean;
  theme: Theme;
  toggleSidebar: () => void;
  toggleInfoPanel: () => void;
  setTheme: (theme: Theme) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  sidebarOpen: true,
  infoPanelOpen: false,
  theme: 'system',
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleInfoPanel: () => set((state) => ({ infoPanelOpen: !state.infoPanelOpen })),
  setTheme: (theme) => set({ theme }),
}));
