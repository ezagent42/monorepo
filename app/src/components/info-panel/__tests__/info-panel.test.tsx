import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemberList } from '../MemberList';
import { PinnedMessages } from '../PinnedMessages';
import { MediaGallery } from '../MediaGallery';
import { ThreadPanel } from '../ThreadPanel';
import { TypingIndicator } from '../../decorators/typing-indicator';
import { PresenceDot } from '../../decorators/presence-dot';
import { usePresenceStore } from '@/stores/presence-store';
import type { Message, RoomMember } from '@/types';

// Reset presence store between tests
beforeEach(() => {
  usePresenceStore.setState({
    onlineUsers: {},
    typingUsers: {},
    _typingTimeouts: {},
  });
});

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    ref_id: 'ref-1',
    room_id: 'room-1',
    author: '@alice:relay',
    timestamp: '2026-03-04T10:00:00Z',
    datatype: 'message',
    body: 'Hello',
    annotations: {},
    ext: {},
    ...overrides,
  };
}

const members: RoomMember[] = [
  { entity_id: '@alice:relay', display_name: 'Alice', is_online: true, roles: [] },
  { entity_id: '@bob:relay', display_name: 'Bob', is_online: false, roles: [] },
];

// Mock the messages API to avoid actual fetch calls in ComposeArea
vi.mock('@/lib/api/messages', () => ({
  sendMessage: vi.fn().mockResolvedValue({ ref_id: 'new-ref' }),
  listMessages: vi.fn().mockResolvedValue([]),
  addReaction: vi.fn().mockResolvedValue({ ok: true }),
}));

describe('MemberList (TC-5-UI-006)', () => {
  it('renders member list with count', () => {
    render(<MemberList members={members} />);
    expect(screen.getByText('Members (2)')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('sorts online members first', () => {
    usePresenceStore.setState({ onlineUsers: { 'room-1': ['@alice:relay'] } });
    render(<MemberList members={members} />);
    const items = screen.getByTestId('member-list');
    const names = Array.from(items.querySelectorAll('.text-sm')).map((el) => el.textContent);
    expect(names[0]).toBe('Alice');
    expect(names[1]).toBe('Bob');
  });
});

describe('PresenceDot (TC-5-DECOR-008)', () => {
  it('shows green dot when user is online', () => {
    usePresenceStore.setState({ onlineUsers: { 'room-1': ['@alice:relay'] } });
    render(<PresenceDot entityId="@alice:relay" />);
    expect(screen.getByTestId('presence-dot')).toBeInTheDocument();
  });

  it('hides when user is offline', () => {
    render(<PresenceDot entityId="@alice:relay" />);
    expect(screen.queryByTestId('presence-dot')).not.toBeInTheDocument();
  });
});

describe('TypingIndicator (TC-5-DECOR-008)', () => {
  it('shows typing indicator', () => {
    usePresenceStore.setState({ typingUsers: { 'room-1': ['@bob:relay'] } });
    render(<TypingIndicator roomId="room-1" />);
    expect(screen.getByText('Bob is typing...')).toBeInTheDocument();
  });

  it('shows multiple users typing', () => {
    usePresenceStore.setState({ typingUsers: { 'room-1': ['@alice:relay', '@bob:relay'] } });
    render(<TypingIndicator roomId="room-1" />);
    expect(screen.getByText('Alice, Bob are typing...')).toBeInTheDocument();
  });

  it('hidden when no one is typing', () => {
    render(<TypingIndicator roomId="room-1" />);
    expect(screen.queryByTestId('typing-indicator')).not.toBeInTheDocument();
  });
});

describe('PinnedMessages (TC-5-UI-007)', () => {
  it('renders pinned messages', () => {
    const messages = [
      makeMessage({ ref_id: 'p1', body: 'Important note', annotations: { pinned: true } }),
      makeMessage({ ref_id: 'p2', body: 'Regular msg' }),
    ];
    render(<PinnedMessages messages={messages} />);
    expect(screen.getByText('Pinned (1)')).toBeInTheDocument();
    expect(screen.getByText('Important note')).toBeInTheDocument();
    expect(screen.queryByText('Regular msg')).not.toBeInTheDocument();
  });

  it('shows empty state', () => {
    render(<PinnedMessages messages={[]} />);
    expect(screen.getByText('No pinned messages')).toBeInTheDocument();
  });
});

describe('MediaGallery (TC-5-UI-008)', () => {
  it('renders media thumbnails', () => {
    const messages = [
      makeMessage({
        ref_id: 'img-1',
        schema: {
          mime_type: { type: 'string', value: 'image/png' },
          url: { type: 'string', value: 'https://example.com/a.png' },
          filename: { type: 'string', value: 'a.png' },
        },
      }),
    ];
    render(<MediaGallery messages={messages} />);
    expect(screen.getByText('Media (1)')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('alt', 'a.png');
  });

  it('shows empty state', () => {
    render(<MediaGallery messages={[]} />);
    expect(screen.getByText('No media shared')).toBeInTheDocument();
  });
});

describe('ThreadPanel (TC-5-UI-009)', () => {
  it('renders parent message and replies', () => {
    const parent = makeMessage({ ref_id: 'parent', body: 'Original question' });
    const replies = [
      makeMessage({ ref_id: 'reply-1', body: 'First reply' }),
      makeMessage({ ref_id: 'reply-2', body: 'Second reply' }),
    ];
    render(
      <ThreadPanel parentMessage={parent} replies={replies} roomId="room-1" onClose={vi.fn()} />,
    );
    expect(screen.getByText('Thread')).toBeInTheDocument();
    expect(screen.getByText('Original question')).toBeInTheDocument();
    expect(screen.getByText('First reply')).toBeInTheDocument();
    expect(screen.getByText('Second reply')).toBeInTheDocument();
  });

  it('shows empty state for no replies', () => {
    const parent = makeMessage({ body: 'Question' });
    render(
      <ThreadPanel parentMessage={parent} replies={[]} roomId="room-1" onClose={vi.fn()} />,
    );
    expect(screen.getByText('No replies yet')).toBeInTheDocument();
  });
});
