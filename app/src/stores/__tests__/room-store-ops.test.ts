import { describe, it, expect, beforeEach } from 'vitest';
import { useRoomStore } from '../room-store';

describe('room-store operations', () => {
  beforeEach(() => {
    useRoomStore.setState({
      rooms: [],
      activeRoomId: null,
      isLoading: false,
    });
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
    expect(state.rooms[0].room_id).toBe('r2');
    expect(state.activeRoomId).toBeNull();
  });

  it('removeRoom preserves activeRoomId if not the removed room', () => {
    useRoomStore.setState({
      rooms: [
        { room_id: 'r1', name: 'Room 1', members: [], config: {}, enabled_extensions: [] },
        { room_id: 'r2', name: 'Room 2', members: [], config: {}, enabled_extensions: [] },
      ],
      activeRoomId: 'r2',
    });
    useRoomStore.getState().removeRoom('r1');
    expect(useRoomStore.getState().activeRoomId).toBe('r2');
  });
});
