'use client';

import type { Message } from '@/types';

interface QuotePreviewProps {
  message: Message;
}

/**
 * Renders a quoted reply preview above a message.
 * The replied-to message ref is in ext.reply_to
 */
export function QuotePreview({ message }: QuotePreviewProps) {
  const replyTo = message.ext?.reply_to as { author?: string; body?: string; ref_id?: string } | undefined;
  if (!replyTo) return null;

  const author = replyTo.author ?? 'Unknown';
  const body = replyTo.body ?? '';
  const preview = body.length > 80 ? body.slice(0, 80) + '\u2026' : body;

  return (
    <div
      className="flex items-center gap-2 pl-3 border-l-2 border-muted-foreground/30 text-xs text-muted-foreground mb-1 cursor-pointer hover:bg-muted/50 rounded-r py-0.5"
      data-testid="quote-preview"
      data-ref-id={replyTo.ref_id}
    >
      <span className="font-medium">{author}:</span>
      <span className="truncate">{preview}</span>
    </div>
  );
}
