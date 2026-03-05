'use client';

import type { Message } from '@/types';

interface MediaMessageProps {
  message: Message;
}

/**
 * Renders media content (images, video) as an inline preview with filename and size.
 */
export function MediaMessage({ message }: MediaMessageProps) {
  const schema = message.schema;
  const filename = schema?.filename?.value as string ?? 'Attachment';
  const mimeType = schema?.mime_type?.value as string ?? '';
  const size = schema?.size?.value as number | undefined;
  const url = schema?.url?.value as string ?? schema?.blob_hash?.value as string ?? '';

  const isImage = mimeType.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(filename);
  const isVideo = mimeType.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(filename);

  return (
    <div className="space-y-1.5 max-w-sm">
      {isImage && url && (
        <div className="rounded-md overflow-hidden border">
          <img
            src={url}
            alt={filename}
            className="max-w-full h-auto max-h-64 object-contain"
            loading="lazy"
          />
        </div>
      )}
      {isVideo && url && (
        <div className="rounded-md overflow-hidden border">
          <video src={url} controls className="max-w-full max-h-64" />
        </div>
      )}
      {!isImage && !isVideo && (
        <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/50">
          <span className="text-lg">{'\u{1F4CE}'}</span>
          <span className="text-sm font-medium truncate">{filename}</span>
        </div>
      )}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{filename}</span>
        {size != null && <span>{'\u00B7'} {formatFileSize(size)}</span>}
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
