'use client';

import { ScrollArea } from '@/components/ui/scroll-area';

export function Sidebar() {
  return (
    <aside className="w-64 border-r bg-muted/40 flex flex-col">
      <div className="h-12 flex items-center px-4 font-semibold border-b">
        ezagent
      </div>
      <ScrollArea className="flex-1">
        {/* RoomList will be added in Task 12 */}
        {/* ChannelList will be added in Task 13 */}
        <div className="p-4 text-sm text-muted-foreground">No rooms yet</div>
      </ScrollArea>
    </aside>
  );
}
