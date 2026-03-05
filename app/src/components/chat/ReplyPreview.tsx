'use client';

import { Button } from '@/components/ui/button';
import type { Message } from '@/types';

interface ReplyPreviewProps {
  message: Message;
  onClose: () => void;
}

export function ReplyPreview({ message, onClose }: ReplyPreviewProps) {
  return (
    <div className="flex items-center gap-2 border-l-2 border-primary bg-muted/50 px-3 py-1 text-sm">
      <span className="font-semibold">{message.author}</span>
      <span className="flex-1 truncate text-muted-foreground">{message.body}</span>
      <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cancel reply">
        {'\u2715'}
      </Button>
    </div>
  );
}
