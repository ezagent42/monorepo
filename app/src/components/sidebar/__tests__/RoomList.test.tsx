import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RoomList } from '../RoomList';
import { useRoomStore } from '@/stores/room-store';

describe('RoomList', () => {
  beforeEach(() => {
    useRoomStore.setState(useRoomStore.getInitialState());
  });

  it('renders empty state when no rooms', () => {
    render(<RoomList />);
    expect(screen.getByText(/no rooms/i)).toBeInTheDocument();
  });

  it('renders room names', () => {
    useRoomStore.setState({
      rooms: [
        { room_id: '1', name: 'General', members: [], config: {}, enabled_extensions: [] },
        { room_id: '2', name: 'Random', members: [], config: {}, enabled_extensions: [] },
      ],
    });
    render(<RoomList />);
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Random')).toBeInTheDocument();
  });

  it('shows unread badge', () => {
    useRoomStore.setState({
      rooms: [
        { room_id: '1', name: 'General', members: [], config: {}, enabled_extensions: [], unread_count: 5 },
      ],
    });
    render(<RoomList />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('sorts rooms with unread first', () => {
    useRoomStore.setState({
      rooms: [
        { room_id: '1', name: 'Alpha', members: [], config: {}, enabled_extensions: [], unread_count: 0 },
        { room_id: '2', name: 'Beta', members: [], config: {}, enabled_extensions: [], unread_count: 3 },
      ],
    });
    render(<RoomList />);
    const items = screen.getAllByRole('button');
    // Beta (with unread) should appear before Alpha
    expect(items[0]).toHaveTextContent('Beta');
    expect(items[1]).toHaveTextContent('Alpha');
  });

  it('clicking room sets active room', () => {
    useRoomStore.setState({
      rooms: [
        { room_id: 'room-1', name: 'General', members: [], config: {}, enabled_extensions: [] },
      ],
    });
    render(<RoomList />);
    fireEvent.click(screen.getByText('General'));
    expect(useRoomStore.getState().activeRoomId).toBe('room-1');
  });

  it('highlights active room', () => {
    useRoomStore.setState({
      rooms: [
        { room_id: 'room-1', name: 'General', members: [], config: {}, enabled_extensions: [] },
        { room_id: 'room-2', name: 'Random', members: [], config: {}, enabled_extensions: [] },
      ],
      activeRoomId: 'room-1',
    });
    render(<RoomList />);
    const buttons = screen.getAllByRole('button');
    // Active room should have the active styling class (exact class, not hover variant)
    const classes0 = buttons[0].className.split(' ');
    const classes1 = buttons[1].className.split(' ');
    expect(classes0).toContain('bg-accent');
    expect(classes1).not.toContain('bg-accent');
  });

  it('filters rooms by search query', () => {
    useRoomStore.setState({
      rooms: [
        { room_id: '1', name: 'General', members: [], config: {}, enabled_extensions: [] },
        { room_id: '2', name: 'Random', members: [], config: {}, enabled_extensions: [] },
        { room_id: '3', name: 'Design', members: [], config: {}, enabled_extensions: [] },
      ],
    });
    render(<RoomList searchQuery="gen" />);
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.queryByText('Random')).not.toBeInTheDocument();
    expect(screen.queryByText('Design')).not.toBeInTheDocument();
  });

  it('does not show badge when unread_count is 0', () => {
    useRoomStore.setState({
      rooms: [
        { room_id: '1', name: 'General', members: [], config: {}, enabled_extensions: [], unread_count: 0 },
      ],
    });
    render(<RoomList />);
    expect(screen.getByText('General')).toBeInTheDocument();
    // Should not have any badge with "0"
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});
