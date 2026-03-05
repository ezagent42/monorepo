import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DecoratorLayer } from '../DecoratorLayer';
import { EmojiBar } from '../emoji-bar';
import { QuotePreview } from '../quote-preview';
import { TextTag } from '../text-tag';
import { ThreadIndicator } from '../thread-indicator';
import { TagList } from '../tag-list';
import { RedactOverlay } from '../redact-overlay';
import type { Message } from '@/types';
import type { DecoratorConfig } from '@/types/renderer';

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    ref_id: 'ref-1',
    room_id: 'room-1',
    author: '@alice:relay.ezagent.dev',
    timestamp: '2026-03-04T10:00:00Z',
    datatype: 'message',
    body: 'Hello world',
    annotations: {},
    ext: {},
    ...overrides,
  };
}

// TC-5-DECOR-001: emoji_bar
describe('EmojiBar', () => {
  it('renders reaction counts (TC-5-DECOR-001)', () => {
    const msg = makeMessage({
      ext: {
        reactions: {
          '\ud83d\udc4d:@alice:relay.ezagent.dev': 1700000000,
          '\u2764\ufe0f:@bob:relay.ezagent.dev': 1700000001,
        },
      },
    });
    render(<EmojiBar message={msg} />);
    expect(screen.getByText('\ud83d\udc4d')).toBeInTheDocument();
    expect(screen.getByText('\u2764\ufe0f')).toBeInTheDocument();
  });

  it('returns null when no reactions', () => {
    const msg = makeMessage();
    const { container } = render(<EmojiBar message={msg} />);
    expect(container.innerHTML).toBe('');
  });

  it('groups multiple reactions to same emoji', () => {
    const msg = makeMessage({
      ext: {
        reactions: {
          '\ud83d\udc4d:@alice:relay': 1,
          '\ud83d\udc4d:@bob:relay': 2,
        },
      },
    });
    render(<EmojiBar message={msg} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});

// TC-5-DECOR-002: quote_preview
describe('QuotePreview', () => {
  it('renders reply preview (TC-5-DECOR-002)', () => {
    const msg = makeMessage({
      ext: {
        reply_to: { author: '@alice:relay', body: 'Hello world', ref_id: 'ref-0' },
      },
    });
    render(<QuotePreview message={msg} />);
    expect(screen.getByText('@alice:relay:')).toBeInTheDocument();
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('returns null when no reply_to', () => {
    const msg = makeMessage();
    const { container } = render(<QuotePreview message={msg} />);
    expect(container.innerHTML).toBe('');
  });
});

// TC-5-DECOR-003: text_tag "(edited)"
describe('TextTag', () => {
  it('renders (edited) when version > 1 (TC-5-DECOR-003)', () => {
    const msg = makeMessage({ ext: { mutable: { version: 2 } } });
    render(<TextTag message={msg} />);
    expect(screen.getByText('(edited)')).toBeInTheDocument();
  });

  it('returns null when version is 1', () => {
    const msg = makeMessage({ ext: { mutable: { version: 1 } } });
    const { container } = render(<TextTag message={msg} />);
    expect(container.innerHTML).toBe('');
  });
});

// TC-5-DECOR-004: thread_indicator
describe('ThreadIndicator', () => {
  it('renders thread reply count and participants (TC-5-DECOR-004)', () => {
    const msg = makeMessage({
      ext: {
        thread: {
          reply_count: 3,
          participants: ['@alice:relay', '@bob:relay'],
        },
      },
    });
    render(<ThreadIndicator message={msg} />);
    expect(screen.getByText('3 replies')).toBeInTheDocument();
    expect(screen.getByText(/Alice, Bob/)).toBeInTheDocument();
  });

  it('uses singular "reply" for count 1', () => {
    const msg = makeMessage({
      ext: { thread: { reply_count: 1, participants: [] } },
    });
    render(<ThreadIndicator message={msg} />);
    expect(screen.getByText('1 reply')).toBeInTheDocument();
  });
});

// TC-5-DECOR-005: tag_list
describe('TagList', () => {
  it('renders channel tags (TC-5-DECOR-005)', () => {
    const msg = makeMessage({
      ext: { channels: ['code-review', 'urgent'] },
    });
    render(<TagList message={msg} />);
    expect(screen.getByText('#code-review')).toBeInTheDocument();
    expect(screen.getByText('#urgent')).toBeInTheDocument();
  });
});

// TC-5-DECOR-006: redact_overlay
describe('RedactOverlay', () => {
  it('renders overlay when redacted (TC-5-DECOR-006)', () => {
    const msg = makeMessage({
      ext: { moderation: { redacted: true } },
    });
    render(<RedactOverlay message={msg} />);
    expect(screen.getByText('Message has been hidden')).toBeInTheDocument();
  });

  it('returns null when not redacted', () => {
    const msg = makeMessage();
    const { container } = render(<RedactOverlay message={msg} />);
    expect(container.innerHTML).toBe('');
  });
});

// TC-5-DECOR-007: Decorator render order
describe('DecoratorLayer', () => {
  it('renders decorators sorted by priority within position (TC-5-DECOR-007)', () => {
    const msg = makeMessage({
      ext: {
        reactions: { '\ud83d\udc4d:@alice:relay': 1 },
        channels: ['urgent'],
        thread: { reply_count: 3, participants: ['@alice:relay'] },
      },
    });

    const decorators: DecoratorConfig[] = [
      { type: 'tag_list', position: 'below', priority: 50 },
      { type: 'emoji_bar', position: 'below', priority: 40 },
      { type: 'thread_indicator', position: 'below', priority: 45 },
    ];

    render(<DecoratorLayer message={msg} decorators={decorators} position="below" />);

    const emojiBar = screen.getByTestId('emoji-bar');
    const threadIndicator = screen.getByTestId('thread-indicator');
    const tagList = screen.getByTestId('tag-list');

    // Verify order: emoji_bar (40) before thread_indicator (45) before tag_list (50)
    const container = emojiBar.parentElement!;
    const children = Array.from(container.children);
    const emojiIdx = children.indexOf(emojiBar);
    const threadIdx = children.indexOf(threadIndicator);
    const tagIdx = children.indexOf(tagList);
    expect(emojiIdx).toBeLessThan(threadIdx);
    expect(threadIdx).toBeLessThan(tagIdx);
  });

  it('filters decorators by position', () => {
    const msg = makeMessage({
      ext: {
        reactions: { '\ud83d\udc4d:@alice:relay': 1 },
        reply_to: { author: '@bob:relay', body: 'hey' },
      },
    });

    const decorators: DecoratorConfig[] = [
      { type: 'quote_preview', position: 'above', priority: 30 },
      { type: 'emoji_bar', position: 'below', priority: 40 },
    ];

    // Only render "above" position
    render(<DecoratorLayer message={msg} decorators={decorators} position="above" />);
    expect(screen.getByTestId('quote-preview')).toBeInTheDocument();
    expect(screen.queryByTestId('emoji-bar')).not.toBeInTheDocument();
  });

  it('returns null when no matching decorators', () => {
    const msg = makeMessage();
    const { container } = render(
      <DecoratorLayer message={msg} decorators={[]} position="below" />,
    );
    expect(container.innerHTML).toBe('');
  });
});
