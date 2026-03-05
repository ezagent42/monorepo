'use client';

import { useEffect } from 'react';
import { useRoomStore } from '@/stores/room-store';
import { useMessageStore } from '@/stores/message-store';
import { Timeline } from '@/components/chat/Timeline';
import { RoomHeader } from '@/components/chat/RoomHeader';
import { ComposeArea } from '@/components/chat/ComposeArea';
import { RoomEmptyState } from '@/components/chat/RoomEmptyState';
import { listMessages } from '@/lib/api/messages';

export default function ChatPage() {
  const activeRoomId = useRoomStore((s) => s.activeRoomId);
  const messages = useMessageStore((s) => activeRoomId ? s.messagesByRoom[activeRoomId] : undefined);
  const setMessages = useMessageStore((s) => s.setMessages);

  useEffect(() => {
    if (activeRoomId) {
      listMessages(activeRoomId, { limit: 50 }).then((msgs) => {
        setMessages(activeRoomId, msgs);
      }).catch(() => {
        // Handle error silently for now
      });
    }
  }, [activeRoomId, setMessages]);

  if (!activeRoomId) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Select a room to start chatting
      </div>
    );
  }

  const hasMessages = messages && messages.length > 0;

  return (
    <>
      <RoomHeader />
      {hasMessages ? (
        <Timeline roomId={activeRoomId} />
      ) : (
        <RoomEmptyState roomId={activeRoomId} />
      )}
      <ComposeArea roomId={activeRoomId} />
    </>
  );
}
