'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useUiStore } from '@/stores/ui-store';

export function InfoPanel() {
  const toggleInfoPanel = useUiStore((s) => s.toggleInfoPanel);

  return (
    <aside className="w-72 border-l bg-muted/40 flex flex-col">
      <div className="h-12 flex items-center justify-between px-4 border-b">
        <span className="font-semibold text-sm">Details</span>
        <Button variant="ghost" size="sm" onClick={toggleInfoPanel}>
          ✕
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 text-sm text-muted-foreground">
          Room details will appear here
        </div>
      </ScrollArea>
    </aside>
  );
}
