'use client';

import { useMemo } from 'react';
import type { Message } from '@/types';

interface GalleryTabProps {
  messages: Message[];
}

/**
 * Gallery tab — grid layout displaying media thumbnails.
 * Filters messages that have media content (images/video).
 */
export function GalleryTab({ messages }: GalleryTabProps) {
  const mediaMessages = useMemo(
    () => messages.filter((m) => {
      const mime = m.schema?.mime_type?.value as string | undefined;
      return mime?.startsWith('image/') || mime?.startsWith('video/');
    }),
    [messages],
  );

  if (mediaMessages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No media yet
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 p-4" data-testid="gallery-grid">
      {mediaMessages.map((msg) => {
        const url = msg.schema?.url?.value as string ?? msg.schema?.blob_hash?.value as string ?? '';
        const filename = msg.schema?.filename?.value as string ?? 'Media';
        const mime = msg.schema?.mime_type?.value as string ?? '';

        return (
          <div
            key={msg.ref_id}
            className="aspect-square rounded-md overflow-hidden border bg-muted/50 cursor-pointer hover:opacity-80 transition-opacity"
            data-testid={`gallery-item-${msg.ref_id}`}
          >
            {mime.startsWith('video/') ? (
              <video src={url} className="w-full h-full object-cover" />
            ) : (
              <img src={url} alt={filename} className="w-full h-full object-cover" loading="lazy" />
            )}
          </div>
        );
      })}
    </div>
  );
}
