# App Operations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the 42 TCs from `docs/products/app-operations-spec.md` — user operations layer (room CRUD, invite codes, Socialware catalog, message ops, profile/settings, search).

**Architecture:** Extend existing Zustand stores + API layer + shadcn/ui components. Each task group adds: types → API functions → store actions → UI components → tests. All API calls go to `localhost:6142` (local HTTP server). No Relay-facing code (Engine handles Relay internally).

**Tech Stack:** TypeScript, React, Next.js (App Router, static export), Zustand, shadcn/ui, Tailwind CSS, Vitest + React Testing Library.

**Test runner:** `cd app && pnpm test` (Vitest). Tests in `__tests__/` colocated with components.

**Spec reference:** `docs/products/app-operations-spec.md` (42 TCs)

---

## Task 1: Extend Types for Operations

**Files:**
- Modify: `app/src/types/room.ts`
- Modify: `app/src/types/message.ts`
- Create: `app/src/types/invite.ts`
- Create: `app/src/types/socialware.ts`
- Create: `app/src/types/profile.ts`
- Modify: `app/src/types/index.ts`

**Step 1: Add Room operation types**

In `app/src/types/room.ts`, add:

```typescript
export type MembershipPolicy = 'open' | 'knock' | 'invite';

export interface CreateRoomParams {
  name: string;
  description?: string;
  membership_policy?: MembershipPolicy;
}

export interface UpdateRoomParams {
  name?: string;
  description?: string;
  membership_policy?: MembershipPolicy;
  archived?: boolean;
}
```

And extend `Room` interface with `description?: string`, `membership_policy?: MembershipPolicy`, `archived?: boolean`.

**Step 2: Create invite types**

Create `app/src/types/invite.ts`:

```typescript
export interface InviteCode {
  code: string;
  room_id: string;
  created_by: string;
  created_at: string;
  expires_at: string;
  use_count: number;
  invite_uri: string;
}

export interface JoinByInviteResult {
  room_id: string;
  room_name: string;
}
```

**Step 3: Create socialware types**

Create `app/src/types/socialware.ts`:

```typescript
export interface SocialwareApp {
  id: string;
  name: string;
  version: string;
  status: 'running' | 'stopped';
  identity?: string;
  description?: string;
  commands?: string[];
  datatypes?: string[];
  roles?: string[];
  room_tabs?: string[];
}
```

**Step 4: Create profile types**

Create `app/src/types/profile.ts`:

```typescript
export interface UserProfile {
  entity_id: string;
  display_name: string;
  bio?: string;
  avatar_url?: string;
  avatar_blob_hash?: string;
}

export interface UpdateProfileParams {
  display_name?: string;
  bio?: string;
  avatar_blob_hash?: string;
}
```

**Step 5: Update barrel export**

Add new types to `app/src/types/index.ts`.

**Step 6: Commit**

```
feat(app): add types for operations spec (room, invite, socialware, profile)
```

---

## Task 2: Extend API Layer

**Files:**
- Modify: `app/src/lib/api/rooms.ts`
- Modify: `app/src/lib/api/messages.ts`
- Create: `app/src/lib/api/invite.ts`
- Create: `app/src/lib/api/socialware.ts`
- Create: `app/src/lib/api/profile.ts`
- Create: `app/src/lib/api/search.ts`

**Step 1: Extend rooms API**

In `app/src/lib/api/rooms.ts`, update `createRoom` signature and add:

```typescript
export function createRoom(body: CreateRoomParams): Promise<Room> { ... }
export function updateRoom(roomId: string, body: UpdateRoomParams): Promise<Room> { ... }
export function leaveRoom(roomId: string): Promise<void> { ... }
```

**Step 2: Extend messages API**

In `app/src/lib/api/messages.ts`, add:

```typescript
export function editMessage(roomId: string, refId: string, body: { body: string }): Promise<void> {
  return api.put(`/api/rooms/${roomId}/messages/${refId}`, body);
}

export function deleteMessage(roomId: string, refId: string): Promise<void> {
  return api.delete(`/api/rooms/${roomId}/messages/${refId}`);
}

export function removeReaction(roomId: string, refId: string, emoji: string): Promise<void> {
  return api.delete(`/api/rooms/${roomId}/messages/${refId}/reactions/${encodeURIComponent(emoji)}`);
}

export function moderateMessage(roomId: string, body: { action: string; ref_id: string }): Promise<void> {
  return api.post(`/api/rooms/${roomId}/moderation`, body);
}
```

