'use client';

import type { Message } from '@/types';
import type { FieldMapping, MetadataField, BadgeConfig } from '@/types/renderer';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StructuredCardProps {
  message: Message;
  fieldMapping: FieldMapping;
}

/**
 * Renders a message as a structured card with header, metadata rows, and optional badge.
 * Used by Level 1 renderer when type is 'structured_card'.
 */
export function StructuredCard({ message, fieldMapping }: StructuredCardProps) {
  const data = message.schema
    ? Object.fromEntries(Object.entries(message.schema).map(([k, v]) => [k, v.value]))
    : {};

  const headerValue = fieldMapping.header ? String(data[fieldMapping.header] ?? message.body) : message.body;

  return (
    <Card className="max-w-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{headerValue}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {fieldMapping.metadata?.map((meta, i) => (
          <MetadataRow key={i} meta={meta} data={data} />
        ))}
        {fieldMapping.badge && (
          <StatusBadge badge={fieldMapping.badge} data={data} />
        )}
      </CardContent>
    </Card>
  );
}

function MetadataRow({ meta, data }: { meta: MetadataField; data: Record<string, unknown> }) {
  const value = data[meta.field];
  if (value === undefined || value === null) return null;

  const formatted = meta.format
    ? formatMetadataValue(meta.format, meta.field, data)
    : String(value);

  const iconMap: Record<string, string> = {
    coin: '\u{1F4B0}',
    clock: '\u{1F550}',
    user: '\u{1F464}',
    tag: '\u{1F3F7}\uFE0F',
    link: '\u{1F517}',
    star: '\u2B50',
    check: '\u2705',
    warning: '\u26A0\uFE0F',
  };
  const icon = meta.icon ? iconMap[meta.icon] ?? meta.icon : '';

  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      {icon && <span>{icon}</span>}
      <span>{formatted}</span>
    </div>
  );
}

function StatusBadge({ badge, data }: { badge: BadgeConfig; data: Record<string, unknown> }) {
  const value = data[badge.field];
  if (value === undefined || value === null) return null;

  const label = String(value).charAt(0).toUpperCase() + String(value).slice(1);

  return (
    <div className="pt-1">
      <Badge variant="secondary">{label}</Badge>
    </div>
  );
}

/**
 * Format a metadata value using a format template.
 * Supports:
 * - "{value} {currency}" -- interpolates fields from data
 * - "relative_time" -- formats as relative time string
 */
function formatMetadataValue(format: string, field: string, data: Record<string, unknown>): string {
  if (format === 'relative_time') {
    const dateStr = String(data[field]);
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = date.getTime() - now.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays > 0) return `in ${diffDays} days`;
      if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
      return 'today';
    } catch {
      return dateStr;
    }
  }

  // Template interpolation: replace {fieldName} with data[fieldName]
  // Special case: {value} refers to the current field's value (data[field])
  return format.replace(/\{(\w+)\}/g, (_, key) => {
    const val = key === 'value' ? data[field] : data[key];
    return val !== undefined && val !== null ? String(val) : '';
  });
}
