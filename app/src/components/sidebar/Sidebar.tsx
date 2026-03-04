'use client';

import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { SearchBar } from './SearchBar';
import { ChannelList } from './ChannelList';

export function Sidebar() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <aside className="w-64 border-r bg-muted/40 flex flex-col">
      <div className="h-12 flex items-center px-4 font-semibold border-b">
        ezagent
      </div>
      <SearchBar value={searchQuery} onChange={setSearchQuery} />
      <Separator />
      <ScrollArea className="flex-1">
        <ChannelList searchQuery={searchQuery} />
      </ScrollArea>
    </aside>
  );
}
