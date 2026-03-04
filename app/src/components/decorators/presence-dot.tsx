'use client';

import { usePresenceStore } from '@/stores/presence-store';

interface PresenceDotProps {
  entityId: string;
}

export function PresenceDot({ entityId }: PresenceDotProps) {
  const isOnline = usePresenceStore((s) => {
    const rooms = s.onlineUsers;
    return Object.values(rooms).some((users) => users.includes(entityId));
  });

  if (!isOnline) return null;

  return (
    <span
      className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-background"
      data-testid="presence-dot"
    />
  );
}
