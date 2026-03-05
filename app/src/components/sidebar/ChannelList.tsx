'use client';

import { RoomList } from './RoomList';

interface ChannelListProps {
  searchQuery?: string;
}

export function ChannelList({ searchQuery }: ChannelListProps) {
  return (
    <div className="flex flex-col">
      <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Rooms
      </div>
      <RoomList searchQuery={searchQuery} />
    </div>
  );
}
