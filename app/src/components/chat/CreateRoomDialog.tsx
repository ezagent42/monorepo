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
import { createRoom } from '@/lib/api/rooms';
import { useRoomStore } from '@/stores/room-store';
import type { MembershipPolicy } from '@/types';

interface CreateRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateRoomDialog({ open, onOpenChange }: CreateRoomDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [policy, setPolicy] = useState<MembershipPolicy>('invite');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const addRoom = useRoomStore((state) => state.addRoom);
  const setActiveRoom = useRoomStore((state) => state.setActiveRoom);

  const handleCreate = async () => {
    // Validate
    if (!name.trim()) {
      setError('Room name is required');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const room = await createRoom({
        name: name.trim(),
        description: description.trim() || undefined,
        membership_policy: policy,
      });
      addRoom(room);
      setActiveRoom(room.room_id);

      // Reset form and close
      setName('');
      setDescription('');
      setPolicy('invite');
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isLoading) {
      if (!newOpen) {
        // Reset form on close
        setName('');
        setDescription('');
        setPolicy('invite');
        setError('');
      }
      onOpenChange(newOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Room</DialogTitle>
          <DialogDescription>
            Create a new room to start collaborating.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="room-name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="room-name"
              placeholder="Room name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              disabled={isLoading}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="room-description" className="text-sm font-medium">
              Description
            </label>
            <textarea
              id="room-description"
              placeholder="What is this room about? (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Access</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="policy"
                  value="invite"
                  checked={policy === 'invite'}
                  onChange={() => setPolicy('invite')}
                  disabled={isLoading}
                />
                Private — Invite only
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="policy"
                  value="open"
                  checked={policy === 'open'}
                  onChange={() => setPolicy('open')}
                  disabled={isLoading}
                />
                Public — Anyone can join
              </label>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
