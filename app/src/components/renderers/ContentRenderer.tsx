'use client';

import type { ResolvedRenderer } from '@/lib/pipeline/types';
import type { Message } from '@/types';
import { TextRenderer } from './text-renderer';
import { StructuredCard } from './structured-card';

interface ContentRendererProps {
  resolved: ResolvedRenderer;
}

/**
 * Dispatch component for the render pipeline.
 * Routes to the correct renderer based on the resolved level and type.
 */
export function ContentRenderer({ resolved }: ContentRendererProps) {
  // Level 2: Custom widget component
  if (resolved.level === 2 && resolved.component) {
    const CustomComponent = resolved.component;
    return <CustomComponent message={resolved.message} config={resolved.config} />;
  }

  // Level 1 & Level 0: Route by type
  switch (resolved.type) {
    case 'text':
      return <TextRenderer message={resolved.message} />;
    case 'structured_card':
      return (
        <StructuredCard
          message={resolved.message}
          fieldMapping={resolved.config?.field_mapping ?? {}}
        />
      );
    case 'schema':
      // Level 0 fallback -- render schema fields as key:value pairs
      return <SchemaFallback message={resolved.message} />;
    default:
      // Unknown renderer type -- fallback to plain text
      return <TextRenderer message={resolved.message} />;
  }
}

/** Level 0 schema-derived fallback renderer */
function SchemaFallback({ message }: { message: Message }) {
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

function formatSchemaValue(value: unknown): string {
  if (value === null || value === undefined) return '\u2014';
  if (typeof value === 'boolean') return value ? '\u2705' : '\u274C';
  if (Array.isArray(value)) return JSON.stringify(value);
  return String(value);
}
