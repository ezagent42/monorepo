'use client';

import type { Message } from '@/types';

interface EmojiBarProps {
  message: Message;
}

/**
 * Renders reaction emoji counts below a message.
 * Reactions are stored in ext.reactions as { "emoji:entity_id": timestamp }
 */
export function EmojiBar({ message }: EmojiBarProps) {
  const reactions = (message.ext?.reactions ?? {}) as Record<string, unknown>;
  if (Object.keys(reactions).length === 0) return null;

  // Group by emoji: { "\ud83d\udc4d": 2, "\u2764\ufe0f": 1 }
  const counts: Record<string, number> = {};
  for (const key of Object.keys(reactions)) {
    const emoji = key.split(':')[0];
    counts[emoji] = (counts[emoji] ?? 0) + 1;
  }

  return (
    <div className="flex gap-1.5 mt-1" data-testid="emoji-bar">
      {Object.entries(counts).map(([emoji, count]) => (
        <button
          key={emoji}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs bg-muted hover:bg-muted/80 transition-colors"
          type="button"
        >
          <span>{emoji}</span>
          <span className="text-muted-foreground">{count}</span>
        </button>
      ))}
    </div>
  );
}
