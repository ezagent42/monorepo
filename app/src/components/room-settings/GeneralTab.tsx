'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateRoom as updateRoomApi, leaveRoom } from '@/lib/api/rooms';
import { useRoomStore } from '@/stores/room-store';
import type { MembershipPolicy } from '@/types';

interface GeneralTabProps {
  roomId: string;
  onClose: () => void;
}

export function GeneralTab({ roomId, onClose }: GeneralTabProps) {
  const room = useRoomStore((s) => s.rooms.find((r) => r.room_id === roomId));
  const storeUpdateRoom = useRoomStore((s) => s.updateRoom);
  const removeRoom = useRoomStore((s) => s.removeRoom);

  const [name, setName] = useState(room?.name ?? '');
  const [description, setDescription] = useState(room?.description ?? '');
  const [policy, setPolicy] = useState<MembershipPolicy>(room?.membership_policy ?? 'invite');
  const [saving, setSaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  if (!room) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateRoomApi(roomId, {
        name: name.trim() || undefined,
        description: description.trim() || undefined,
        membership_policy: policy,
      });
      storeUpdateRoom(roomId, updated);
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  const handleLeave = async () => {
    try {
      await leaveRoom(roomId);
      removeRoom(roomId);
      onClose();
    } catch {
      /* ignore */
    }
  };

  const handleArchive = async () => {
    try {
      await updateRoomApi(roomId, { archived: true });
      storeUpdateRoom(roomId, { archived: true });
      onClose();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="settings-name" className="text-sm font-medium">Name</label>
        <Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="settings-desc" className="text-sm font-medium">Description</label>
        <textarea
          id="settings-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Access</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="settings-policy" value="invite" checked={policy === 'invite'} onChange={() => setPolicy('invite')} />
            Private
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="settings-policy" value="open" checked={policy === 'open'} onChange={() => setPolicy('open')} />
            Public
          </label>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>

      <div className="border-t pt-4 flex flex-col gap-2">
        {!confirmLeave ? (
          <Button variant="outline" className="text-destructive" onClick={() => setConfirmLeave(true)}>Leave Room</Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="destructive" onClick={handleLeave}>Confirm Leave</Button>
            <Button variant="outline" onClick={() => setConfirmLeave(false)}>Cancel</Button>
          </div>
        )}
        <Button variant="outline" onClick={handleArchive}>Archive Room</Button>
      </div>
    </div>
  );
}
