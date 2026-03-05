'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RoomSettingsDialog } from '@/components/room-settings/RoomSettingsDialog';

interface RoomEmptyStateProps {
  roomId: string;
}

export function RoomEmptyState({ roomId }: RoomEmptyStateProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div data-testid="room-empty-state" className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <p className="text-sm text-muted-foreground text-center">
        This room is empty. Start a conversation or set up the room.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
          Invite Members
        </Button>
        <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
          Install Apps
        </Button>
      </div>
      <RoomSettingsDialog roomId={roomId} open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
