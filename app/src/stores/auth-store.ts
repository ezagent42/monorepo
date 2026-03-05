import { create } from 'zustand';
import type { AuthSession } from '@/types/identity';

interface AuthState {
  isAuthenticated: boolean;
  session: AuthSession | null;
  isLoading: boolean;
  login: (session: AuthSession) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  isAuthenticated: false,
  session: null,
  isLoading: false,
  login: (session) => set({ isAuthenticated: true, session }),
  logout: () => set({ isAuthenticated: false, session: null }),
  setLoading: (loading) => set({ isLoading: loading }),
}));
