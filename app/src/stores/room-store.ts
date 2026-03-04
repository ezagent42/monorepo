import { create } from 'zustand';
import type { Room } from '@/types/room';

interface RoomState {
  rooms: Room[];
  activeRoomId: string | null;
  isLoading: boolean;
  setRooms: (rooms: Room[]) => void;
  addRoom: (room: Room) => void;
  setActiveRoom: (roomId: string) => void;
  updateRoom: (roomId: string, updates: Partial<Room>) => void;
  incrementUnread: (roomId: string) => void;
  clearUnread: (roomId: string) => void;
}

export const useRoomStore = create<RoomState>()((set) => ({
  rooms: [],
  activeRoomId: null,
  isLoading: false,
  setRooms: (rooms) => set({ rooms }),
  addRoom: (room) => set((state) => ({ rooms: [...state.rooms, room] })),
  setActiveRoom: (roomId) => set({ activeRoomId: roomId }),
  updateRoom: (roomId, updates) =>
    set((state) => ({
      rooms: state.rooms.map((r) =>
        r.room_id === roomId ? { ...r, ...updates } : r
      ),
    })),
  incrementUnread: (roomId) =>
    set((state) => ({
      rooms: state.rooms.map((r) =>
        r.room_id === roomId
          ? { ...r, unread_count: (r.unread_count ?? 0) + 1 }
          : r
      ),
    })),
  clearUnread: (roomId) =>
    set((state) => ({
      rooms: state.rooms.map((r) =>
        r.room_id === roomId ? { ...r, unread_count: 0 } : r
      ),
    })),
}));
