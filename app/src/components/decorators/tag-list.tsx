'use client';

import type { Message } from '@/types';

interface TagListProps {
  message: Message;
}

/**
 * Renders channel tags below a message.
 */
export function TagList({ message }: TagListProps) {
  const channels = message.ext?.channels as string[] | undefined;
  if (!channels || channels.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1" data-testid="tag-list">
      {channels.map((ch) => (
        <button
          key={ch}
          className="text-xs text-primary hover:underline"
          type="button"
        >
          #{ch}
        </button>
      ))}
    </div>
  );
}
