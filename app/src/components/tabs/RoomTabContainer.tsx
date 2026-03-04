'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { RoomTabConfig } from '@/types';

interface RoomTabContainerProps {
  roomId: string;
  tabs: RoomTabConfig[];
  children: React.ReactNode; // Default tab content (Timeline)
}

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
      <TabsContent value="messages" className="flex-1 flex flex-col mt-0">
        {children}
      </TabsContent>
      {tabs.map((tab) => (
        <TabsContent key={tab.tab_label} value={tab.tab_label} className="flex-1 mt-0">
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            {tab.tab_label} view ({tab.layout})
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
