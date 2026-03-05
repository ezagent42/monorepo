'use client';

import { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getProfile } from '@/lib/api/profile';
import type { UserProfile } from '@/types';

interface ProfileCardProps {
  entityId: string;
  children: React.ReactNode;
}

export function ProfileCard({ entityId, children }: ProfileCardProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open && !profile) {
      getProfile(entityId).then(setProfile).catch(() => {});
    }
  }, [open, entityId, profile]);

  const initials = profile?.display_name?.charAt(0).toUpperCase() ?? '?';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64">
        {profile ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">{profile.display_name}</p>
                <p className="text-xs text-muted-foreground">{profile.entity_id}</p>
              </div>
            </div>
            {profile.bio && <p className="text-sm text-muted-foreground">{profile.bio}</p>}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Loading...</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
