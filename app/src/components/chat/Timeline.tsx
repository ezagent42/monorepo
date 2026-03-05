'use client';

import { useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useMessageStore } from '@/stores/message-store';
import { MessageBubble } from './MessageBubble';
import type { Message } from '@/types';

const EMPTY_MESSAGES: Message[] = [];

interface TimelineProps {
  roomId: string;
}

export function Timeline({ roomId }: TimelineProps) {
  const messages = useMessageStore((s) => s.messagesByRoom[roomId] ?? EMPTY_MESSAGES);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        No messages yet
      </div>
    );
  }

  return <VirtualizedList messages={messages} />;
}

/**
 * Inner component that uses the virtualizer hook.
 * Separated to avoid calling the hook when there are no messages
 * (which causes infinite loops in jsdom due to missing scroll container).
 */
function VirtualizedList({ messages }: { messages: Message[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72, // estimated row height
    overscan: 10,
  });

  // Store scrollToIndex in a ref to avoid dependency on virtualizer object
  const scrollToIndexRef = useRef(virtualizer.scrollToIndex);
  scrollToIndexRef.current = virtualizer.scrollToIndex;

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      scrollToIndexRef.current(messages.length - 1, { align: 'end' });
    }
  }, [messages.length]);

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div ref={parentRef} className="flex-1 overflow-auto" data-testid="timeline-scroll">
      <div
        style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}
      >
        {virtualItems.length > 0 ? (
          virtualItems.map((virtualItem) => (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
            >
              <MessageBubble message={messages[virtualItem.index]} />
            </div>
          ))
        ) : (
          // Fallback: render all messages when virtualizer can't measure (e.g., in tests)
          messages.map((msg) => (
            <MessageBubble key={msg.ref_id} message={msg} />
          ))
        )}
      </div>
    </div>
  );
}
