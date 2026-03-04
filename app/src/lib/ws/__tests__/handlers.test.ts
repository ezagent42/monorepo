import { describe, it, expect, beforeEach } from 'vitest';
import { WsClient } from '../client';
import { registerDefaultHandlers } from '../handlers';
import { useMessageStore } from '@/stores/message-store';
import { useRoomStore } from '@/stores/room-store';
import { usePresenceStore } from '@/stores/presence-store';
import type { WsEvent, Message } from '@/types';

function makeEvent(overrides: Partial<WsEvent>): WsEvent {
  return {
    type: 'message.new',
    timestamp: '2026-03-04T10:00:00Z',
    data: {},
    ...overrides,
  };
}

describe('WebSocket → Store handlers', () => {
  let client: WsClient;

  beforeEach(() => {
    client = new WsClient('ws://localhost:6142/ws');
    registerDefaultHandlers(client);

    // Reset stores
    useMessageStore.setState({ messagesByRoom: {}, hasMore: {}, isLoading: false });
    useRoomStore.setState({ rooms: [], activeRoomId: null, isLoading: false });
    usePresenceStore.setState({ onlineUsers: {}, typingUsers: {}, _typingTimeouts: {} });
  });

  // TC-5-SYNC-001: message.new → addMessage
  it('message.new adds message to store (TC-5-SYNC-001)', () => {
    const msg: Partial<Message> = {
      ref_id: 'ref-1',
      room_id: 'room-1',
      author: '@alice:relay',
      body: 'Hello',
      timestamp: '2026-03-04T10:00:00Z',
      datatype: 'message',
      annotations: {},
      ext: {},
    };

    client.handleEvent(makeEvent({
      type: 'message.new',
      room_id: 'room-1',
      data: msg as Record<string, unknown>,
    }));

    const messages = useMessageStore.getState().messagesByRoom['room-1'];
    expect(messages).toHaveLength(1);
    expect(messages[0].body).toBe('Hello');
  });

  it('message.new increments unread for inactive room', () => {
    useRoomStore.setState({
      rooms: [{ room_id: 'room-1', name: 'Test', members: [], config: {}, enabled_extensions: [], unread_count: 0 }],
      activeRoomId: 'room-2', // different room
    });

    client.handleEvent(makeEvent({
      type: 'message.new',
      room_id: 'room-1',
      data: { ref_id: 'ref-1', room_id: 'room-1', author: '@alice', body: 'Hi', timestamp: '', datatype: 'message', annotations: {}, ext: {} },
    }));

    const room = useRoomStore.getState().rooms.find((r) => r.room_id === 'room-1');
    expect(room?.unread_count).toBe(1);
  });

  // TC-5-SYNC-002: reaction.added → updateAnnotation
  it('reaction.added updates message annotation (TC-5-SYNC-002)', () => {
    // Pre-populate a message
    useMessageStore.setState({
      messagesByRoom: {
        'room-1': [{
          ref_id: 'ref-1', room_id: 'room-1', author: '@alice', body: 'Hi',
          timestamp: '', datatype: 'message', annotations: {}, ext: {},
        }],
      },
    });

    client.handleEvent(makeEvent({
      type: 'reaction.added',
      room_id: 'room-1',
      ref_id: 'ref-1',
      data: { key: 'reaction:👍', value: true },
    }));

    const msg = useMessageStore.getState().messagesByRoom['room-1'][0];
    expect(msg.annotations['reaction:👍']).toBe(true);
  });

  // TC-5-SYNC-003: presence.joined → setOnline
  it('presence.joined sets user online (TC-5-SYNC-003)', () => {
    client.handleEvent(makeEvent({
      type: 'presence.joined',
      room_id: 'room-1',
      author: '@bob:relay',
    }));

    expect(usePresenceStore.getState().onlineUsers['room-1']).toContain('@bob:relay');
  });

  it('presence.left sets user offline', () => {
    usePresenceStore.getState().setOnline('room-1', '@bob:relay');

    client.handleEvent(makeEvent({
      type: 'presence.left',
      room_id: 'room-1',
      author: '@bob:relay',
    }));

    expect(usePresenceStore.getState().onlineUsers['room-1']).not.toContain('@bob:relay');
  });

  // TC-5-SYNC-005: typing events
  it('typing.start sets user typing (TC-5-SYNC-005)', () => {
    client.handleEvent(makeEvent({
      type: 'typing.start',
      room_id: 'room-1',
      author: '@bob:relay',
    }));

    expect(usePresenceStore.getState().typingUsers['room-1']).toContain('@bob:relay');
  });

  it('typing.stop clears user typing', () => {
    usePresenceStore.getState().setTyping('room-1', '@bob:relay');

    client.handleEvent(makeEvent({
      type: 'typing.stop',
      room_id: 'room-1',
      author: '@bob:relay',
    }));

    const typing = usePresenceStore.getState().typingUsers['room-1'] ?? [];
    expect(typing).not.toContain('@bob:relay');
  });

  // Room events
  it('room.created adds room to store', () => {
    client.handleEvent(makeEvent({
      type: 'room.created',
      data: { room_id: 'new-room', name: 'New Room', members: [], config: {}, enabled_extensions: [] },
    }));

    expect(useRoomStore.getState().rooms).toHaveLength(1);
    expect(useRoomStore.getState().rooms[0].name).toBe('New Room');
  });
});
