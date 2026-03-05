import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RoomSettingsDialog } from '../RoomSettingsDialog';
import { useRoomStore } from '@/stores/room-store';

vi.mock('@/lib/api/rooms', () => ({
  updateRoom: vi.fn(),
  leaveRoom: vi.fn(),
  getRoomMembers: vi.fn().mockResolvedValue([]),
}));

const mockRoom = {
  room_id: 'r1',
  name: 'Test Room',
  description: 'A test room',
  members: ['@alice'],
  config: {},
  enabled_extensions: [],
  membership_policy: 'invite' as const,
};

describe('RoomSettingsDialog', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useRoomStore.setState({
      ...useRoomStore.getInitialState(),
      rooms: [mockRoom],
      activeRoomId: 'r1',
    });
  });

  it('renders three tabs: General, Members, Apps (TC-5-OPS-012)', () => {
    render(<RoomSettingsDialog roomId="r1" open={true} onOpenChange={() => {}} />);
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Members')).toBeInTheDocument();
    expect(screen.getByText('Apps')).toBeInTheDocument();
  });

  it('shows room name in General tab', () => {
    render(<RoomSettingsDialog roomId="r1" open={true} onOpenChange={() => {}} />);
    const nameInput = screen.getByDisplayValue('Test Room');
    expect(nameInput).toBeInTheDocument();
  });

  it('saves room name change (TC-5-OPS-013)', async () => {
    const { updateRoom } = await import('@/lib/api/rooms');
    (updateRoom as ReturnType<typeof vi.fn>).mockResolvedValue({ ...mockRoom, name: 'Updated' });

    render(<RoomSettingsDialog roomId="r1" open={true} onOpenChange={() => {}} />);

    const nameInput = screen.getByDisplayValue('Test Room');
    fireEvent.change(nameInput, { target: { value: 'Updated' } });
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(updateRoom).toHaveBeenCalledWith('r1', {
        name: 'Updated',
        description: 'A test room',
        membership_policy: 'invite',
      });
    });
  });

  it('leave room removes from sidebar (TC-5-OPS-014)', async () => {
    const { leaveRoom } = await import('@/lib/api/rooms');
    (leaveRoom as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const onOpenChange = vi.fn();

    render(<RoomSettingsDialog roomId="r1" open={true} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByText('Leave Room'));
    fireEvent.click(screen.getByText('Confirm Leave'));

    await waitFor(() => {
      expect(leaveRoom).toHaveBeenCalledWith('r1');
      expect(useRoomStore.getState().rooms).toHaveLength(0);
    });
  });
});
