'use client';

import type { Message } from '@/types';

interface MediaGalleryProps {
  messages: Message[];
}

export function MediaGallery({ messages }: MediaGalleryProps) {
  const media = messages.filter((m) => {
    const mime = m.schema?.mime_type?.value as string | undefined;
    return mime?.startsWith('image/') || mime?.startsWith('video/');
  });

  if (media.length === 0) {
    return (
      <div className="text-xs text-muted-foreground px-2 py-1">No media shared</div>
    );
  }

  return (
    <div data-testid="media-gallery">
      <div className="text-xs font-medium text-muted-foreground px-2 py-1">
        Media ({media.length})
      </div>
      <div className="grid grid-cols-3 gap-1 px-2">
        {media.map((msg) => {
          const url = msg.schema?.url?.value as string ?? '';
          const filename = msg.schema?.filename?.value as string ?? 'Media';
          return (
            <div key={msg.ref_id} className="aspect-square rounded-sm overflow-hidden bg-muted">
              <img src={url} alt={filename} className="w-full h-full object-cover" loading="lazy" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