**Step 3: Create invite API**

Create `app/src/lib/api/invite.ts`:

```typescript
import { api } from './client';
import type { InviteCode, JoinByInviteResult } from '@/types';

export function generateInviteCode(roomId: string): Promise<InviteCode> {
  return api.post(`/api/rooms/${roomId}/invite`);
}

export function listInviteCodes(roomId: string): Promise<InviteCode[]> {
  return api.get(`/api/rooms/${roomId}/invite`);
}

export function revokeInviteCode(roomId: string, code: string): Promise<void> {
  return api.delete(`/api/rooms/${roomId}/invite/${code}`);
}

export function joinByInviteCode(code: string): Promise<JoinByInviteResult> {
  return api.post(`/api/invite/${code}`);
}
```

**Step 4: Create socialware API**

Create `app/src/lib/api/socialware.ts`:

```typescript
import { api } from './client';
import type { SocialwareApp } from '@/types';

export function listSocialware(): Promise<SocialwareApp[]> {
  return api.get('/api/socialware');
}

export function getSocialwareDetail(swId: string): Promise<SocialwareApp> {
  return api.get(`/api/socialware/${swId}`);
}

export function installSocialware(swId: string, roomId: string): Promise<void> {
  return api.post('/api/socialware/install', { sw_id: swId, room_id: roomId });
}

export function uninstallSocialware(swId: string): Promise<void> {
  return api.delete(`/api/socialware/${swId}`);
}

export function startSocialware(swId: string): Promise<void> {
  return api.post(`/api/socialware/${swId}/start`);
}

export function stopSocialware(swId: string): Promise<void> {
  return api.post(`/api/socialware/${swId}/stop`);
}
```

**Step 5: Create profile API**

Create `app/src/lib/api/profile.ts`:

```typescript
import { api } from './client';
import type { UserProfile, UpdateProfileParams } from '@/types';

export function getProfile(entityId: string): Promise<UserProfile> {
  return api.get(`/api/identity/${entityId}/profile`);
}

export function updateProfile(entityId: string, body: UpdateProfileParams): Promise<UserProfile> {
  return api.put(`/api/identity/${entityId}/profile`, body);
}
```

**Step 6: Create search API**

Create `app/src/lib/api/search.ts`:

```typescript
import { api } from './client';
import type { Message, Room } from '@/types';
import type { UserProfile } from '@/types/profile';

export interface SearchMessagesResult {
  messages: Array<Message & { room_name: string }>;
}

export interface SearchPeopleResult {
  entities: UserProfile[];
}

export function searchMessages(query: string, roomId?: string): Promise<SearchMessagesResult> {
  const path = roomId
    ? `/api/rooms/${roomId}/messages/search?q=${encodeURIComponent(query)}`
    : `/api/search/messages?q=${encodeURIComponent(query)}`;
  return api.get(path);
}

export function searchPeople(query: string): Promise<SearchPeopleResult> {
  return api.post('/api/ext/discovery/search', { query, type: 'entity' });
}
```

**Step 7: Commit**

```
feat(app): extend API layer for operations spec (invite, socialware, profile, search, message ops)
```

---

## Task 3: Extend Room Store + Add Remove Action to Message Store

**Files:**
- Modify: `app/src/stores/room-store.ts`
- Modify: `app/src/stores/message-store.ts`

**Step 1: Add removeRoom and updateRoom to room-store**

```typescript
// Add to RoomState interface:
removeRoom: (roomId: string) => void;

// Add to store:
removeRoom: (roomId) =>
  set((state) => ({
    rooms: state.rooms.filter((r) => r.room_id !== roomId),
    activeRoomId: state.activeRoomId === roomId ? null : state.activeRoomId,
  })),
```

**Step 2: Add message operations to message-store**

```typescript
// Add to MessageState interface:
updateMessage: (roomId: string, refId: string, updates: Partial<Message>) => void;
removeMessage: (roomId: string, refId: string) => void;

// Implementations:
updateMessage: (roomId, refId, updates) =>
  set((state) => {
    const roomMessages = state.messagesByRoom[roomId];
    if (!roomMessages) return state;
    return {
      messagesByRoom: {
        ...state.messagesByRoom,
        [roomId]: roomMessages.map((msg) =>
          msg.ref_id === refId ? { ...msg, ...updates } : msg
        ),
      },
    };
  }),

removeMessage: (roomId, refId) =>
  set((state) => {
    const roomMessages = state.messagesByRoom[roomId];
    if (!roomMessages) return state;
    return {
      messagesByRoom: {
        ...state.messagesByRoom,
        [roomId]: roomMessages.filter((msg) => msg.ref_id !== refId),
      },
    };
  }),
```

