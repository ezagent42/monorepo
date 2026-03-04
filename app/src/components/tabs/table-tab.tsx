'use client';

import { useState, useMemo } from 'react';
import type { Message } from '@/types';
import { Input } from '@/components/ui/input';

interface TableTabProps {
  messages: Message[];
  columns?: string[];  // Schema field keys to display as columns
}

type SortDir = 'asc' | 'desc';

/**
 * Table tab — sortable/filterable data table from message schema fields.
 */
export function TableTab({ messages, columns: columnsProp }: TableTabProps) {
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filter, setFilter] = useState('');

  // Derive columns from first message schema if not provided
  const columns = useMemo(() => {
    if (columnsProp && columnsProp.length > 0) return columnsProp;
    const first = messages.find((m) => m.schema);
    return first?.schema ? Object.keys(first.schema) : [];
  }, [messages, columnsProp]);

  // Filter messages
  const filtered = useMemo(() => {
    if (!filter) return messages;
    const lower = filter.toLowerCase();
    return messages.filter((msg) => {
      if (msg.body.toLowerCase().includes(lower)) return true;
      if (msg.schema) {
        return Object.values(msg.schema).some((f) =>
          String(f.value).toLowerCase().includes(lower),
        );
      }
      return false;
    });
  }, [messages, filter]);

  // Sort messages
  const sorted = useMemo(() => {
    if (!sortField) return filtered;
    return [...filtered].sort((a, b) => {
      const aVal = a.schema?.[sortField]?.value;
      const bVal = b.schema?.[sortField]?.value;
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  return (
    <div className="p-4 space-y-3" data-testid="table-tab">
      <Input
        placeholder="Filter..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="max-w-xs"
        data-testid="table-filter"
      />
      <div className="overflow-x-auto border rounded-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-2 font-medium">Author</th>
              {columns.map((col) => (
                <th
                  key={col}
                  className="text-left p-2 font-medium cursor-pointer hover:bg-muted select-none"
                  onClick={() => handleSort(col)}
                  data-testid={`table-header-${col}`}
                >
                  {col}
                  {sortField === col && (
                    <span className="ml-1">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((msg) => (
              <tr key={msg.ref_id} className="border-b hover:bg-muted/30" data-testid={`table-row-${msg.ref_id}`}>
                <td className="p-2 text-muted-foreground">{msg.author}</td>
                {columns.map((col) => (
                  <td key={col} className="p-2">
                    {msg.schema?.[col]?.value != null ? String(msg.schema[col].value) : '\u2014'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
