'use client';

import type { Message } from '@/types';
import { MessageBubble } from '../chat/MessageBubble';
import { ComposeArea } from '../chat/ComposeArea';

interface ThreadPanelProps {
  parentMessage: Message;
  replies: Message[];
  roomId: string;
  onClose: () => void;
}

/**
 * Thread panel — shows parent message + replies in a dedicated panel.
 * Replaces the info panel when a thread indicator is clicked.
 */
export function ThreadPanel({ parentMessage, replies, roomId, onClose }: ThreadPanelProps) {
  return (
    <div className="flex flex-col h-full" data-testid="thread-panel">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold text-sm">Thread</h3>
        <button
          className="text-muted-foreground hover:text-foreground text-sm"
          onClick={onClose}
          type="button"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="border-b pb-2">
          <MessageBubble message={parentMessage} />
        </div>
        <div className="pt-2">
          {replies.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              No replies yet
            </div>
          ) : (
            replies.map((reply) => (
              <MessageBubble key={reply.ref_id} message={reply} />
            ))
          )}
        </div>
      </div>
      <div className="border-t">
        <ComposeArea roomId={roomId} />
      </div>
    </div>
  );
}
