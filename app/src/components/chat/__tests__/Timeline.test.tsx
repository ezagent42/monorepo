import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useMessageStore } from '@/stores/message-store';

// Mock @tanstack/react-virtual to avoid useSyncExternalStore infinite loop in jsdom + React 19
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn(({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        key: String(i),
        start: i * 72,
        size: 72,
      })),
    getTotalSize: () => count * 72,
    scrollToIndex: vi.fn(),
    measureElement: vi.fn(),
  })),
}));

// Import after mock setup
import { Timeline } from '../Timeline';

describe('Timeline', () => {
  beforeEach(() => {
    useMessageStore.setState(useMessageStore.getInitialState());
  });

  it('shows empty state when no messages', () => {
    const { container } = render(<Timeline roomId="room-1" />);
    expect(screen.getByText(/no messages/i)).toBeInTheDocument();
  });

  it('renders message content', () => {
    useMessageStore.setState({
      messagesByRoom: {
        'room-1': [
          {
            ref_id: 'msg-1',
            room_id: 'room-1',
            author: '@alice:relay.ezagent.dev',
            timestamp: '2026-03-04T10:00:00Z',
            datatype: 'message',
            body: 'Hello world!',
            annotations: {},
            ext: {},
          },
        ],
      },
    });
    render(<Timeline roomId="room-1" />);
    expect(screen.getByText('Hello world!')).toBeInTheDocument();
    expect(screen.getByText('@alice:relay.ezagent.dev')).toBeInTheDocument();
  });

  it('renders multiple messages', () => {
    useMessageStore.setState({
      messagesByRoom: {
        'room-1': [
          { ref_id: '1', room_id: 'room-1', author: '@alice', timestamp: '2026-03-04T10:00:00Z', datatype: 'message', body: 'First', annotations: {}, ext: {} },
          { ref_id: '2', room_id: 'room-1', author: '@bob', timestamp: '2026-03-04T10:01:00Z', datatype: 'message', body: 'Second', annotations: {}, ext: {} },
        ],
      },
    });
    render(<Timeline roomId="room-1" />);
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });
});