**Step 3: Write tests for new store actions**

Create `app/src/stores/__tests__/room-store-ops.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useRoomStore } from '../room-store';

describe('room-store operations', () => {
  beforeEach(() => {
    useRoomStore.setState(useRoomStore.getInitialState());
  });

  it('removeRoom removes room and clears activeRoomId if active', () => {
    useRoomStore.setState({
      rooms: [
        { room_id: 'r1', name: 'Room 1', members: [], config: {}, enabled_extensions: [] },
        { room_id: 'r2', name: 'Room 2', members: [], config: {}, enabled_extensions: [] },
      ],
      activeRoomId: 'r1',
    });
    useRoomStore.getState().removeRoom('r1');
    const state = useRoomStore.getState();
    expect(state.rooms).toHaveLength(1);
    expect(state.activeRoomId).toBeNull();
  });
});
```

Create `app/src/stores/__tests__/message-store-ops.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useMessageStore } from '../message-store';

describe('message-store operations', () => {
  beforeEach(() => {
    useMessageStore.setState(useMessageStore.getInitialState());
  });

  it('removeMessage removes a message by refId', () => {
    const msg = { ref_id: 'm1', room_id: 'r1', author: '@a', timestamp: '', datatype: 'message', body: 'hello', annotations: {}, ext: {} };
    useMessageStore.getState().setMessages('r1', [msg as any]);
    useMessageStore.getState().removeMessage('r1', 'm1');
    expect(useMessageStore.getState().messagesByRoom['r1']).toHaveLength(0);
  });

  it('updateMessage patches a message', () => {
    const msg = { ref_id: 'm1', room_id: 'r1', author: '@a', timestamp: '', datatype: 'message', body: 'old', annotations: {}, ext: {} };
    useMessageStore.getState().setMessages('r1', [msg as any]);
    useMessageStore.getState().updateMessage('r1', 'm1', { body: 'new' });
    expect(useMessageStore.getState().messagesByRoom['r1'][0].body).toBe('new');
  });
});
```

**Step 4: Run tests**

```bash
cd app && pnpm test -- --run src/stores/__tests__/room-store-ops.test.ts src/stores/__tests__/message-store-ops.test.ts
```

**Step 5: Commit**

```
feat(app): extend stores with removeRoom, updateMessage, removeMessage
```

---

## Task 4: Create Room Dialog Enhancement (TC-5-OPS-010, 011)

**Files:**
- Modify: `app/src/components/chat/CreateRoomDialog.tsx`
- Modify: `app/src/lib/api/rooms.ts` (already done in Task 2)
- Test: `app/src/components/chat/__tests__/CreateRoomDialog.test.tsx`

**Step 1: Add membership_policy to CreateRoomDialog**

Enhance the existing `CreateRoomDialog` to include an Access Policy radio group:

```tsx
// Add to form, after Description textarea:
<div className="flex flex-col gap-2">
  <label className="text-sm font-medium">Access</label>
  <div className="flex gap-4">
    <label className="flex items-center gap-2 text-sm">
      <input
        type="radio"
        name="policy"
        value="invite"
        checked={policy === 'invite'}
        onChange={() => setPolicy('invite')}
      />
      Private — Invite only
    </label>
    <label className="flex items-center gap-2 text-sm">
      <input
        type="radio"
        name="policy"
        value="open"
        checked={policy === 'open'}
        onChange={() => setPolicy('open')}
      />
      Public — Anyone can join
    </label>
  </div>
</div>
```

Update `handleCreate` to pass `membership_policy: policy`.

**Step 2: Write test for policy selection**

In `CreateRoomDialog.test.tsx`, add test:

```typescript
it('sends membership_policy when creating room (TC-5-OPS-011)', async () => {
  // Render, open dialog, fill name, select "open", click Create
  // Assert createRoom called with { name: '...', description: '...', membership_policy: 'open' }
});
```

**Step 3: Run tests, then commit**

```
feat(app): add access policy to CreateRoomDialog (TC-5-OPS-010, TC-5-OPS-011)
```

---

