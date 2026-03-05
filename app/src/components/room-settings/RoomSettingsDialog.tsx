'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GeneralTab } from './GeneralTab';
import { MembersTab } from './MembersTab';
import { AppsTab } from './AppsTab';

interface RoomSettingsDialogProps {
  roomId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RoomSettingsDialog({ roomId, open, onOpenChange }: RoomSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Room Settings</DialogTitle>
          <DialogDescription>Configure room name, members, and installed apps.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="general">
          <TabsList className="w-full">
            <TabsTrigger value="general" className="flex-1">General</TabsTrigger>
            <TabsTrigger value="members" className="flex-1">Members</TabsTrigger>
            <TabsTrigger value="apps" className="flex-1">Apps</TabsTrigger>
          </TabsList>
          <TabsContent value="general">
            <GeneralTab roomId={roomId} onClose={() => onOpenChange(false)} />
          </TabsContent>
          <TabsContent value="members">
            <MembersTab roomId={roomId} />
          </TabsContent>
          <TabsContent value="apps">
            <AppsTab roomId={roomId} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
