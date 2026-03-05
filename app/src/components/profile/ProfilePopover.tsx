'use client';

import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuthStore } from '@/stores/auth-store';
import { logout as logoutApi } from '@/lib/api/auth';
import { EditProfileDialog } from './EditProfileDialog';
import { SettingsDialog } from '@/components/settings/SettingsDialog';

export function ProfilePopover() {
  const session = useAuthStore((s) => s.session);
  const authLogout = useAuthStore((s) => s.logout);
  const [editOpen, setEditOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (!session) return null;

  const initials = session.display_name?.charAt(0).toUpperCase() ?? '?';

  const handleSignOut = async () => {
    try {
      await logoutApi();
    } catch { /* ignore */ }
    authLogout();
  };

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="flex items-center gap-2 w-full rounded-md p-2 hover:bg-muted text-left" aria-label="Profile menu">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{session.display_name}</p>
              <p className="text-xs text-muted-foreground truncate">{session.entity_id}</p>
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56" side="top" align="start">
          <div className="flex flex-col gap-1">
            <Button variant="ghost" className="justify-start" size="sm" onClick={() => setEditOpen(true)}>
              Edit Profile
            </Button>
            <Button variant="ghost" className="justify-start" size="sm" onClick={() => setSettingsOpen(true)}>
              Settings
            </Button>
            <Button variant="ghost" className="justify-start text-destructive" size="sm" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <EditProfileDialog open={editOpen} onOpenChange={setEditOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
