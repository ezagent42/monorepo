import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SearchModal } from '../SearchModal';
import { useRoomStore } from '@/stores/room-store';

const mockSearchMessages = vi.fn().mockResolvedValue({ messages: [] });
const mockSearchPeople = vi.fn().mockResolvedValue({ entities: [] });
const mockApiGet = vi.fn().mockResolvedValue([]);

vi.mock('@/lib/api/search', () => ({
  searchMessages: (...args: unknown[]) => mockSearchMessages(...args),
  searchPeople: (...args: unknown[]) => mockSearchPeople(...args),
}));

vi.mock('@/lib/api/client', () => ({
  api: { get: (...args: unknown[]) => mockApiGet(...args) },
}));

describe('SearchModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchMessages.mockResolvedValue({ messages: [] });
    mockSearchPeople.mockResolvedValue({ entities: [] });
    mockApiGet.mockResolvedValue([]);
    useRoomStore.setState({
      ...useRoomStore.getInitialState(),
      rooms: [
        { room_id: 'r1', name: 'General', members: [], config: {}, enabled_extensions: [] },
        { room_id: 'r2', name: 'Random', members: [], config: {}, enabled_extensions: [] },
      ],
      activeRoomId: 'r1',
    });
  });

  it('renders search input when open', () => {
    render(<SearchModal open={true} onOpenChange={() => {}} />);
    expect(screen.getByPlaceholderText(/search rooms/i)).toBeInTheDocument();
  });

  it('filters joined rooms locally (TC-5-OPS-061)', async () => {
    render(<SearchModal open={true} onOpenChange={() => {}} />);
    const input = screen.getByPlaceholderText(/search rooms/i);
    fireEvent.change(input, { target: { value: 'Gen' } });
    await waitFor(() => {
      expect(screen.getByText('General')).toBeInTheDocument();
    });
  });

  it('searches people via API (TC-5-OPS-062)', async () => {
    mockSearchPeople.mockResolvedValue({
      entities: [{ entity_id: '@bob', display_name: 'Bob' }],
    });

    render(<SearchModal open={true} onOpenChange={() => {}} />);
    const input = screen.getByPlaceholderText(/search rooms/i);
    fireEvent.change(input, { target: { value: 'Bob' } });

    await waitFor(() => {
      expect(mockSearchPeople).toHaveBeenCalledWith('Bob');
    }, { timeout: 1000 });
  });

  it('searches messages via API (TC-5-OPS-063)', async () => {
    mockSearchMessages.mockResolvedValue({
      messages: [
        { ref_id: 'm1', room_id: 'r1', author: '@alice', body: 'Hello world', room_name: 'General', timestamp: '', datatype: 'message', annotations: {}, ext: {} },
      ],
    });

    render(<SearchModal open={true} onOpenChange={() => {}} />);
    const input = screen.getByPlaceholderText(/search rooms/i);
    fireEvent.change(input, { target: { value: 'Hello' } });

    await waitFor(() => {
      expect(mockSearchMessages).toHaveBeenCalled();
    }, { timeout: 1000 });
  });

  it('toggles scope All/Room (TC-5-OPS-064)', () => {
    render(<SearchModal open={true} onOpenChange={() => {}} />);
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Room')).toBeInTheDocument();
  });

  it('switches to command mode on "/" input (TC-5-OPS-065)', async () => {
    render(<SearchModal open={true} onOpenChange={() => {}} />);
    const input = screen.getByPlaceholderText(/search rooms/i);
    fireEvent.change(input, { target: { value: '/' } });
    await waitFor(() => {
      expect(screen.getByText('Commands')).toBeInTheDocument();
    });
  });
});
