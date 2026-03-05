'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { listSocialware, installSocialware } from '@/lib/api/socialware';
import type { SocialwareApp } from '@/types';

interface AppCatalogDialogProps {
  roomId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  installedIds: string[];
  onInstalled: () => void;
}

export function AppCatalogDialog({ roomId, open, onOpenChange, installedIds, onInstalled }: AppCatalogDialogProps) {
  const [apps, setApps] = useState<SocialwareApp[]>([]);
  const [installing, setInstalling] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      listSocialware().then(setApps).catch(() => {});
    }
  }, [open]);

  const handleInstall = async (swId: string) => {
    setInstalling(swId);
    try {
      await installSocialware(swId, roomId);
      onInstalled();
    } catch {
      /* ignore */
    } finally {
      setInstalling(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>App Catalog</DialogTitle>
          <DialogDescription>Browse and install Socialware apps for this room.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 max-h-96 overflow-y-auto py-2">
          {apps.length === 0 && (
            <p className="text-sm text-muted-foreground">No apps available.</p>
          )}
          {apps.map((app) => {
            const isInstalled = installedIds.includes(app.id);
            return (
              <div key={app.id} className="flex items-center justify-between rounded-md border px-3 py-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{app.name}</span>
                    <span className="text-xs text-muted-foreground">v{app.version}</span>
                  </div>
                  {app.description && <p className="text-xs text-muted-foreground">{app.description}</p>}
                </div>
                <Button
                  size="sm"
                  variant={isInstalled ? 'outline' : 'default'}
                  disabled={isInstalled || installing === app.id}
                  onClick={() => handleInstall(app.id)}
                >
                  {isInstalled ? 'Installed' : installing === app.id ? 'Installing...' : 'Install'}
                </Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
