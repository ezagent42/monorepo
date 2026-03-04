'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Room } from '@/types/room';

interface RoomItemProps {
  room: Room;
  isActive: boolean;
  onClick: () => void;
}

export function RoomItem({ room, isActive, onClick }: RoomItemProps) {
  const unread = room.unread_count ?? 0;
  const initial = room.name.charAt(0).toUpperCase();

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors',
        'hover:bg-accent/50',
        isActive && 'bg-accent text-accent-foreground',
      )}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="text-xs">{initial}</AvatarFallback>
      </Avatar>
      <span className="flex-1 truncate">{room.name}</span>
      {unread > 0 && (
        <Badge variant="default" className="ml-auto h-5 min-w-[20px] justify-center px-1.5">
          {unread}
        </Badge>
      )}
    </button>
  );
}
