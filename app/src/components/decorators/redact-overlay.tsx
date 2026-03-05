'use client';

import type { Message } from '@/types';

interface RedactOverlayProps {
  message: Message;
}

/**
 * Renders an overlay hiding message content when moderated/redacted.
 */
export function RedactOverlay({ message }: RedactOverlayProps) {
  const moderation = message.ext?.moderation as { redacted?: boolean } | undefined;
  if (!moderation?.redacted) return null;

  return (
    <div
      className="absolute inset-0 bg-muted/90 flex items-center justify-center rounded-md z-10"
      data-testid="redact-overlay"
    >
      <span className="text-sm text-muted-foreground">Message has been hidden</span>
    </div>
  );
}
