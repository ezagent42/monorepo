import { describe, it, expect, beforeEach } from 'vitest';
import { useRoomStore } from '../room-store';
import type { Room } from '@/types/room';

const makeRoom = (overrides: Partial<Room> = {}): Room => ({
  room_id: 'room-1',
  name: 'Test Room',
  members: ['@alice:relay.ezagent.dev'],
  config: {},
  enabled_extensions: [],
  unread_count: 0,
  ...overrides,
});

describe('RoomStore', () => {
  beforeEach(() => useRoomStore.setState(useRoomStore.getInitialState()));

  it('starts with empty rooms', () => {
    expect(useRoomStore.getState().rooms).toEqual([]);
  });

  it('starts with null activeRoomId', () => {
    expect(useRoomStore.getState().activeRoomId).toBeNull();
  });

  it('starts with isLoading false', () => {
    expect(useRoomStore.getState().isLoading).toBe(false);
  });

  it('setRooms replaces room list', () => {
    const rooms = [makeRoom({ room_id: 'room-1' }), makeRoom({ room_id: 'room-2', name: 'Room 2' })];
    useRoomStore.getState().setRooms(rooms);
    expect(useRoomStore.getState().rooms).toHaveLength(2);
    expect(useRoomStore.getState().rooms[0].room_id).toBe('room-1');
    expect(useRoomStore.getState().rooms[1].room_id).toBe('room-2');
  });

  it('addRoom appends a room', () => {
    useRoomStore.getState().setRooms([makeRoom({ room_id: 'room-1' })]);
    useRoomStore.getState().addRoom(makeRoom({ room_id: 'room-2', name: 'Room 2' }));
    expect(useRoomStore.getState().rooms).toHaveLength(2);
    expect(useRoomStore.getState().rooms[1].room_id).toBe('room-2');
  });

  it('setActiveRoom updates activeRoomId', () => {
    useRoomStore.getState().setActiveRoom('room-42');
    expect(useRoomStore.getState().activeRoomId).toBe('room-42');
  });

  it('updateRoom applies partial updates', () => {
    useRoomStore.getState().setRooms([makeRoom({ room_id: 'room-1', name: 'Old Name' })]);
    useRoomStore.getState().updateRoom('room-1', { name: 'New Name' });
    expect(useRoomStore.getState().rooms[0].name).toBe('New Name');
  });

  it('updateRoom does not affect other rooms', () => {
    useRoomStore.getState().setRooms([
      makeRoom({ room_id: 'room-1', name: 'Room 1' }),
      makeRoom({ room_id: 'room-2', name: 'Room 2' }),
    ]);
    useRoomStore.getState().updateRoom('room-1', { name: 'Updated' });
    expect(useRoomStore.getState().rooms[1].name).toBe('Room 2');
  });

  it('incrementUnread bumps count', () => {
    useRoomStore.getState().setRooms([makeRoom({ room_id: 'room-1', unread_count: 0 })]);
    useRoomStore.getState().incrementUnread('room-1');
    expect(useRoomStore.getState().rooms[0].unread_count).toBe(1);
    useRoomStore.getState().incrementUnread('room-1');
    expect(useRoomStore.getState().rooms[0].unread_count).toBe(2);
  });

  it('incrementUnread handles undefined unread_count', () => {
    const room = makeRoom({ room_id: 'room-1' });
    delete (room as Partial<Room>).unread_count;
    useRoomStore.getState().setRooms([room]);
    useRoomStore.getState().incrementUnread('room-1');
    expect(useRoomStore.getState().rooms[0].unread_count).toBe(1);
  });

  it('clearUnread resets to 0', () => {
    useRoomStore.getState().setRooms([makeRoom({ room_id: 'room-1', unread_count: 5 })]);
    useRoomStore.getState().clearUnread('room-1');
    expect(useRoomStore.getState().rooms[0].unread_count).toBe(0);
  });
});
