'use client';

import type { Message } from '@/types';

interface PinnedMessagesProps {
  messages: Message[];
}

export function PinnedMessages({ messages }: PinnedMessagesProps) {
  const pinned = messages.filter((m) => m.annotations?.pinned);

  if (pinned.length === 0) {
    return (
      <div className="text-xs text-muted-foreground px-2 py-1">No pinned messages</div>
    );
  }

  return (
    <div className="space-y-2" data-testid="pinned-messages">
      <div className="text-xs font-medium text-muted-foreground px-2 py-1">
        Pinned ({pinned.length})
      </div>
      {pinned.map((msg) => (
        <div key={msg.ref_id} className="px-2 py-1.5 rounded-md border text-sm">
          <div className="font-medium text-xs text-muted-foreground">{msg.author}</div>
          <div className="truncate">{msg.body}</div>
        </div>
      ))}
    </div>
  );
}
