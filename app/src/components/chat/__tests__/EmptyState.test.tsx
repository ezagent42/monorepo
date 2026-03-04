import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EmptyState } from '../EmptyState';
import { useRoomStore } from '@/stores/room-store';

// Mock the rooms API module
vi.mock('@/lib/api/rooms', () => ({
  createRoom: vi.fn(),
}));

describe('EmptyState (TC-5-JOURNEY-002)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useRoomStore.setState(useRoomStore.getInitialState());
  });

  it('renders welcome message', () => {
    render(<EmptyState />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('Welcome to EZAgent')).toBeInTheDocument();
  });

  it('renders "Create a room" button', () => {
    render(<EmptyState />);
    expect(screen.getByText('Create a room')).toBeInTheDocument();
  });

  it('renders "Enter invite code" button', () => {
    render(<EmptyState />);
    expect(screen.getByText('Enter invite code')).toBeInTheDocument();
  });

  it('opens CreateRoomDialog when "Create a room" is clicked', async () => {
    render(<EmptyState />);
    fireEvent.click(screen.getByText('Create a room'));
    await waitFor(() => {
      expect(screen.getByText('Create Room')).toBeInTheDocument();
    });
  });
});

describe('CreateRoomDialog (TC-5-JOURNEY-002)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useRoomStore.setState(useRoomStore.getInitialState());
  });

  it('validates room name is required', async () => {
    render(<EmptyState />);

    // Open the dialog
    fireEvent.click(screen.getByText('Create a room'));
    await waitFor(() => {
      expect(screen.getByText('Create Room')).toBeInTheDocument();
    });

    // Find the Create button inside the dialog footer (not the "Create a room" trigger)
    const buttons = screen.getAllByRole('button');
    const createButton = buttons.find(
      (btn) => btn.textContent === 'Create'
    )!;
    expect(createButton).toBeDefined();

    fireEvent.click(createButton);

    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText(/room name is required/i)).toBeInTheDocument();
    });
  });

  it('calls API and updates store on success', async () => {
    const { createRoom } = await import('@/lib/api/rooms');
    const mockRoom = {
      room_id: 'new-room-1',
      name: 'My New Room',
      members: [],
      config: {},
      enabled_extensions: [],
    };
    (createRoom as ReturnType<typeof vi.fn>).mockResolvedValue(mockRoom);

    render(<EmptyState />);

    // Open the dialog
    fireEvent.click(screen.getByText('Create a room'));
    await waitFor(() => {
      expect(screen.getByText('Create Room')).toBeInTheDocument();
    });

    // Fill in the room name
    const nameInput = screen.getByPlaceholderText('Room name');
    fireEvent.change(nameInput, { target: { value: 'My New Room' } });

    // Click the Create button in the dialog
    const buttons = screen.getAllByRole('button');
    const createButton = buttons.find(
      (btn) => btn.textContent === 'Create'
    )!;
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(createRoom).toHaveBeenCalledWith({
        name: 'My New Room',
        description: '',
      });
    });

    // Verify room was added to store and set as active
    await waitFor(() => {
      const state = useRoomStore.getState();
      expect(state.rooms).toContainEqual(mockRoom);
      expect(state.activeRoomId).toBe('new-room-1');
    });
  });

  it('shows loading state during creation', async () => {
    const { createRoom } = await import('@/lib/api/rooms');
    // Create a promise that we can control
    let resolveCreate!: (value: unknown) => void;
    (createRoom as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((resolve) => { resolveCreate = resolve; })
    );

    render(<EmptyState />);

    // Open the dialog
    fireEvent.click(screen.getByText('Create a room'));
    await waitFor(() => {
      expect(screen.getByText('Create Room')).toBeInTheDocument();
    });

    // Fill in room name
    const nameInput = screen.getByPlaceholderText('Room name');
    fireEvent.change(nameInput, { target: { value: 'Test Room' } });

    // Click Create
    const buttons = screen.getAllByRole('button');
    const createButton = buttons.find(
      (btn) => btn.textContent === 'Create'
    )!;
    fireEvent.click(createButton);

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText('Creating...')).toBeInTheDocument();
    });

    // Resolve the promise
    resolveCreate({
      room_id: 'new-1',
      name: 'Test Room',
      members: [],
      config: {},
      enabled_extensions: [],
    });

    // Loading state should clear
    await waitFor(() => {
      expect(screen.queryByText('Creating...')).not.toBeInTheDocument();
    });
  });
});
