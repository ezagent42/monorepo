'use client';

import { useState, useEffect } from 'react';
import { getRoomMembers } from '@/lib/api/rooms';
import type { RoomMember } from '@/types';

interface MembersTabProps {
  roomId: string;
}

export function MembersTab({ roomId }: MembersTabProps) {
  const [members, setMembers] = useState<RoomMember[]>([]);

  useEffect(() => {
    getRoomMembers(roomId).then(setMembers).catch(() => {});
  }, [roomId]);

  return (
    <div className="flex flex-col gap-3 py-4">
      <h4 className="text-sm font-medium">Members ({members.length})</h4>
      {members.map((m) => (
        <div key={m.entity_id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs">
              {m.display_name.charAt(0).toUpperCase()}
            </div>
            <span>{m.display_name}</span>
          </div>
          <span className="text-xs text-muted-foreground">{m.roles.join(', ')}</span>
        </div>
      ))}
      {/* Invite Code section will be wired in Task 6 */}
    </div>
  );
}
