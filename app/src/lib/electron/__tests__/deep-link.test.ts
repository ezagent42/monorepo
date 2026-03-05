import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseDeepLink } from '../deep-link';

describe('parseDeepLink', () => {
  // TC-5-URI-001: parseDeepLink returns room target for ezagent://room/abc
  it('returns room target for ezagent://room/abc (TC-5-URI-001)', () => {
    const result = parseDeepLink('ezagent://room/abc');
    expect(result).toEqual({ type: 'room', roomId: 'abc' });
  });

  // TC-5-URI-001: parseDeepLink returns message target for ezagent://room/abc/message/msg-1
  it('returns message target for ezagent://room/abc/message/msg-1 (TC-5-URI-001)', () => {
    const result = parseDeepLink('ezagent://room/abc/message/msg-1');
    expect(result).toEqual({ type: 'message', roomId: 'abc', messageId: 'msg-1' });
  });

  // TC-5-URI-001: parseDeepLink returns null for invalid URL
  it('returns null for invalid URL (TC-5-URI-001)', () => {
    expect(parseDeepLink('not-a-url')).toBeNull();
  });

  // TC-5-URI-001: parseDeepLink returns null for non-ezagent protocol
  it('returns null for non-ezagent protocol (TC-5-URI-001)', () => {
    expect(parseDeepLink('https://example.com/room/abc')).toBeNull();
  });

  it('returns null for ezagent:// with no path segments', () => {
    expect(parseDeepLink('ezagent://room')).toBeNull();
    expect(parseDeepLink('ezagent://room/')).toBeNull();
  });

  it('returns null for unknown host', () => {
    expect(parseDeepLink('ezagent://settings/theme')).toBeNull();
  });

  it('returns null for incomplete message path', () => {
    // Only roomId + "message" without messageId
    expect(parseDeepLink('ezagent://room/abc/message')).toBeNull();
  });

  it('handles URL-encoded room IDs', () => {
    const result = parseDeepLink('ezagent://room/my%20room');
    expect(result).toEqual({ type: 'room', roomId: 'my room' });
  });

  it('handles complex room and message IDs', () => {
    const result = parseDeepLink('ezagent://room/room-123-abc/message/msg-456-def');
    expect(result).toEqual({
      type: 'message',
      roomId: 'room-123-abc',
      messageId: 'msg-456-def',
    });
  });
});

// Capture the callback registered by useDeepLink via the mocked electronApp
const capturedCallbacks: Array<(url: string) => void> = [];

vi.mock('@/lib/electron/ipc', () => ({
  electronApp: {
    onDeepLink: (cb: (url: string) => void) => {
      capturedCallbacks.push(cb);
    },
  },
}));

describe('useDeepLink', () => {
  beforeEach(() => {
    capturedCallbacks.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('navigates to room on deep-link event', async () => {
    const { useDeepLink } = await import('../deep-link');
    const { useRoomStore } = await import('@/stores/room-store');
    const { renderHook } = await import('@testing-library/react');

    // Reset state
    useRoomStore.setState({ activeRoomId: null });

    renderHook(() => useDeepLink());

    expect(capturedCallbacks.length).toBeGreaterThan(0);

    // Simulate a deep link
    const cb = capturedCallbacks[capturedCallbacks.length - 1];
    cb('ezagent://room/test-room');

    expect(useRoomStore.getState().activeRoomId).toBe('test-room');
  });

  it('dispatches ezagent:navigate event for message targets', async () => {
    const { useDeepLink } = await import('../deep-link');
    const { renderHook } = await import('@testing-library/react');

    const navigateHandler = vi.fn();
    window.addEventListener('ezagent:navigate', navigateHandler as EventListener);

    renderHook(() => useDeepLink());

    expect(capturedCallbacks.length).toBeGreaterThan(0);
    const cb = capturedCallbacks[capturedCallbacks.length - 1];
    cb('ezagent://room/r1/message/m1');

    expect(navigateHandler).toHaveBeenCalledTimes(1);
    const event = navigateHandler.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ type: 'message', roomId: 'r1', messageId: 'm1' });

    window.removeEventListener('ezagent:navigate', navigateHandler as EventListener);
  });

  it('does not navigate for invalid URLs', async () => {
    const { useDeepLink } = await import('../deep-link');
    const { useRoomStore } = await import('@/stores/room-store');
    const { renderHook } = await import('@testing-library/react');

    // Reset state
    useRoomStore.setState({ activeRoomId: null });

    renderHook(() => useDeepLink());

    expect(capturedCallbacks.length).toBeGreaterThan(0);
    const cb = capturedCallbacks[capturedCallbacks.length - 1];
    cb('https://example.com/bad');

    expect(useRoomStore.getState().activeRoomId).toBeNull();
  });
});
