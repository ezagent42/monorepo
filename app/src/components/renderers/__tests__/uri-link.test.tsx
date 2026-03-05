import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UriLink, buildEzagentUri } from '../uri-link';
import { MessageBubble } from '@/components/chat/MessageBubble';
import type { Message } from '@/types';

// Mock Radix ContextMenu to render inline (portals don't work in jsdom)
vi.mock('@radix-ui/react-context-menu', async () => {
  const React = await import('react');
  return {
    Root: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Trigger: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean }>(
      ({ children, asChild, ...props }, ref) => {
        if (asChild && React.isValidElement(children)) {
          return React.cloneElement(children as React.ReactElement<any>, { ref });
        }
        return <div ref={ref} {...props}>{children}</div>;
      }
    ),
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Content: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
      ({ children, ...props }, ref) => <div ref={ref} data-testid="context-menu-content" {...props}>{children}</div>
    ),
    Item: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { onSelect?: () => void }>(
      ({ children, onSelect, ...props }, ref) => (
        <div ref={ref} role="menuitem" onClick={onSelect} {...props}>{children}</div>
      )
    ),
    Separator: React.forwardRef<HTMLHRElement, React.HTMLAttributes<HTMLHRElement>>(
      (props, ref) => <hr ref={ref} {...props} />
    ),
    Label: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
      ({ children, ...props }, ref) => <div ref={ref} {...props}>{children}</div>
    ),
    CheckboxItem: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
      ({ children, ...props }, ref) => <div ref={ref} {...props}>{children}</div>
    ),
    RadioItem: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
      ({ children, ...props }, ref) => <div ref={ref} {...props}>{children}</div>
    ),
    RadioGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Sub: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SubTrigger: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
      ({ children, ...props }, ref) => <div ref={ref} {...props}>{children}</div>
    ),
    SubContent: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
      ({ children, ...props }, ref) => <div ref={ref} {...props}>{children}</div>
    ),
    Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ItemIndicator: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  };
});

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    ref_id: 'msg-1',
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

// --- buildEzagentUri tests (TC-5-URI-002) ---

describe('buildEzagentUri', () => {
  it('builds room URI (TC-5-URI-002)', () => {
    expect(buildEzagentUri('room-1')).toBe('ezagent://room/room-1');
  });

  it('builds message URI (TC-5-URI-002)', () => {
    expect(buildEzagentUri('room-1', 'msg-1')).toBe(
      'ezagent://room/room-1/message/msg-1'
    );
  });

  it('encodes special characters in room ID', () => {
    expect(buildEzagentUri('room with spaces')).toBe(
      'ezagent://room/room%20with%20spaces'
    );
  });

  it('encodes special characters in message ID', () => {
    expect(buildEzagentUri('r1', 'msg/special')).toBe(
      'ezagent://room/r1/message/msg%2Fspecial'
    );
  });
});

// --- UriLink tests (TC-5-URI-003) ---

describe('UriLink', () => {
  it('renders ezagent:// URIs as clickable links (TC-5-URI-003)', () => {
    render(<UriLink text="Check ezagent://room/abc for details" />);
    const link = screen.getByTestId('uri-link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'ezagent://room/abc');
    expect(link.textContent).toContain('ezagent://room/abc');
  });

  it('renders non-URI text as plain text (TC-5-URI-003)', () => {
    render(<UriLink text="Just plain text without any URIs" />);
    expect(screen.queryByTestId('uri-link')).not.toBeInTheDocument();
    expect(screen.getByText('Just plain text without any URIs')).toBeInTheDocument();
  });

  it('renders multiple URIs in text', () => {
    render(
      <UriLink text="Room ezagent://room/a and ezagent://room/b" />
    );
    const links = screen.getAllByTestId('uri-link');
    expect(links).toHaveLength(2);
    expect(links[0].textContent).toContain('ezagent://room/a');
    expect(links[1].textContent).toContain('ezagent://room/b');
  });

  it('dispatches ezagent:navigate event on click', () => {
    const handler = vi.fn();
    window.addEventListener('ezagent:navigate', handler as EventListener);

    render(<UriLink text="Visit ezagent://room/abc" />);
    const link = screen.getByTestId('uri-link');
    fireEvent.click(link);

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ type: 'room', roomId: 'abc' });

    window.removeEventListener('ezagent:navigate', handler as EventListener);
  });

  it('shows room icon for room URIs', () => {
    render(<UriLink text="ezagent://room/abc" />);
    const link = screen.getByTestId('uri-link');
    // Check that the link icon area contains the link emoji (U+1F517)
    expect(link.textContent).toContain('\uD83D\uDD17');
  });

  it('shows message icon for message URIs', () => {
    render(<UriLink text="ezagent://room/abc/message/m1" />);
    const link = screen.getByTestId('uri-link');
    // Check that the link icon area contains the speech balloon emoji (U+1F4AC)
    expect(link.textContent).toContain('\uD83D\uDCAC');
  });
});

// --- MessageBubble context menu test (TC-5-URI-003) ---

describe('MessageBubble context menu', () => {
  it('has context menu with "Copy ezagent URI" (TC-5-URI-003)', () => {
    const msg = makeMessage();
    render(<MessageBubble message={msg} />);
    // The mocked ContextMenu renders everything inline, so the menu item is visible
    expect(screen.getByText('Copy ezagent URI')).toBeInTheDocument();
  });

  it('renders message body', () => {
    const msg = makeMessage({ body: 'Test body' });
    render(<MessageBubble message={msg} />);
    expect(screen.getByText('Test body')).toBeInTheDocument();
  });

  it('renders author name', () => {
    const msg = makeMessage({ author: '@bob:relay.ezagent.dev' });
    render(<MessageBubble message={msg} />);
    expect(screen.getByText('@bob:relay.ezagent.dev')).toBeInTheDocument();
  });
});