## Task 5: Room Settings Dialog (TC-5-OPS-012, 013, 014, 015)

**Files:**
- Create: `app/src/components/room-settings/RoomSettingsDialog.tsx`
- Create: `app/src/components/room-settings/GeneralTab.tsx`
- Create: `app/src/components/room-settings/MembersTab.tsx`
- Create: `app/src/components/room-settings/AppsTab.tsx`
- Modify: `app/src/components/chat/RoomHeader.tsx` (add ⚙️ button)
- Test: `app/src/components/room-settings/__tests__/RoomSettingsDialog.test.tsx`

**Step 1: Create RoomSettingsDialog shell**

A Dialog with Tabs component (shadcn Tabs). Three tabs: General, Members, Apps.

```tsx
// RoomSettingsDialog.tsx
'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
```

**Step 2: Create GeneralTab**

Form with name, description, policy fields. Save calls `updateRoom()`. Leave/Archive buttons with confirm dialogs at bottom.

Key handlers:
- Save: `PATCH /api/rooms/{roomId}` → `roomStore.updateRoom()`
- Leave: `POST /api/rooms/{roomId}/leave` → `roomStore.removeRoom()`
- Archive: `PATCH /api/rooms/{roomId}` `{ archived: true }` → `roomStore.updateRoom()`

**Step 3: Create MembersTab (placeholder)**

Shows member list via `getRoomMembers()`. [Generate Invite Code] button (wired in Task 6). Remove member button (admin only).

**Step 4: Create AppsTab (placeholder)**

Shows installed Socialware list. [Browse App Catalog] button (wired in Task 7).

**Step 5: Add ⚙️ button to RoomHeader**

```tsx
// In RoomHeader, add next to room name:
<Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)} aria-label="Room settings">
  ⚙
</Button>
<RoomSettingsDialog roomId={activeRoom.room_id} open={settingsOpen} onOpenChange={setSettingsOpen} />
```

**Step 6: Write tests**

```typescript
// RoomSettingsDialog.test.tsx
describe('RoomSettingsDialog', () => {
  it('renders three tabs: General, Members, Apps (TC-5-OPS-012)');
  it('saves room name change (TC-5-OPS-013)');
  it('leave room removes from sidebar (TC-5-OPS-014)');
  it('archive room shows archived state (TC-5-OPS-015)');
});
```

**Step 7: Run tests, then commit**

```
feat(app): add Room Settings dialog with General/Members/Apps tabs (TC-5-OPS-012~015)
```

---

## Task 6: Invite Codes (TC-5-OPS-020~024)

**Files:**
- Create: `app/src/components/invite/InviteCodeSection.tsx`
- Create: `app/src/components/invite/JoinByCodeDialog.tsx`
- Modify: `app/src/components/room-settings/MembersTab.tsx` (embed InviteCodeSection)
- Modify: `app/src/components/chat/EmptyState.tsx` (wire "Enter invite code" button)
- Test: `app/src/components/invite/__tests__/invite.test.tsx`

**Step 1: Create InviteCodeSection**

Embeddable component for MembersTab. Shows active codes list + generate button.

```tsx
// InviteCodeSection.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { generateInviteCode, listInviteCodes, revokeInviteCode } from '@/lib/api/invite';
import type { InviteCode } from '@/types';

interface InviteCodeSectionProps {
  roomId: string;
}

export function InviteCodeSection({ roomId }: InviteCodeSectionProps) {
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    listInviteCodes(roomId).then(setCodes).catch(() => {});
  }, [roomId]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const code = await generateInviteCode(roomId);
      setCodes((prev) => [...prev, code]);
    } catch { /* toast error */ }
    finally { setGenerating(false); }
  }, [roomId]);

  const handleRevoke = useCallback(async (code: string) => {
    await revokeInviteCode(roomId, code);
    setCodes((prev) => prev.filter((c) => c.code !== code));
  }, [roomId]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Invite Codes</h4>
        <Button size="sm" onClick={handleGenerate} disabled={generating}>
          {generating ? 'Generating...' : 'Generate Code'}
        </Button>
      </div>
      {codes.map((c) => (
        <div key={c.code} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
          <span className="font-mono font-bold">{c.code}</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => handleCopy(c.code)}>Copy</Button>
            <Button variant="ghost" size="sm" onClick={() => handleCopy(c.invite_uri)}>Copy Link</Button>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleRevoke(c.code)}>Revoke</Button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Create JoinByCodeDialog**

```tsx
// JoinByCodeDialog.tsx — Dialog with code input + Join button
// On submit: joinByInviteCode(code) → roomStore.addRoom() + setActiveRoom()
```

**Step 3: Wire into EmptyState**

Change the "Enter invite code" button in `EmptyState.tsx` to open `JoinByCodeDialog`.

**Step 4: Embed InviteCodeSection in MembersTab**

**Step 5: Write tests**

```typescript
describe('InviteCodeSection', () => {
  it('generates invite code and displays it (TC-5-OPS-020)');
  it('lists existing invite codes (TC-5-OPS-024)');
  it('revokes invite code (TC-5-OPS-023)');
});

