import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InviteCodeSection } from '../InviteCodeSection';
import { JoinByCodeDialog } from '../JoinByCodeDialog';
import { useRoomStore } from '@/stores/room-store';

vi.mock('@/lib/api/invite', () => ({
  generateInviteCode: vi.fn(),
  listInviteCodes: vi.fn().mockResolvedValue([]),
  revokeInviteCode: vi.fn(),
  joinByInviteCode: vi.fn(),
}));

vi.mock('@/lib/api/rooms', () => ({
  listRooms: vi.fn().mockResolvedValue([]),
}));

describe('InviteCodeSection', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    // Re-apply default mock for listInviteCodes after restoreAllMocks
    const { listInviteCodes } = await import('@/lib/api/invite');
    (listInviteCodes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it('renders Generate Code button', () => {
    render(<InviteCodeSection roomId="r1" />);
    expect(screen.getByText('Generate Code')).toBeInTheDocument();
  });

  it('generates invite code and displays it (TC-5-OPS-020)', async () => {
    const { generateInviteCode } = await import('@/lib/api/invite');
    (generateInviteCode as ReturnType<typeof vi.fn>).mockResolvedValue({
      code: 'ABC-XYZ',
      room_id: 'r1',
      created_by: '@alice',
      created_at: '2024-01-01T00:00:00Z',
      expires_at: '2024-01-08T00:00:00Z',
      use_count: 0,
      invite_uri: 'ezagent://relay.example.com/invite/ABC-XYZ',
    });

    render(<InviteCodeSection roomId="r1" />);
    fireEvent.click(screen.getByText('Generate Code'));

    await waitFor(() => {
      expect(screen.getByText('ABC-XYZ')).toBeInTheDocument();
    });
  });

  it('lists existing invite codes (TC-5-OPS-024)', async () => {
    const { listInviteCodes } = await import('@/lib/api/invite');
    (listInviteCodes as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        code: 'EXIST-1',
        room_id: 'r1',
        created_by: '@alice',
        created_at: '2024-01-01T00:00:00Z',
        expires_at: '2024-01-08T00:00:00Z',
        use_count: 2,
        invite_uri: 'ezagent://relay.example.com/invite/EXIST-1',
      },
    ]);

    render(<InviteCodeSection roomId="r1" />);

    await waitFor(() => {
      expect(screen.getByText('EXIST-1')).toBeInTheDocument();
    });
  });

  it('revokes invite code (TC-5-OPS-023)', async () => {
    const { listInviteCodes, revokeInviteCode } = await import('@/lib/api/invite');
    (listInviteCodes as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        code: 'TO-REVOKE',
        room_id: 'r1',
        created_by: '@alice',
        created_at: '2024-01-01T00:00:00Z',
        expires_at: '2024-01-08T00:00:00Z',
        use_count: 0,
        invite_uri: 'ezagent://relay.example.com/invite/TO-REVOKE',
      },
    ]);
    (revokeInviteCode as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    render(<InviteCodeSection roomId="r1" />);

    await waitFor(() => {
      expect(screen.getByText('TO-REVOKE')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Revoke'));

    await waitFor(() => {
      expect(screen.queryByText('TO-REVOKE')).not.toBeInTheDocument();
    });
  });
});

describe('JoinByCodeDialog', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useRoomStore.setState(useRoomStore.getInitialState());
  });

  it('renders join form', () => {
    render(<JoinByCodeDialog open={true} onOpenChange={() => {}} />);
    expect(screen.getByText('Join Room')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter invite code')).toBeInTheDocument();
  });

  it('validates code is required', async () => {
    render(<JoinByCodeDialog open={true} onOpenChange={() => {}} />);
    fireEvent.click(screen.getByText('Join'));
    await waitFor(() => {
      expect(screen.getByText(/invite code is required/i)).toBeInTheDocument();
    });
  });

  it('joins room via code and navigates (TC-5-OPS-021)', async () => {
    const { joinByInviteCode } = await import('@/lib/api/invite');
    const { listRooms } = await import('@/lib/api/rooms');
    const joinedRoom = {
      room_id: 'joined-r1',
      name: 'Joined Room',
      members: [],
      config: {},
      enabled_extensions: [],
    };
    (joinByInviteCode as ReturnType<typeof vi.fn>).mockResolvedValue({ room_id: 'joined-r1', room_name: 'Joined Room' });
    (listRooms as ReturnType<typeof vi.fn>).mockResolvedValue([joinedRoom]);

    const onOpenChange = vi.fn();
    render(<JoinByCodeDialog open={true} onOpenChange={onOpenChange} />);

    fireEvent.change(screen.getByPlaceholderText('Enter invite code'), { target: { value: 'ABC-123' } });
    fireEvent.click(screen.getByText('Join'));

    await waitFor(() => {
      expect(joinByInviteCode).toHaveBeenCalledWith('ABC-123');
      expect(useRoomStore.getState().activeRoomId).toBe('joined-r1');
    });
  });

  it('shows error for invalid code', async () => {
    const { joinByInviteCode } = await import('@/lib/api/invite');
    (joinByInviteCode as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Invalid code'));

    render(<JoinByCodeDialog open={true} onOpenChange={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText('Enter invite code'), { target: { value: 'BAD' } });
    fireEvent.click(screen.getByText('Join'));

    await waitFor(() => {
      expect(screen.getByText('Invalid code')).toBeInTheDocument();
    });
  });
});
