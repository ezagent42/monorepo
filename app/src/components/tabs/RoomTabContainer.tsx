'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { RoomTabConfig } from '@/types';

interface RoomTabContainerProps {
  roomId: string;
  tabs: RoomTabConfig[];
  children: React.ReactNode; // Default tab content (Timeline)
}

/**
 * Container that renders all tab panels at once but hides inactive ones
 * via CSS (`display: none`), preserving DOM state (scroll position, input
 * values, etc.) across tab switches.
 */
export function RoomTabContainer({ roomId, tabs, children }: RoomTabContainerProps) {
  const [activeTab, setActiveTab] = useState('messages');

  // Reset to messages tab when room changes
  useEffect(() => {
    setActiveTab('messages');
  }, [roomId]);

  if (tabs.length === 0) {
    // No custom tabs, just show the timeline
    return <>{children}</>;
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
      <TabsList className="mx-4 mt-2">
        <TabsTrigger value="messages">Messages</TabsTrigger>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.tab_label} value={tab.tab_label}>
            {tab.tab_icon && <span className="mr-1">{tab.tab_icon}</span>}
            {tab.tab_label}
          </TabsTrigger>
        ))}
      </TabsList>
      {/* Render all panels; hide inactive ones to preserve DOM state */}
      <div
        role="tabpanel"
        className="flex-1 flex flex-col mt-0"
        style={{ display: activeTab === 'messages' ? undefined : 'none' }}
        data-state={activeTab === 'messages' ? 'active' : 'inactive'}
        data-testid="tab-panel-messages"
      >
        {children}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.tab_label}
          role="tabpanel"
          className="flex-1 mt-0"
          style={{ display: activeTab === tab.tab_label ? undefined : 'none' }}
          data-state={activeTab === tab.tab_label ? 'active' : 'inactive'}
          data-testid={`tab-panel-${tab.tab_label}`}
        >
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            {tab.tab_label} view ({tab.layout})
          </div>
        </div>
      ))}
    </Tabs>
  );
}