describe('JoinByCodeDialog', () => {
  it('joins room via code and navigates (TC-5-OPS-021)');
  it('shows error for invalid code');
});
```

**Step 6: Commit**

```
feat(app): invite code generation, list, revoke, and join (TC-5-OPS-020~024)
```

---

## Task 7: Socialware App Catalog (TC-5-OPS-030~035)

**Files:**
- Create: `app/src/components/socialware/AppCatalogDialog.tsx`
- Create: `app/src/components/socialware/AppDetailView.tsx`
- Create: `app/src/components/socialware/RoleMatrix.tsx`
- Modify: `app/src/components/room-settings/AppsTab.tsx` (wire catalog)
- Test: `app/src/components/socialware/__tests__/socialware.test.tsx`

**Step 1: Create AppCatalogDialog**

Dialog listing all Socialware apps from `listSocialware()`. Each card shows name, version, description, [Install]/[Installed] button. Install calls `installSocialware(swId, roomId)`.

**Step 2: Create AppDetailView**

Expanded view within AppsTab. Shows installed app details: datatypes, roles, commands, tabs. Start/Stop/Uninstall buttons.

**Step 3: Create RoleMatrix**

Table component for TC-5-OPS-035. Rows = members, columns = Socialware roles. Checkboxes toggle role assignment. (Note: this requires a new API endpoint for role assignment — mark as stub with TODO for backend.)

**Step 4: Wire into AppsTab**

AppsTab shows list of installed Socialware. Clicking one opens AppDetailView. "Browse App Catalog" opens AppCatalogDialog.

**Step 5: Write tests**

```typescript
describe('AppCatalogDialog', () => {
  it('renders catalog of available apps (TC-5-OPS-030)');
  it('installs app to room (TC-5-OPS-031)');
});

describe('AppDetailView', () => {
  it('shows app details and registered components (TC-5-OPS-032)');
  it('uninstalls app with confirmation (TC-5-OPS-033)');
});
```

**Step 6: Commit**

```
feat(app): Socialware app catalog, install, detail view, role matrix (TC-5-OPS-030~035)
```

---

## Task 8: Message Context Menu (TC-5-OPS-040~048)

**Files:**
- Modify: `app/src/components/chat/MessageBubble.tsx` (expand context menu)
- Create: `app/src/components/chat/EditMessageForm.tsx`
- Create: `app/src/components/chat/ForwardDialog.tsx`
- Create: `app/src/components/chat/ReplyPreview.tsx`
- Modify: `app/src/components/chat/ComposeArea.tsx` (add reply state)
- Test: `app/src/components/chat/__tests__/MessageBubble.test.tsx`
- Test: `app/src/components/chat/__tests__/message-ops.test.tsx`

**Step 1: Expand MessageBubble context menu**

Replace the single "Copy ezagent URI" item with the full menu from TC-5-OPS-040:

```tsx
<ContextMenuContent>
  <ContextMenuItem onSelect={() => onReply?.(message)}>Reply</ContextMenuItem>
  <ContextMenuItem onSelect={() => onReplyInThread?.(message)}>Reply in Thread</ContextMenuItem>
  <ContextMenuItem onSelect={() => onAddReaction?.(message)}>Add Reaction</ContextMenuItem>
  <ContextMenuItem onSelect={handleCopyText}>Copy Text</ContextMenuItem>
  <ContextMenuItem onSelect={handleCopyUri}>Copy ezagent URI</ContextMenuItem>
  <ContextMenuItem onSelect={() => onForward?.(message)}>Forward</ContextMenuItem>
  {isAuthor && (
    <>
      <ContextMenuItem onSelect={() => onEdit?.(message)}>Edit</ContextMenuItem>
      <ContextMenuItem onSelect={() => onDelete?.(message)} className="text-destructive">Delete</ContextMenuItem>
    </>
  )}
  {isAdmin && (
    <>
      <ContextMenuItem onSelect={() => onPin?.(message)}>
        {isPinned ? 'Unpin' : 'Pin'}
      </ContextMenuItem>
    </>
  )}
