'use client';

import { useEffect } from 'react';
import { useRoomStore } from '@/stores/room-store';
import { useMessageStore } from '@/stores/message-store';
import { Timeline } from '@/components/chat/Timeline';
import { RoomHeader } from '@/components/chat/RoomHeader';
import { ComposeArea } from '@/components/chat/ComposeArea';
import { listMessages } from '@/lib/api/messages';

export default function ChatPage() {
  const activeRoomId = useRoomStore((s) => s.activeRoomId);
  const setMessages = useMessageStore((s) => s.setMessages);

  useEffect(() => {
    if (activeRoomId) {
      listMessages(activeRoomId, { limit: 50 }).then((messages) => {
        setMessages(activeRoomId, messages);
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

  return (
    <>
      <RoomHeader />
      <Timeline roomId={activeRoomId} />
      <ComposeArea roomId={activeRoomId} />
    </>
  );
}
