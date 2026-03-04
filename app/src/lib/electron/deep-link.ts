import { useEffect } from 'react';
import { electronApp } from './ipc';
import { useRoomStore } from '@/stores/room-store';

// --- Types ---

export interface DeepLinkRoomTarget {
  type: 'room';
  roomId: string;
}

export interface DeepLinkMessageTarget {
  type: 'message';
  roomId: string;
  messageId: string;
}

export type DeepLinkTarget = DeepLinkRoomTarget | DeepLinkMessageTarget;

// --- Parser ---

const EZAGENT_PROTOCOL = 'ezagent:';

/**
 * Parse an ezagent:// deep link URL and extract navigation target.
 *
 * Supported formats:
 *   ezagent://room/{roomId}
 *   ezagent://room/{roomId}/message/{messageId}
 *
 * Returns null for invalid or non-ezagent URLs.
 */
export function parseDeepLink(url: string): DeepLinkTarget | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== EZAGENT_PROTOCOL) {
    return null;
  }

  // URL parses ezagent://room/abc as hostname='room', pathname='/abc'
  // ezagent://room/abc/message/msg-1 as hostname='room', pathname='/abc/message/msg-1'
  const host = parsed.hostname;
  if (host !== 'room') {
    return null;
  }

  // pathname starts with '/' so split and filter empty segments
  const segments = parsed.pathname.split('/').filter(Boolean);

  if (segments.length === 1) {
    // ezagent://room/{roomId}
    const roomId = decodeURIComponent(segments[0]);
    if (!roomId) return null;
    return { type: 'room', roomId };
  }

  if (segments.length === 3 && segments[1] === 'message') {
    // ezagent://room/{roomId}/message/{messageId}
    const roomId = decodeURIComponent(segments[0]);
    const messageId = decodeURIComponent(segments[2]);
    if (!roomId || !messageId) return null;
    return { type: 'message', roomId, messageId };
  }

  return null;
}

// --- React Hook ---

/**
 * React hook that listens for deep-link events from Electron and navigates
 * to the appropriate room/message.
 *
 * - For room targets, calls setActiveRoom on the room store.
 * - For message targets, also dispatches a CustomEvent 'ezagent:navigate'
 *   so message-level components can scroll to/highlight the message.
 */
export function useDeepLink(): void {
  useEffect(() => {
    const handleDeepLink = (url: string) => {
      const target = parseDeepLink(url);
      if (!target) return;

      // Navigate to the room
      useRoomStore.getState().setActiveRoom(target.roomId);

      // For message-level navigation, dispatch a custom event
      if (target.type === 'message') {
        window.dispatchEvent(
          new CustomEvent('ezagent:navigate', {
            detail: target,
          })
        );
      }
    };

    electronApp.onDeepLink(handleDeepLink);
  }, []);
}
