'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CreateRoomDialog } from './CreateRoomDialog';
import { JoinByCodeDialog } from '@/components/invite/JoinByCodeDialog';
import { OnboardingHints } from './OnboardingHints';

export function EmptyState() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  return (
    <div
      data-testid="empty-state"
      className="flex flex-1 flex-col items-center justify-center gap-6 p-8"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">
          Welcome to EZAgent
        </h2>
        <p className="text-sm text-muted-foreground">
          Get started by creating a room or joining one with an invite code.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={() => setDialogOpen(true)}>
          Create a room
        </Button>
        <Button variant="outline" onClick={() => setJoinOpen(true)}>
          Enter invite code
        </Button>
      </div>

      <CreateRoomDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <JoinByCodeDialog open={joinOpen} onOpenChange={setJoinOpen} />
      <OnboardingHints />
    </div>
  );
}
