import { create } from 'zustand';
import type { RendererConfig } from '@/types/renderer';

interface RendererState {
  rendererConfigs: Record<string, RendererConfig[]>;
  isLoading: boolean;
  setRenderers: (roomId: string, configs: RendererConfig[]) => void;
  getRenderers: (roomId: string) => RendererConfig[];
}

export const useRendererStore = create<RendererState>()((set, get) => ({
  rendererConfigs: {},
  isLoading: false,

  setRenderers: (roomId, configs) =>
    set((state) => ({
      rendererConfigs: { ...state.rendererConfigs, [roomId]: configs },
    })),

  getRenderers: (roomId) => get().rendererConfigs[roomId] ?? [],
}));