</ContextMenuContent>
```

MessageBubble needs new props: `onReply`, `onEdit`, `onDelete`, `onPin`, `onForward`, `onReplyInThread`, `onAddReaction`, `currentUserId`, `isAdmin`.

**Step 2: Create ReplyPreview bar**

A small bar above ComposeArea showing the quoted message with a close button.

```tsx
// ReplyPreview.tsx
interface ReplyPreviewProps {
  message: Message;
  onClose: () => void;
}

export function ReplyPreview({ message, onClose }: ReplyPreviewProps) {
  return (
    <div className="flex items-center gap-2 border-l-2 border-primary bg-muted/50 px-3 py-1 text-sm">
      <span className="font-semibold">{message.author}</span>
      <span className="flex-1 truncate text-muted-foreground">{message.body}</span>
      <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
    </div>
  );
}
```

**Step 3: Add reply state to ComposeArea**

Add `replyTo: Message | null` state. When set, show ReplyPreview above textarea. On send, include `ext: { reply_to: { ref_id: replyTo.ref_id } }` in the message body.

**Step 4: Create EditMessageForm**

Inline edit mode: replaces message body with textarea + Save/Cancel buttons. On save, calls `editMessage()` API + `messageStore.updateMessage()`.

**Step 5: Create ForwardDialog**

Dialog showing room list picker. On forward, calls `sendMessage()` to target room with `ext.forwarded_from`.

**Step 6: Wire delete and pin**

Delete: confirm dialog → `deleteMessage()` API → `messageStore.removeMessage()`.
Pin: `moderateMessage()` API with action "pin"/"unpin".

**Step 7: Write tests**

```typescript
describe('MessageBubble context menu (TC-5-OPS-040)', () => {
  it('shows Reply, Copy Text, Copy URI for all users');
  it('shows Edit, Delete only for message author');
  it('shows Pin only for admin');
});

describe('Message operations', () => {
  it('reply sets reply_to ext on sent message (TC-5-OPS-041)');
  it('edit message updates body (TC-5-OPS-043)');
  it('delete message removes from timeline (TC-5-OPS-044)');
  it('forward message to another room (TC-5-OPS-047)');
});
```

**Step 8: Commit**

```
feat(app): message context menu with reply, edit, delete, pin, forward (TC-5-OPS-040~048)
```

---

## Task 9: Profile & Settings (TC-5-OPS-050~056)

**Files:**
- Create: `app/src/components/profile/ProfilePopover.tsx`
- Create: `app/src/components/profile/EditProfileDialog.tsx`
- Create: `app/src/components/profile/ProfileCard.tsx`
- Create: `app/src/components/settings/SettingsDialog.tsx`
- Modify: `app/src/components/sidebar/Sidebar.tsx` (add user avatar at bottom)
- Modify: `app/src/stores/ui-store.ts` (add theme persistence logic)
- Test: `app/src/components/profile/__tests__/profile.test.tsx`
- Test: `app/src/components/settings/__tests__/settings.test.tsx`

**Step 1: Create ProfilePopover**

Shown when clicking user avatar in sidebar bottom. Shows avatar, name, entity ID, status. Buttons: Edit Profile, Settings, Sign Out.

```tsx
// ProfilePopover.tsx
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuthStore } from '@/stores/auth-store';

export function ProfilePopover() {
  const session = useAuthStore((s) => s.session);
  // ... renders avatar, name, entity_id, [Edit Profile] [Settings] [Sign Out] buttons
}
```

**Step 2: Create EditProfileDialog**

Form with display name, bio, avatar upload. Save calls `updateProfile()`.

**Step 3: Create ProfileCard**

Popover shown when clicking other user's avatar (in MemberList or MessageBubble). Shows their profile info from `getProfile()`.

**Step 4: Create SettingsDialog**

Tabbed dialog: Account, Notifications, Appearance, About.

- Account: entity ID (readonly), GitHub username, relay, Sign Out
- Notifications: global toggle + per-room overrides (stored in Electron Store via IPC)
- Appearance: theme switcher (System/Light/Dark), font size, compact mode
- About: app version, engine version

**Step 5: Add user section to Sidebar bottom**

In `Sidebar.tsx`, add a fixed bottom section with user avatar that opens ProfilePopover.

**Step 6: Theme switching**

Extend `ui-store.ts` `setTheme` to also apply the theme class to `document.documentElement` and persist to localStorage (or Electron Store).

**Step 7: Sign out**

Wire Sign Out to: `logout()` API → `authStore.logout()` → `electronAuth.clearCredentials()` → navigate to `/welcome`.

**Step 8: Write tests**

```typescript
describe('ProfilePopover (TC-5-OPS-050)', () => {
  it('shows user name and entity ID');
  it('opens edit profile dialog');
  it('opens settings dialog');
});

