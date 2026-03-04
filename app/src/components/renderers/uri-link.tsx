'use client';

import React, { useCallback } from 'react';
import { parseDeepLink } from '@/lib/electron/deep-link';
import type { DeepLinkTarget } from '@/lib/electron/deep-link';

// --- URI Builder ---

/**
 * Build an ezagent:// URI for a room or message.
 *
 * @param roomId - The room ID
 * @param messageId - Optional message ID for message-level links
 * @returns The formatted ezagent:// URI string
 */
export function buildEzagentUri(roomId: string, messageId?: string): string {
  if (messageId) {
    return `ezagent://room/${encodeURIComponent(roomId)}/message/${encodeURIComponent(messageId)}`;
  }
  return `ezagent://room/${encodeURIComponent(roomId)}`;
}

// --- URI Detection Regex ---

const EZAGENT_URI_REGEX = /ezagent:\/\/room\/[^\s]+/g;

// --- UriLink Component ---

export interface UriLinkProps {
  /** The text content that may contain ezagent:// URIs */
  text: string;
}

/**
 * Renders text with embedded ezagent:// URIs as clickable links.
 *
 * Non-URI text is rendered as plain text spans.
 * Matched URIs are rendered as clickable links that dispatch
 * 'ezagent:navigate' CustomEvents with the parsed target.
 */
export function UriLink({ text }: UriLinkProps) {
  const handleClick = useCallback((e: React.MouseEvent, uri: string) => {
    e.preventDefault();
    const target = parseDeepLink(uri);
    if (target) {
      window.dispatchEvent(
        new CustomEvent('ezagent:navigate', { detail: target })
      );
    }
  }, []);

  // Split text into URI and non-URI segments
  const segments = splitWithUris(text);

  if (segments.length === 0) {
    return <span>{text}</span>;
  }

  return (
    <span>
      {segments.map((segment, i) => {
        if (segment.isUri) {
          const target = parseDeepLink(segment.text);
          const icon = getTargetIcon(target);
          return (
            <a
              key={i}
              href={segment.text}
              onClick={(e) => handleClick(e, segment.text)}
              className="text-blue-500 hover:underline cursor-pointer inline-flex items-center gap-0.5"
              data-testid="uri-link"
            >
              <span aria-hidden="true">{icon}</span>
              {segment.text}
            </a>
          );
        }
        return <span key={i}>{segment.text}</span>;
      })}
    </span>
  );
}

// --- Helpers ---

interface TextSegment {
  text: string;
  isUri: boolean;
}

function splitWithUris(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let lastIndex = 0;

  // Reset regex state
  EZAGENT_URI_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = EZAGENT_URI_REGEX.exec(text)) !== null) {
    // Add any text before this match
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), isUri: false });
    }
    // Add the URI match
    segments.push({ text: match[0], isUri: true });
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last match
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), isUri: false });
  }

  return segments;
}

function getTargetIcon(target: DeepLinkTarget | null): string {
  if (!target) return '\uD83D\uDD17'; // link icon fallback
  return target.type === 'message' ? '\uD83D\uDCAC' : '\uD83D\uDD17';
}
