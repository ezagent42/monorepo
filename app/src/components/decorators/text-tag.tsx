'use client';

import type { Message } from '@/types';

interface TextTagProps {
  message: Message;
}

/**
 * Renders "(edited)" tag inline with the timestamp when a message has been edited.
 */
export function TextTag({ message }: TextTagProps) {
  const mutable = message.ext?.mutable as { version?: number } | undefined;
  if (!mutable || (mutable.version ?? 0) <= 1) return null;

  return (
    <span className="text-xs text-muted-foreground ml-1" data-testid="text-tag">
      (edited)
    </span>
  );
}
