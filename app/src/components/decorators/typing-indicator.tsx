'use client';

import { usePresenceStore } from '@/stores/presence-store';

interface TypingIndicatorProps {
  roomId: string;
}

const EMPTY: string[] = [];

export function TypingIndicator({ roomId }: TypingIndicatorProps) {
  const typingUsers = usePresenceStore((s) => s.typingUsers[roomId] ?? EMPTY);

  if (typingUsers.length === 0) return null;

  const names = typingUsers.map((id) => {
    const local = id.startsWith('@') ? id.slice(1).split(':')[0] : id;
    return local.charAt(0).toUpperCase() + local.slice(1);
  });

  const text = names.length === 1
    ? `${names[0]} is typing...`
    : `${names.join(', ')} are typing...`;

  return (
    <div className="text-xs text-muted-foreground px-4 py-1 animate-pulse" data-testid="typing-indicator">
      {text}
    </div>
  );
}
