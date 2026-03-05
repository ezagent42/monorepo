'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface EditMessageFormProps {
  initialBody: string;
  onSave: (newBody: string) => void;
  onCancel: () => void;
}

export function EditMessageForm({ initialBody, onSave, onCancel }: EditMessageFormProps) {
  const [body, setBody] = useState(initialBody);

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm min-h-[60px] focus:outline-none focus:ring-2 focus:ring-ring"
        rows={2}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onSave(body.trim())} disabled={!body.trim()}>Save</Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
