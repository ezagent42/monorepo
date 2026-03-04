'use client';

import type { DecoratorConfig } from '@/types/renderer';
import type { Message } from '@/types';
import { EmojiBar } from './emoji-bar';
import { QuotePreview } from './quote-preview';
import { TextTag } from './text-tag';
import { ThreadIndicator } from './thread-indicator';
import { TagList } from './tag-list';
import { RedactOverlay } from './redact-overlay';

interface DecoratorLayerProps {
  message: Message;
  decorators: DecoratorConfig[];
  position: 'above' | 'below' | 'inline' | 'overlay';
  children?: React.ReactNode;
}

/**
 * Renders decorators filtered by position and sorted by priority (ascending).
 */
export function DecoratorLayer({ message, decorators, position, children }: DecoratorLayerProps) {
  const filtered = decorators
    .filter((d) => d.position === position)
    .sort((a, b) => a.priority - b.priority);

  if (filtered.length === 0 && !children) return null;

  return (
    <>
      {filtered.map((dec, i) => (
        <DecoratorSwitch key={`${dec.type}-${i}`} decorator={dec} message={message} />
      ))}
      {children}
    </>
  );
}

function DecoratorSwitch({ decorator, message }: { decorator: DecoratorConfig; message: Message }) {
  switch (decorator.type) {
    case 'emoji_bar':
      return <EmojiBar message={message} />;
    case 'quote_preview':
      return <QuotePreview message={message} />;
    case 'text_tag':
      return <TextTag message={message} />;
    case 'thread_indicator':
      return <ThreadIndicator message={message} />;
    case 'tag_list':
      return <TagList message={message} />;
    case 'redact_overlay':
      return <RedactOverlay message={message} />;
    default:
      return null;
  }
}
