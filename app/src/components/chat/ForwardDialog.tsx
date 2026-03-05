'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { sendMessage } from '@/lib/api/messages';
import { useRoomStore } from '@/stores/room-store';
import type { Message } from '@/types';

interface ForwardDialogProps {
  message: Message | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ForwardDialog({ message, open, onOpenChange }: ForwardDialogProps) {
  const rooms = useRoomStore((s) => s.rooms);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [forwarding, setForwarding] = useState(false);

  if (!message) return null;

  const handleForward = async () => {
    if (!selectedRoomId) return;
    setForwarding(true);
    try {
      await sendMessage(selectedRoomId, {
        body: message.body,
        ext: {
          forwarded_from: {
            room_id: message.room_id,
            ref_id: message.ref_id,
            author: message.author,
          },
        },
      });
      onOpenChange(false);
      setSelectedRoomId(null);
    } catch {
      /* ignore */
    } finally {
      setForwarding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Forward Message</DialogTitle>
          <DialogDescription>Choose a room to forward to.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto py-2">
          {rooms
            .filter((r) => r.room_id !== message.room_id)
            .map((room) => (
              <button
                key={room.room_id}
                type="button"
                onClick={() => setSelectedRoomId(room.room_id)}
                className={`rounded-md border px-3 py-2 text-left text-sm ${selectedRoomId === room.room_id ? 'border-primary bg-primary/10' : ''}`}
              >
                {room.name}
              </button>
            ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleForward} disabled={!selectedRoomId || forwarding}>
            {forwarding ? 'Forwarding...' : 'Forward'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
