'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { sendMessage } from '@/lib/api/messages';
import { useMessageStore } from '@/stores/message-store';
import { EmojiPicker } from './EmojiPicker';

interface ComposeAreaProps {
  roomId: string;
}

export function ComposeArea({ roomId }: ComposeAreaProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const addMessage = useMessageStore((s) => s.addMessage);

  const handleSend = useCallback(async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const result = await sendMessage(roomId, { body });
      // Optimistic: add message locally
      addMessage(roomId, result as any);
      setText('');
    } catch {
      // TODO: show error toast
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }, [text, sending, roomId, addMessage]);

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
