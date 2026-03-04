'use client';

import type { Message } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface DocumentLinkProps {
  message: Message;
}

/**
 * Renders a document as a card with title, summary, and an "Open" button.
 */
export function DocumentLink({ message }: DocumentLinkProps) {
  const schema = message.schema;
  const title = (schema?.title?.value as string) ?? message.body;
  const summary = schema?.summary?.value as string | undefined;
  const docId = schema?.doc_id?.value as string ?? message.ref_id;

  return (
    <Card className="max-w-md">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <span className="text-lg mt-0.5">{'\u{1F4C4}'}</span>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{title}</div>
            {summary && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{summary}</p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          data-doc-id={docId}
        >
          Open
        </Button>
      </CardContent>
    </Card>
  );
}
