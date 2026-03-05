'use client';

import { useEffect } from 'react';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { InfoPanel } from '@/components/info-panel/InfoPanel';
import { useUiStore } from '@/stores/ui-store';
import { useRoomStore } from '@/stores/room-store';
import { listRooms } from '@/lib/api/rooms';
import { registerWsHandlers } from '@/lib/ws/event-handlers';
import { wsClient } from '@/lib/ws/client';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const infoPanelOpen = useUiStore((s) => s.infoPanelOpen);
  const setRooms = useRoomStore((s) => s.setRooms);

  useEffect(() => {
    listRooms().then(setRooms).catch(() => {});
  }, [setRooms]);

  useEffect(() => {
    registerWsHandlers();
    wsClient.connect();
    return () => wsClient.disconnect();
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      {sidebarOpen && <Sidebar />}
      <main className="flex-1 min-w-0 flex flex-col">{children}</main>
      {infoPanelOpen && <InfoPanel />}
    </div>
  );
}
