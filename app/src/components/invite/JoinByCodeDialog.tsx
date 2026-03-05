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
import { Input } from '@/components/ui/input';
import { joinByInviteCode } from '@/lib/api/invite';
import { listRooms } from '@/lib/api/rooms';
import { useRoomStore } from '@/stores/room-store';

interface JoinByCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JoinByCodeDialog({ open, onOpenChange }: JoinByCodeDialogProps) {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const setRooms = useRoomStore((s) => s.setRooms);
  const setActiveRoom = useRoomStore((s) => s.setActiveRoom);

  const handleJoin = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setError('Invite code is required');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const result = await joinByInviteCode(trimmed);
      // Refresh rooms list to include the newly joined room
      const rooms = await listRooms();
      setRooms(rooms);
      setActiveRoom(result.room_id);
      setCode('');
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired invite code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isLoading) {
      if (!newOpen) {
        setCode('');
        setError('');
      }
      onOpenChange(newOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join Room</DialogTitle>
          <DialogDescription>Enter an invite code to join a room.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <Input
            placeholder="Enter invite code"
            value={code}
            onChange={(e) => { setCode(e.target.value); if (error) setError(''); }}
            disabled={isLoading}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>Cancel</Button>
          <Button onClick={handleJoin} disabled={isLoading}>{isLoading ? 'Joining...' : 'Join'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