describe('SettingsDialog (TC-5-OPS-053)', () => {
  it('renders Account, Notifications, Appearance, About tabs');
  it('theme switch applies dark mode class (TC-5-OPS-055)');
});

describe('Sign Out (TC-5-OPS-056)', () => {
  it('clears auth store and navigates to welcome');
});
```

**Step 9: Commit**

```
feat(app): profile popover, edit profile, settings dialog, theme switching (TC-5-OPS-050~056)
```

---

## Task 10: Search & Command Palette (TC-5-OPS-060~065)

**Files:**
- Create: `app/src/components/search/SearchModal.tsx`
- Create: `app/src/components/search/SearchResults.tsx`
- Create: `app/src/components/search/CommandPalette.tsx`
- Modify: `app/src/components/sidebar/SearchBar.tsx` (open modal on click/⌘K)
- Test: `app/src/components/search/__tests__/search.test.tsx`

**Step 1: Create SearchModal**

Full-screen modal opened by ⌘K or clicking SearchBar. Unified search with debounced input.

```tsx
// SearchModal.tsx — key behaviors:
// - Input with debounce 300ms
// - Before typing: show recent rooms + entities
// - While typing: parallel search rooms (local), people (API), messages (API)
// - Results grouped: [Rooms] [People] [Messages]
// - Scope toggle: [All] [Current Room]
// - "/" prefix switches to command mode
```

**Step 2: Create SearchResults**

Three sections: RoomResults (local filter), PeopleResults (from `searchPeople()`), MessageResults (from `searchMessages()`). Each with click handlers to navigate.

**Step 3: Create CommandPalette**

When input starts with "/", fetch commands from `GET /api/rooms/{roomId}/commands` or `GET /api/commands`. Show filtered list. On select, insert command text into ComposeArea.

**Step 4: Wire SearchBar**

Change SearchBar from inline filter to click-to-open-modal. Add ⌘K keyboard shortcut via `useEffect` with keydown listener on document.

**Step 5: Write tests**

```typescript
describe('SearchModal', () => {
  it('opens on ⌘K keystroke (TC-5-OPS-060)');
  it('filters joined rooms locally (TC-5-OPS-061)');
  it('searches people via API (TC-5-OPS-062)');
  it('searches messages via API (TC-5-OPS-063)');
  it('toggles scope All/Current Room (TC-5-OPS-064)');
  it('switches to command mode on "/" input (TC-5-OPS-065)');
});
```

**Step 6: Commit**

```
feat(app): unified search modal with room/people/message search and command palette (TC-5-OPS-060~065)
```

---

## Task 11: Onboarding Empty States (TC-5-OPS-001~003)

**Files:**
- Modify: `app/src/components/chat/EmptyState.tsx`
- Modify: `app/src/app/chat/page.tsx`
- Test: `app/src/components/chat/__tests__/EmptyState.test.tsx` (extend)

**Step 1: Enhance room-level empty state**

In `ChatPage`, when `activeRoomId` is set but room has no messages, show enhanced empty state with "Invite Members" and "Install Apps" shortcuts (if admin).

**Step 2: Add onboarding hints**

Create a small `OnboardingHints` component that shows 3 dismissible inline tips. Hint state stored in localStorage.

```tsx
// In ChatPage, after Compose:
{showHints && <OnboardingHints onDismiss={() => setShowHints(false)} />}
```

**Step 3: Extend tests**

```typescript
it('shows admin shortcuts in empty room (TC-5-OPS-002)');
it('shows onboarding hints on first visit (TC-5-OPS-003)');
it('dismisses hints and persists (TC-5-OPS-003)');
```

**Step 4: Commit**

```
feat(app): onboarding empty states with admin shortcuts and hints (TC-5-OPS-001~003)
```

---

## Task 12: Wire WebSocket Events for Operations

**Files:**
- Create: `app/src/lib/ws/event-handlers.ts`
- Modify: `app/src/app/chat/layout.tsx` (connect WS on mount)
- Test: `app/src/lib/ws/__tests__/event-handlers.test.ts`

**Step 1: Create event handler registry**

```typescript
// event-handlers.ts
import { wsClient } from './client';
import { useRoomStore } from '@/stores/room-store';
import { useMessageStore } from '@/stores/message-store';
import { usePresenceStore } from '@/stores/presence-store';

