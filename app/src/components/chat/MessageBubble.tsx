'use client';

import { useCallback } from 'react';
import type { Message } from '@/types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from '@/components/ui/context-menu';
import { buildEzagentUri } from '@/components/renderers/uri-link';
import { Copy } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const initials = message.author.charAt(1).toUpperCase(); // Skip '@' prefix
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const handleCopyUri = useCallback(async () => {
    const uri = buildEzagentUri(message.room_id, message.ref_id);
    try {
      await navigator.clipboard.writeText(uri);
    } catch {
      // Fallback: dispatch event so host can handle
      console.warn('Clipboard API unavailable');
    }
  }, [message.room_id, message.ref_id]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="flex gap-3 px-4 py-2 hover:bg-muted/50">
          <Avatar className="h-8 w-8 mt-0.5">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-sm">{message.author}</span>
              <span className="text-xs text-muted-foreground">{time}</span>
            </div>
            <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={handleCopyUri}>
          <Copy className="mr-2 h-4 w-4" />
          Copy ezagent URI
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
