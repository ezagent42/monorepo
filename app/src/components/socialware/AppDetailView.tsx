'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { startSocialware, stopSocialware, uninstallSocialware } from '@/lib/api/socialware';
import type { SocialwareApp } from '@/types';

interface AppDetailViewProps {
  app: SocialwareApp;
  onUninstalled: () => void;
  onStatusChange: (app: SocialwareApp) => void;
}

export function AppDetailView({ app, onUninstalled, onStatusChange }: AppDetailViewProps) {
  const [loading, setLoading] = useState(false);
  const [confirmUninstall, setConfirmUninstall] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (app.status === 'running') {
        await stopSocialware(app.id);
        onStatusChange({ ...app, status: 'stopped' });
      } else {
        await startSocialware(app.id);
        onStatusChange({ ...app, status: 'running' });
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const handleUninstall = async () => {
    setLoading(true);
    try {
      await uninstallSocialware(app.id);
      onUninstalled();
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const sections = [
    { label: 'Commands', items: app.commands },
    { label: 'DataTypes', items: app.datatypes },
    { label: 'Roles', items: app.roles },
    { label: 'Room Tabs', items: app.room_tabs },
  ].filter((s) => s.items && s.items.length > 0);

  return (
    <div className="flex flex-col gap-3 rounded-md border p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium text-sm">{app.name}</h4>
          <p className="text-xs text-muted-foreground">v{app.version} · {app.status}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleToggle} disabled={loading}>
            {app.status === 'running' ? 'Stop' : 'Start'}
          </Button>
          {!confirmUninstall ? (
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => setConfirmUninstall(true)}>
              Uninstall
            </Button>
          ) : (
            <Button size="sm" variant="destructive" onClick={handleUninstall} disabled={loading}>
              Confirm
            </Button>
          )}
        </div>
      </div>
      {app.description && <p className="text-sm text-muted-foreground">{app.description}</p>}
      {sections.map((s) => (
        <div key={s.label}>
          <h5 className="text-xs font-medium text-muted-foreground mb-1">{s.label}</h5>
          <div className="flex flex-wrap gap-1">
            {s.items!.map((item) => (
              <span key={item} className="rounded bg-muted px-2 py-0.5 text-xs">{item}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
