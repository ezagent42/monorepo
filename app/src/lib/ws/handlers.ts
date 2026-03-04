import type { WsEvent } from '@/types';
import type { Message, Room } from '@/types';
import type { WsClient } from './client';
import { useMessageStore } from '@/stores/message-store';
import { useRoomStore } from '@/stores/room-store';
import { usePresenceStore } from '@/stores/presence-store';

/**
 * Register default event handlers that wire WebSocket events to Zustand store actions.
 */
export function registerDefaultHandlers(client: WsClient): void {
  // -----------------------------------------------------------------------
  // Message events
  // -----------------------------------------------------------------------
  client.on('message.new', (event: WsEvent) => {
    if (!event.room_id) return;
    const message = event.data as unknown as Message;
    useMessageStore.getState().addMessage(event.room_id, message);
    // Increment unread if not the active room
    const activeRoomId = useRoomStore.getState().activeRoomId;
    if (event.room_id !== activeRoomId) {
      useRoomStore.getState().incrementUnread(event.room_id);
    }
  });

  client.on('message.edited', (_event: WsEvent) => {
    // Edited messages could be handled by a full message replace
    // For now, treat as annotation update if ref_id present
  });

  client.on('message.deleted', (_event: WsEvent) => {
    // Message deletion - could be handled via annotation or store method
  });

  // -----------------------------------------------------------------------
  // Room events
  // -----------------------------------------------------------------------
  client.on('room.created', (event: WsEvent) => {
    const room = event.data as unknown as Room;
    useRoomStore.getState().addRoom(room);
  });

  client.on('room.config_updated', (event: WsEvent) => {
    if (!event.room_id) return;
    useRoomStore.getState().updateRoom(event.room_id, event.data as Partial<Room>);
  });

  // -----------------------------------------------------------------------
  // Reaction events
  // -----------------------------------------------------------------------
  client.on('reaction.added', (event: WsEvent) => {
    if (!event.room_id || !event.ref_id) return;
    const { key, value } = event.data as { key: string; value: unknown };
    useMessageStore.getState().updateAnnotation(event.room_id, event.ref_id, key, value);
  });

  client.on('reaction.removed', (event: WsEvent) => {
    if (!event.room_id || !event.ref_id) return;
    const { key } = event.data as { key: string };
    useMessageStore.getState().updateAnnotation(event.room_id, event.ref_id, key, null);
  });

  // -----------------------------------------------------------------------
  // Presence events
  // -----------------------------------------------------------------------
  client.on('presence.joined', (event: WsEvent) => {
    if (!event.room_id || !event.author) return;
    usePresenceStore.getState().setOnline(event.room_id, event.author);
  });

  client.on('presence.left', (event: WsEvent) => {
    if (!event.room_id || !event.author) return;
    usePresenceStore.getState().setOffline(event.room_id, event.author);
  });

  // -----------------------------------------------------------------------
  // Typing events
  // -----------------------------------------------------------------------
  client.on('typing.start', (event: WsEvent) => {
    if (!event.room_id || !event.author) return;
    usePresenceStore.getState().setTyping(event.room_id, event.author);
  });

  client.on('typing.stop', (event: WsEvent) => {
    if (!event.room_id || !event.author) return;
    usePresenceStore.getState().clearTyping(event.room_id, event.author);
  });
}
