import type { WsEvent } from '@/types';
import type { WsClient } from './client';

/**
 * Register default event handlers that wire WebSocket events to Zustand
 * store actions.
 *
 * The actual store imports will be added when Tasks 6-7 (Zustand stores)
 * are complete. For now each handler contains a placeholder comment
 * describing which store action it will invoke.
 */
export function registerDefaultHandlers(client: WsClient): void {
  // -----------------------------------------------------------------------
  // Message events
  // -----------------------------------------------------------------------
  client.on('message.new', (_event: WsEvent) => {
    // TODO: useMessageStore.getState().addMessage(event.data as Message)
  });

  client.on('message.edited', (_event: WsEvent) => {
    // TODO: useMessageStore.getState().updateMessage(event.ref_id!, event.data)
  });

  client.on('message.deleted', (_event: WsEvent) => {
    // TODO: useMessageStore.getState().removeMessage(event.ref_id!)
  });

  // -----------------------------------------------------------------------
  // Room events
  // -----------------------------------------------------------------------
  client.on('room.created', (_event: WsEvent) => {
    // TODO: useRoomStore.getState().addRoom(event.data as Room)
  });

  client.on('room.member_joined', (_event: WsEvent) => {
    // TODO: useRoomStore.getState().addMember(event.room_id!, event.data as RoomMember)
  });

  client.on('room.member_left', (_event: WsEvent) => {
    // TODO: useRoomStore.getState().removeMember(event.room_id!, event.author!)
  });

  client.on('room.config_updated', (_event: WsEvent) => {
    // TODO: useRoomStore.getState().updateRoom(event.room_id!, event.data)
  });

  // -----------------------------------------------------------------------
  // Reaction events
  // -----------------------------------------------------------------------
  client.on('reaction.added', (_event: WsEvent) => {
    // TODO: useMessageStore.getState().addReaction(event.ref_id!, event.data)
  });

  client.on('reaction.removed', (_event: WsEvent) => {
    // TODO: useMessageStore.getState().removeReaction(event.ref_id!, event.data)
  });

  // -----------------------------------------------------------------------
  // Presence events
  // -----------------------------------------------------------------------
  client.on('presence.joined', (_event: WsEvent) => {
    // TODO: usePresenceStore.getState().setOnline(event.author!)
  });

  client.on('presence.left', (_event: WsEvent) => {
    // TODO: usePresenceStore.getState().setOffline(event.author!)
  });

  // -----------------------------------------------------------------------
  // Typing events
  // -----------------------------------------------------------------------
  client.on('typing.start', (_event: WsEvent) => {
    // TODO: usePresenceStore.getState().setTyping(event.room_id!, event.author!, true)
  });

  client.on('typing.stop', (_event: WsEvent) => {
    // TODO: usePresenceStore.getState().setTyping(event.room_id!, event.author!, false)
  });

  // -----------------------------------------------------------------------
  // Command events
  // -----------------------------------------------------------------------
  client.on('command.invoked', (_event: WsEvent) => {
    // TODO: useCommandStore.getState().trackInvocation(event.data)
  });

  client.on('command.result', (_event: WsEvent) => {
    // TODO: useCommandStore.getState().handleResult(event.ref_id!, event.data)
  });
}
