'use client';

import type { Message } from '@/types';

interface SchemaRendererProps {
  message: Message;
}

/**
 * Level 0 schema-derived auto-renderer.
 * Renders schema fields as key:value pairs.
 */
export function SchemaRenderer({ message }: SchemaRendererProps) {
  const schema = message.schema;
  if (!schema || Object.keys(schema).length === 0) {
    return <p className="text-sm whitespace-pre-wrap">{message.body}</p>;
  }

  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{message.datatype}</div>
      {Object.entries(schema).map(([key, field]) => (
        <div key={key} className="flex gap-2 text-sm">
          <span className="text-muted-foreground min-w-[80px]">{key}:</span>
          <span>{formatSchemaValue(field.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function formatSchemaValue(value: unknown): string {
  if (value === null || value === undefined) return '\u2014';
  if (typeof value === 'boolean') return value ? '\u2705' : '\u274C';
  if (Array.isArray(value)) return JSON.stringify(value);
  return String(value);
}
