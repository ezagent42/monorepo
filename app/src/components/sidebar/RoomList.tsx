'use client';

import { useMemo } from 'react';
import { useRoomStore } from '@/stores/room-store';
import { RoomItem } from './RoomItem';
import type { Room } from '@/types/room';

interface RoomListProps {
  searchQuery?: string;
}

function sortRooms(rooms: Room[]): Room[] {
  return [...rooms].sort((a, b) => {
    const aUnread = a.unread_count ?? 0;
    const bUnread = b.unread_count ?? 0;

    // Rooms with unread messages first
    if (aUnread > 0 && bUnread === 0) return -1;
    if (aUnread === 0 && bUnread > 0) return 1;

    // Then alphabetical by name
    return a.name.localeCompare(b.name);
  });
}

export function RoomList({ searchQuery }: RoomListProps) {
  const rooms = useRoomStore((state) => state.rooms);
  const activeRoomId = useRoomStore((state) => state.activeRoomId);
  const setActiveRoom = useRoomStore((state) => state.setActiveRoom);

  const filteredAndSorted = useMemo(() => {
    let result = rooms;

    if (searchQuery && searchQuery.trim().length > 0) {
      const query = searchQuery.toLowerCase();
      result = result.filter((room) =>
        room.name.toLowerCase().includes(query),
      );
    }

    return sortRooms(result);
  }, [rooms, searchQuery]);

  if (filteredAndSorted.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No rooms
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 p-2">
      {filteredAndSorted.map((room) => (
        <RoomItem
          key={room.room_id}
          room={room}
          isActive={room.room_id === activeRoomId}
          onClick={() => setActiveRoom(room.room_id)}
        />
      ))}
    </div>
  );
}
