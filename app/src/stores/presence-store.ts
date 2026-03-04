import { create } from 'zustand';

interface PresenceState {
  onlineUsers: Record<string, string[]>;
  typingUsers: Record<string, string[]>;
  /** Internal map of typing timeout IDs — not part of public state contract */
  _typingTimeouts: Record<string, ReturnType<typeof setTimeout>>;
  setOnline: (roomId: string, userId: string) => void;
  setOffline: (roomId: string, userId: string) => void;
  setTyping: (roomId: string, userId: string) => void;
  clearTyping: (roomId: string, userId: string) => void;
}

const TYPING_TIMEOUT_MS = 3000;

/** Build a timeout key for the typing timer map */
const typingKey = (roomId: string, userId: string) => `${roomId}::${userId}`;

export const usePresenceStore = create<PresenceState>()((set, get) => ({
  onlineUsers: {},
  typingUsers: {},
  _typingTimeouts: {},

  setOnline: (roomId, userId) =>
    set((state) => {
      const current = state.onlineUsers[roomId] ?? [];
      if (current.includes(userId)) return state;
      return {
        onlineUsers: { ...state.onlineUsers, [roomId]: [...current, userId] },
      };
    }),

  setOffline: (roomId, userId) =>
    set((state) => {
      const current = state.onlineUsers[roomId];
      if (!current) return state;
      return {
        onlineUsers: {
          ...state.onlineUsers,
          [roomId]: current.filter((id) => id !== userId),
        },
      };
    }),

  setTyping: (roomId, userId) => {
    const key = typingKey(roomId, userId);

    // Clear any existing timeout for this user/room combo
    const existing = get()._typingTimeouts[key];
    if (existing) clearTimeout(existing);

    // Set a new timeout that auto-clears after 3 seconds
    const timeoutId = setTimeout(() => {
      get().clearTyping(roomId, userId);
    }, TYPING_TIMEOUT_MS);

    set((state) => {
      const current = state.typingUsers[roomId] ?? [];
      const updatedTyping = current.includes(userId)
        ? current
        : [...current, userId];
      return {
        typingUsers: { ...state.typingUsers, [roomId]: updatedTyping },
        _typingTimeouts: { ...state._typingTimeouts, [key]: timeoutId },
      };
    });
  },

  clearTyping: (roomId, userId) => {
    const key = typingKey(roomId, userId);

    // Clear any pending timeout
    const existing = get()._typingTimeouts[key];
    if (existing) clearTimeout(existing);

    set((state) => {
      const current = state.typingUsers[roomId];
      if (!current) return state;
      const { [key]: _removed, ...remainingTimeouts } = state._typingTimeouts;
      return {
        typingUsers: {
          ...state.typingUsers,
          [roomId]: current.filter((id) => id !== userId),
        },
        _typingTimeouts: remainingTimeouts,
      };
    });
  },
}));
