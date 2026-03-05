'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { listSocialware } from '@/lib/api/socialware';
import { AppCatalogDialog } from '@/components/socialware/AppCatalogDialog';
import { AppDetailView } from '@/components/socialware/AppDetailView';
import type { SocialwareApp } from '@/types';

interface AppsTabProps {
  roomId: string;
}

export function AppsTab({ roomId }: AppsTabProps) {
  const [apps, setApps] = useState<SocialwareApp[]>([]);
  const [catalogOpen, setCatalogOpen] = useState(false);

  const loadApps = useCallback(() => {
    listSocialware().then(setApps).catch(() => {});
  }, []);

  useEffect(() => { loadApps(); }, [loadApps]);

  const handleStatusChange = (updated: SocialwareApp) => {
    setApps((prev) => prev.map((a) => a.id === updated.id ? updated : a));
  };

  const handleUninstalled = (swId: string) => {
    setApps((prev) => prev.filter((a) => a.id !== swId));
  };

  return (
    <div className="flex flex-col gap-3 py-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Installed Apps</h4>
        <Button size="sm" variant="outline" onClick={() => setCatalogOpen(true)}>Browse Catalog</Button>
      </div>
      {apps.length === 0 ? (
        <p className="text-sm text-muted-foreground">No apps installed yet. Browse the catalog to get started.</p>
      ) : (
        apps.map((app) => (
          <AppDetailView
            key={app.id}
            app={app}
            onStatusChange={handleStatusChange}
            onUninstalled={() => handleUninstalled(app.id)}
          />
        ))
      )}
      <AppCatalogDialog
        roomId={roomId}
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
        installedIds={apps.map((a) => a.id)}
        onInstalled={loadApps}
      />
    </div>
  );
}
