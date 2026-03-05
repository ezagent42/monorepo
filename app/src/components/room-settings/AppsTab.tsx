'use client';

import { Button } from '@/components/ui/button';

interface AppsTabProps {
  roomId: string;
}

export function AppsTab({ roomId }: AppsTabProps) {
  return (
    <div className="flex flex-col gap-3 py-4" data-room-id={roomId}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Installed Apps</h4>
        <Button size="sm" variant="outline">Browse Catalog</Button>
      </div>
      <p className="text-sm text-muted-foreground">No apps installed yet. Browse the catalog to get started.</p>
    </div>
  );
}
