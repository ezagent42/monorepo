'use client';

import { useState } from 'react';
import { useRoomStore } from '@/stores/room-store';
import { Button } from '@/components/ui/button';
import { useUiStore } from '@/stores/ui-store';
import { RoomSettingsDialog } from '@/components/room-settings/RoomSettingsDialog';

export function RoomHeader() {
  const activeRoomId = useRoomStore((s) => s.activeRoomId);
  const rooms = useRoomStore((s) => s.rooms);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const toggleInfoPanel = useUiStore((s) => s.toggleInfoPanel);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const activeRoom = rooms.find((r) => r.room_id === activeRoomId);
  if (!activeRoom) return null;

  return (
    <div className="h-12 border-b flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={toggleSidebar} aria-label="Toggle sidebar">
          {'\u2630'}
        </Button>
        <h2 className="font-semibold">{activeRoom.name}</h2>
        <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)} aria-label="Room settings">
          {'\u2699'}
        </Button>
      </div>
      <Button variant="ghost" size="sm" onClick={toggleInfoPanel} aria-label="Toggle info panel">
        {'\u2139'}
      </Button>
      <RoomSettingsDialog roomId={activeRoom.room_id} open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
