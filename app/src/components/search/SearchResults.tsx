'use client';

import { useState, useEffect } from 'react';
import { useRoomStore } from '@/stores/room-store';
import { searchMessages, searchPeople } from '@/lib/api/search';
import type { Message } from '@/types';
import type { UserProfile } from '@/types/profile';

interface SearchResultsProps {
  query: string;
  roomId?: string | null;
  onClose: () => void;
}

export function SearchResults({ query, roomId, onClose }: SearchResultsProps) {
  const rooms = useRoomStore((s) => s.rooms);
  const setActiveRoom = useRoomStore((s) => s.setActiveRoom);
  const [messages, setMessages] = useState<Array<Message & { room_name: string }>>([]);
  const [people, setPeople] = useState<UserProfile[]>([]);

  // Debounced API search
  useEffect(() => {
    if (query.length < 2) {
      setMessages([]);
      setPeople([]);
      return;
    }

    const timer = setTimeout(() => {
      searchMessages(query, roomId ?? undefined).then((r) => setMessages(r.messages)).catch(() => {});
      searchPeople(query).then((r) => setPeople(r.entities)).catch(() => {});
    }, 300);

    return () => clearTimeout(timer);
  }, [query, roomId]);

  // Local room filter
  const filteredRooms = query.length >= 1
    ? rooms.filter((r) => r.name.toLowerCase().includes(query.toLowerCase()))
    : [];

  if (!query) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Type to search rooms, people, and messages.
      </div>
    );
  }

  const hasResults = filteredRooms.length > 0 || people.length > 0 || messages.length > 0;

  return (
    <div className="flex flex-col">
      {filteredRooms.length > 0 && (
        <div>
          <h4 className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Rooms</h4>
          {filteredRooms.map((r) => (
            <button
              key={r.room_id}
              type="button"
              className="w-full px-4 py-2 text-left text-sm hover:bg-muted"
              onClick={() => { setActiveRoom(r.room_id); onClose(); }}
            >
              {r.name}
            </button>
          ))}
        </div>
      )}
      {people.length > 0 && (
        <div>
          <h4 className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase">People</h4>
          {people.map((p) => (
            <div key={p.entity_id} className="px-4 py-2 text-sm">
              {p.display_name} <span className="text-muted-foreground">{p.entity_id}</span>
            </div>
          ))}
        </div>
      )}
      {messages.length > 0 && (
        <div>
          <h4 className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Messages</h4>
          {messages.map((m) => (
            <button
              key={m.ref_id}
              type="button"
              className="w-full px-4 py-2 text-left text-sm hover:bg-muted"
              onClick={() => { setActiveRoom(m.room_id); onClose(); }}
            >
              <span className="font-medium">{m.author}</span> in {m.room_name}: {m.body.slice(0, 80)}
            </button>
          ))}
        </div>
      )}
      {!hasResults && query.length >= 2 && (
        <div className="p-4 text-sm text-muted-foreground">No results found.</div>
      )}
    </div>
  );
}
