'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api/client';

interface CommandPaletteProps {
  query: string;
  roomId: string | null;
  onClose: () => void;
}

interface Command {
  name: string;
  description?: string;
}

export function CommandPalette({ query, roomId, onClose }: CommandPaletteProps) {
  const [commands, setCommands] = useState<Command[]>([]);

  useEffect(() => {
    const path = roomId ? `/api/rooms/${roomId}/commands` : '/api/commands';
    api.get<Command[]>(path).then(setCommands).catch(() => setCommands([]));
  }, [roomId]);

  const filtered = query
    ? commands.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    : commands;

  return (
    <div className="flex flex-col">
      <h4 className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Commands</h4>
      {filtered.length === 0 && (
        <div className="px-4 py-2 text-sm text-muted-foreground">No commands available.</div>
      )}
      {filtered.map((cmd) => (
        <button
          key={cmd.name}
          type="button"
          className="w-full px-4 py-2 text-left text-sm hover:bg-muted"
          onClick={() => {
            // Insert command text into compose area would need a shared ref/callback
            // For now, just close the modal
            onClose();
          }}
        >
          <span className="font-mono font-medium">/{cmd.name}</span>
          {cmd.description && <span className="ml-2 text-muted-foreground">{cmd.description}</span>}
        </button>
      ))}
    </div>
  );
}
