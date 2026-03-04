'use client';

import { Sidebar } from '@/components/sidebar/Sidebar';
import { InfoPanel } from '@/components/info-panel/InfoPanel';
import { useUiStore } from '@/stores/ui-store';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const infoPanelOpen = useUiStore((s) => s.infoPanelOpen);

  return (
    <div className="flex h-screen overflow-hidden">
      {sidebarOpen && <Sidebar />}
      <main className="flex-1 min-w-0 flex flex-col">{children}</main>
      {infoPanelOpen && <InfoPanel />}
    </div>
  );
}
