import { describe, it, expect, beforeEach } from 'vitest';
import { WsClient } from '../client';
import { registerDefaultHandlers } from '../handlers';
import { useRoomStore } from '@/stores/room-store';
import { useMessageStore } from '@/stores/message-store';
import { usePresenceStore } from '@/stores/presence-store';
import type { WsEvent } from '@/types';

/**
 * Tests for WebSocket event handlers wired to Zustand stores.
 *
 * We use a fresh WsClient per test (not the singleton) to avoid cross-test
 * side effects. The registerDefaultHandlers function is the same one that
 * registerWsHandlers delegates to, so these tests cover the full handler logic.
 */

function makeEvent(overrides: Partial<WsEvent>): WsEvent {
  return {
    type: 'message.new',
    timestamp: '2024-01-01T00:00:00Z',
    data: {},
    ...overrides,
  };
}

describe('WS event handlers', () => {
  let client: WsClient;

  beforeEach(() => {
    client = new WsClient('ws://localhost:6142/ws');
    registerDefaultHandlers(client);

    // Reset stores to known state
    useRoomStore.setState({
      rooms: [{ room_id: 'r1', name: 'Test', members: [], config: {}, enabled_extensions: [] }],
      activeRoomId: 'r1',
      isLoading: false,
    });
    useMessageStore.setState({
      messagesByRoom: {
        r1: [{
          ref_id: 'm1',
          room_id: 'r1',
          author: '@alice',
          timestamp: '2024-01-01T00:00:00Z',
          datatype: 'message',
          body: 'hello',
          annotations: {},
          ext: {},
        }],
      },
      isLoading: false,
      hasMore: {},
    });
    usePresenceStore.setState({
      onlineUsers: {},
      typingUsers: {},
      _typingTimeouts: {},
    });
  });

  it('message.new adds to message store', () => {
    const msg = {
      ref_id: 'm2',
      room_id: 'r1',
      author: '@bob',
      timestamp: '2024-01-01T00:01:00Z',
      datatype: 'message',
      body: 'world',
      annotations: {},
      ext: {},
    };

    client.handleEvent(makeEvent({
      type: 'message.new',
      room_id: 'r1',
      data: msg as Record<string, unknown>,
    }));

    expect(useMessageStore.getState().messagesByRoom['r1']).toHaveLength(2);
  });

  it('message.new increments unread for non-active room', () => {
    useRoomStore.setState({
      rooms: [{ room_id: 'r1', name: 'Test', members: [], config: {}, enabled_extensions: [], unread_count: 0 }],
      activeRoomId: 'other-room',
    });

    client.handleEvent(makeEvent({
      type: 'message.new',
      room_id: 'r1',
      data: {
        ref_id: 'm2', room_id: 'r1', author: '@bob', body: 'hi',
        timestamp: '', datatype: 'message', annotations: {}, ext: {},
      },
    }));

    const room = useRoomStore.getState().rooms.find((r) => r.room_id === 'r1');
    expect(room?.unread_count).toBe(1);
  });

  it('message.new does NOT increment unread for active room', () => {
    useRoomStore.setState({
      rooms: [{ room_id: 'r1', name: 'Test', members: [], config: {}, enabled_extensions: [], unread_count: 0 }],
      activeRoomId: 'r1',
    });

    client.handleEvent(makeEvent({
      type: 'message.new',
      room_id: 'r1',
      data: {
        ref_id: 'm2', room_id: 'r1', author: '@bob', body: 'hi',
        timestamp: '', datatype: 'message', annotations: {}, ext: {},
      },
    }));

    const room = useRoomStore.getState().rooms.find((r) => r.room_id === 'r1');
    expect(room?.unread_count).toBe(0);
  });

  it('message.deleted removes from message store', () => {
    client.handleEvent(makeEvent({
      type: 'message.deleted',
      room_id: 'r1',
      ref_id: 'm1',
    }));

    expect(useMessageStore.getState().messagesByRoom['r1']).toHaveLength(0);
  });

  it('message.edited updates message in store', () => {
    client.handleEvent(makeEvent({
      type: 'message.edited',
      room_id: 'r1',
      ref_id: 'm1',
      data: { body: 'edited' },
    }));

    expect(useMessageStore.getState().messagesByRoom['r1'][0].body).toBe('edited');
  });

  it('room.config_updated updates room in store', () => {
    client.handleEvent(makeEvent({
      type: 'room.config_updated',
      room_id: 'r1',
      data: { name: 'Updated' },
    }));

    expect(useRoomStore.getState().rooms[0].name).toBe('Updated');
  });

  it('room.created adds room to store', () => {
    client.handleEvent(makeEvent({
      type: 'room.created',
      data: { room_id: 'r2', name: 'New Room', members: [], config: {}, enabled_extensions: [] },
    }));

    expect(useRoomStore.getState().rooms).toHaveLength(2);
    expect(useRoomStore.getState().rooms[1].name).toBe('New Room');
  });

  it('room.member_joined sets user online', () => {
    client.handleEvent(makeEvent({
      type: 'room.member_joined',
      room_id: 'r1',
      author: '@bob',
    }));

    expect(usePresenceStore.getState().onlineUsers['r1']).toContain('@bob');
  });

  it('room.member_left sets user offline', () => {
    usePresenceStore.getState().setOnline('r1', '@bob');

    client.handleEvent(makeEvent({
      type: 'room.member_left',
      room_id: 'r1',
      author: '@bob',
    }));

    expect(usePresenceStore.getState().onlineUsers['r1']).not.toContain('@bob');
  });

  it('reaction.added updates message annotation', () => {
    client.handleEvent(makeEvent({
      type: 'reaction.added',
      room_id: 'r1',
      ref_id: 'm1',
      data: { key: 'reactions', value: { thumbsup: 1 } },
    }));

    const msg = useMessageStore.getState().messagesByRoom['r1'][0];
    expect(msg.annotations['reactions']).toEqual({ thumbsup: 1 });
  });

  it('reaction.removed clears message annotation', () => {
    // First add a reaction
    useMessageStore.getState().updateAnnotation('r1', 'm1', 'reactions', { thumbsup: 1 });

    client.handleEvent(makeEvent({
      type: 'reaction.removed',
      room_id: 'r1',
      ref_id: 'm1',
      data: { key: 'reactions' },
    }));

    const msg = useMessageStore.getState().messagesByRoom['r1'][0];
    expect(msg.annotations['reactions']).toBeNull();
  });

  it('typing.start sets typing in presence store', () => {
    client.handleEvent(makeEvent({
      type: 'typing.start',
      room_id: 'r1',
      author: '@bob',
    }));

    expect(usePresenceStore.getState().typingUsers['r1']).toContain('@bob');
  });

  it('typing.stop clears typing in presence store', () => {
    usePresenceStore.getState().setTyping('r1', '@bob');

    client.handleEvent(makeEvent({
      type: 'typing.stop',
      room_id: 'r1',
      author: '@bob',
    }));

    const typing = usePresenceStore.getState().typingUsers['r1'] ?? [];
    expect(typing).not.toContain('@bob');
  });

  it('presence.joined sets user online', () => {
    client.handleEvent(makeEvent({
      type: 'presence.joined',
      room_id: 'r1',
      author: '@carol',
    }));

    expect(usePresenceStore.getState().onlineUsers['r1']).toContain('@carol');
  });

  it('presence.left sets user offline', () => {
    usePresenceStore.getState().setOnline('r1', '@carol');

    client.handleEvent(makeEvent({
      type: 'presence.left',
      room_id: 'r1',
      author: '@carol',
    }));

    expect(usePresenceStore.getState().onlineUsers['r1']).not.toContain('@carol');
  });

  // Guard tests: events with missing fields should be no-ops
  it('message.new without room_id is a no-op', () => {
    client.handleEvent(makeEvent({
      type: 'message.new',
      room_id: undefined,
      data: { ref_id: 'x', body: 'ignored' },
    }));

    // Only the pre-seeded message should exist
    expect(useMessageStore.getState().messagesByRoom['r1']).toHaveLength(1);
  });

  it('message.deleted without ref_id is a no-op', () => {
    client.handleEvent(makeEvent({
      type: 'message.deleted',
      room_id: 'r1',
      ref_id: undefined,
    }));

    expect(useMessageStore.getState().messagesByRoom['r1']).toHaveLength(1);
  });

  it('typing.start without author is a no-op', () => {
    client.handleEvent(makeEvent({
      type: 'typing.start',
      room_id: 'r1',
      author: undefined,
    }));

    const typing = usePresenceStore.getState().typingUsers['r1'];
    expect(typing).toBeUndefined();
  });
});
