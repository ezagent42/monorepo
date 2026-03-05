'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { sendMessage } from '@/lib/api/messages';
import { useMessageStore } from '@/stores/message-store';
import { EmojiPicker } from './EmojiPicker';
import { ReplyPreview } from './ReplyPreview';
import type { Message } from '@/types';

interface ComposeAreaProps {
  roomId: string;
  replyTo?: Message | null;
  onCancelReply?: () => void;
}

export function ComposeArea({ roomId, replyTo, onCancelReply }: ComposeAreaProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const addMessage = useMessageStore((s) => s.addMessage);

  const handleSend = useCallback(async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const msgBody: { body: string; ext?: Record<string, unknown> } = { body };
      if (replyTo) {
        msgBody.ext = { reply_to: { ref_id: replyTo.ref_id } };
      }
      const result = await sendMessage(roomId, msgBody);
      // Optimistic: add message locally
      addMessage(roomId, result as any);
      setText('');
      onCancelReply?.();
    } catch {
      // TODO: show error toast
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }, [text, sending, roomId, addMessage, replyTo, onCancelReply]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setText((prev) => prev + emoji);
    textareaRef.current?.focus();
  };

  return (
    <div className="border-t p-3">
      {replyTo && <ReplyPreview message={replyTo} onClose={() => onCancelReply?.()} />}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm min-h-[40px] max-h-[120px] focus:outline-none focus:ring-2 focus:ring-ring"
          rows={1}
          disabled={sending}
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" type="button" aria-label="Open emoji picker">
              {'\u{1F60A}'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <EmojiPicker onSelect={handleEmojiSelect} />
          </PopoverContent>
        </Popover>
        <Button onClick={handleSend} disabled={sending || !text.trim()} size="sm">
          Send
        </Button>
      </div>
    </div>
  );
}