export function registerWsHandlers() {
  wsClient.on('message.new', (event) => {
    const { room_id } = event;
    if (room_id) {
      useMessageStore.getState().addMessage(room_id, event.data as any);
    }
  });

  wsClient.on('message.deleted', (event) => {
    const { room_id, ref_id } = event;
    if (room_id && ref_id) {
      useMessageStore.getState().removeMessage(room_id, ref_id);
    }
  });

  wsClient.on('message.edited', (event) => {
    const { room_id, ref_id } = event;
    if (room_id && ref_id) {
      useMessageStore.getState().updateMessage(room_id, ref_id, event.data as any);
    }
  });

  wsClient.on('room.config_updated', (event) => {
    const { room_id } = event;
    if (room_id) {
      useRoomStore.getState().updateRoom(room_id, event.data as any);
    }
  });

  wsClient.on('room.member_joined', (event) => { /* update presence */ });
  wsClient.on('room.member_left', (event) => { /* update presence */ });

  wsClient.on('reaction.added', (event) => {
    const { room_id, ref_id } = event;
    if (room_id && ref_id) {
      useMessageStore.getState().updateAnnotation(room_id, ref_id, 'reactions', event.data);
    }
  });

  wsClient.on('typing.start', (event) => {
    const { room_id, author } = event;
    if (room_id && author) {
      usePresenceStore.getState().setTyping(room_id, author);
    }
  });

  wsClient.on('typing.stop', (event) => {
    const { room_id, author } = event;
    if (room_id && author) {
      usePresenceStore.getState().clearTyping(room_id, author);
    }
  });
}
```

**Step 2: Connect in ChatLayout**

```typescript
// In chat/layout.tsx useEffect:
useEffect(() => {
  registerWsHandlers();
  wsClient.connect();
  return () => wsClient.disconnect();
}, []);
```

**Step 3: Write tests**

```typescript
describe('WS event handlers', () => {
  it('message.new adds to message store');
  it('message.deleted removes from message store');
  it('message.edited updates message in store');
  it('room.config_updated updates room in store');
  it('typing.start sets typing in presence store');
});
```

**Step 4: Commit**

```
feat(app): wire WebSocket event handlers for real-time operations sync
```

---

## Task 13: Integration Test Pass

**Files:**
- All test files from Tasks 3-12

**Step 1: Run full test suite**

```bash
cd app && pnpm test -- --run
```

**Step 2: Fix any failures**

Address import issues, missing mocks, type errors.

**Step 3: Commit fixes**

```
fix(app): resolve test failures from operations implementation
```

---

## Summary

| Task | TCs Covered | Components |
|------|-------------|------------|
| 1. Types | — | Foundation types |
| 2. API Layer | — | Foundation API functions |
| 3. Store Extensions | — | Foundation store actions |
| 4. CreateRoom Enhancement | OPS-010, 011 | CreateRoomDialog |
| 5. Room Settings | OPS-012~015 | RoomSettingsDialog, GeneralTab, MembersTab, AppsTab |
| 6. Invite Codes | OPS-020~024 | InviteCodeSection, JoinByCodeDialog |
| 7. Socialware Catalog | OPS-030~035 | AppCatalogDialog, AppDetailView, RoleMatrix |
| 8. Message Ops | OPS-040~048 | Context menu, EditForm, ForwardDialog, ReplyPreview |
| 9. Profile & Settings | OPS-050~056 | ProfilePopover, EditProfileDialog, SettingsDialog |
| 10. Search | OPS-060~065 | SearchModal, CommandPalette |
| 11. Onboarding | OPS-001~003 | EmptyState enhancements |
| 12. WebSocket Wiring | — | Real-time sync for all operations |
| 13. Integration Tests | All | Full suite validation |

**Estimated total: 13 tasks, ~45 new/modified files, 42 TCs covered.**
