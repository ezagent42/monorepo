import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ComposeArea } from '../ComposeArea';

// Mock the messages API
vi.mock('@/lib/api/messages', () => ({
  sendMessage: vi.fn(),
}));

// Mock Popover portal to render inline for test accessibility
vi.mock('@radix-ui/react-popover', async () => {
  const React = await import('react');
  return {
    Root: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Trigger: React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }>(
      ({ children, asChild, ...props }, ref) => {
        if (asChild && React.isValidElement(children)) {
          return React.cloneElement(children as React.ReactElement<any>, { ...props, ref });
        }
        return <button ref={ref} {...props}>{children}</button>;
      }
    ),
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Content: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
      ({ children, ...props }, ref) => <div ref={ref} {...props}>{children}</div>
    ),
  };
});

describe('ComposeArea', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders textarea and send button', () => {
    render(<ComposeArea roomId="room-1" />);
    expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument();
    expect(screen.getByText('Send')).toBeInTheDocument();
  });

  it('send button is disabled when textarea is empty', () => {
    render(<ComposeArea roomId="room-1" />);
    expect(screen.getByText('Send')).toBeDisabled();
  });

  it('send button is enabled when text is entered', () => {
    render(<ComposeArea roomId="room-1" />);
    fireEvent.change(screen.getByPlaceholderText('Type a message...'), {
      target: { value: 'Hello' },
    });
    expect(screen.getByText('Send')).not.toBeDisabled();
  });

  it('Enter key triggers send (TC-5-UI-004)', async () => {
    const { sendMessage } = await import('@/lib/api/messages');
    (sendMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ ref_id: 'msg-1' });

    render(<ComposeArea roomId="room-1" />);
    const textarea = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith('room-1', { body: 'Hello' });
    });
  });

  it('Shift+Enter does not send', async () => {
    const { sendMessage } = await import('@/lib/api/messages');

    render(<ComposeArea roomId="room-1" />);
    const textarea = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    // Give time for any async operations
    await new Promise((r) => setTimeout(r, 50));
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('clears input after successful send', async () => {
    const { sendMessage } = await import('@/lib/api/messages');
    (sendMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ ref_id: 'msg-1' });

    render(<ComposeArea roomId="room-1" />);
    const textarea = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.click(screen.getByText('Send'));

    await waitFor(() => {
      expect(textarea).toHaveValue('');
    });
  });

  it('shows emoji picker button (TC-5-UI-005)', () => {
    render(<ComposeArea roomId="room-1" />);
    expect(screen.getByLabelText('Open emoji picker')).toBeInTheDocument();
  });
});
