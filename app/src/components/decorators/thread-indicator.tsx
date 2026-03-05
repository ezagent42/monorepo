'use client';

import type { Message } from '@/types';

interface ThreadIndicatorProps {
  message: Message;
}

/**
 * Renders thread reply count and participants below a message.
 */
export function ThreadIndicator({ message }: ThreadIndicatorProps) {
  const thread = message.ext?.thread as {
    reply_count?: number;
    participants?: string[];
    last_reply_at?: string;
  } | undefined;

  if (!thread || !thread.reply_count) return null;

  const participants = thread.participants ?? [];
  const names = participants.map((p) => {
    // Extract display name from entity_id: "@alice:relay" -> "Alice"
    const local = p.startsWith('@') ? p.slice(1).split(':')[0] : p;
    return local.charAt(0).toUpperCase() + local.slice(1);
  });
  const nameStr = names.join(', ');

  return (
    <button
      className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-1"
      data-testid="thread-indicator"
      type="button"
    >
      <span>{thread.reply_count} {thread.reply_count === 1 ? 'reply' : 'replies'}</span>
      {nameStr && <span className="text-muted-foreground">{'\u2022'} {nameStr}</span>}
    </button>
  );
}
