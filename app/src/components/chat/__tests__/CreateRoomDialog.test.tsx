import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateRoomDialog } from '../CreateRoomDialog';
import { useRoomStore } from '@/stores/room-store';

vi.mock('@/lib/api/rooms', () => ({
  createRoom: vi.fn(),
}));

describe('CreateRoomDialog', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useRoomStore.setState(useRoomStore.getInitialState());
  });

  it('defaults to invite (Private) policy', () => {
    render(<CreateRoomDialog open={true} onOpenChange={() => {}} />);
    const inviteRadio = screen.getByLabelText(/private/i) as HTMLInputElement;
    expect(inviteRadio.checked).toBe(true);
  });

  it('sends membership_policy when creating room (TC-5-OPS-011)', async () => {
    const { createRoom } = await import('@/lib/api/rooms');
    const mockRoom = {
      room_id: 'r1',
      name: 'Test',
      members: [],
      config: {},
      enabled_extensions: [],
      membership_policy: 'open',
    };
    (createRoom as ReturnType<typeof vi.fn>).mockResolvedValue(mockRoom);

    render(<CreateRoomDialog open={true} onOpenChange={() => {}} />);

    // Fill name
    fireEvent.change(screen.getByPlaceholderText('Room name'), {
      target: { value: 'Test' },
    });

    // Select Public
    fireEvent.click(screen.getByLabelText(/public/i));

    // Click Create
    const createButton = screen.getAllByRole('button').find(
      (btn) => btn.textContent === 'Create'
    )!;
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(createRoom).toHaveBeenCalledWith({
        name: 'Test',
        description: undefined,
        membership_policy: 'open',
      });
    });
  });

  it('renders access policy radio buttons (TC-5-OPS-010)', () => {
    render(<CreateRoomDialog open={true} onOpenChange={() => {}} />);
    expect(screen.getByText('Access')).toBeInTheDocument();
    expect(screen.getByLabelText(/private/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/public/i)).toBeInTheDocument();
  });
});
