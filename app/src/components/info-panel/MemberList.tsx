'use client';

import type { RoomMember } from '@/types';
import { usePresenceStore } from '@/stores/presence-store';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PresenceDot } from '../decorators/presence-dot';

interface MemberListProps {
  members: RoomMember[];
}

export function MemberList({ members }: MemberListProps) {
  const onlineUsers = usePresenceStore((s) => s.onlineUsers);

  // Check if a user is online in any room
  const isOnline = (entityId: string) =>
    Object.values(onlineUsers).some((users) => users.includes(entityId));

  // Sort: online first, then alphabetical
  const sorted = [...members].sort((a, b) => {
    const aOnline = isOnline(a.entity_id);
    const bOnline = isOnline(b.entity_id);
    if (aOnline !== bOnline) return aOnline ? -1 : 1;
    return a.display_name.localeCompare(b.display_name);
  });

  return (
    <div className="space-y-1" data-testid="member-list">
      <div className="text-xs font-medium text-muted-foreground px-2 py-1">
        Members ({members.length})
      </div>
      {sorted.map((member) => (
        <div
          key={member.entity_id}
          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50"
        >
          <div className="relative">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-xs">
                {member.display_name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <PresenceDot entityId={member.entity_id} />
          </div>
          <span className="text-sm truncate">{member.display_name}</span>
        </div>
      ))}
    </div>
  );
}
