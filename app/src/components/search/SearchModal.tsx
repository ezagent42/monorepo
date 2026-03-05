'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SearchResults } from './SearchResults';
import { CommandPalette } from './CommandPalette';
import { useRoomStore } from '@/stores/room-store';

interface SearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchModal({ open, onOpenChange }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'all' | 'room'>('all');
  const activeRoomId = useRoomStore((s) => s.activeRoomId);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setScope('all');
    }
  }, [open]);

  const isCommandMode = query.startsWith('/');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 gap-0" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Search</DialogTitle>
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Input
            ref={inputRef}
            placeholder={isCommandMode ? 'Search commands...' : 'Search rooms, people, messages...'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-0 focus-visible:ring-0 px-0"
          />
          {!isCommandMode && activeRoomId && (
            <div className="flex gap-1 shrink-0">
              <Button
                size="sm"
                variant={scope === 'all' ? 'default' : 'outline'}
                onClick={() => setScope('all')}
                className="h-6 text-xs px-2"
              >
                All
              </Button>
              <Button
                size="sm"
                variant={scope === 'room' ? 'default' : 'outline'}
                onClick={() => setScope('room')}
                className="h-6 text-xs px-2"
              >
                Room
              </Button>
            </div>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {isCommandMode ? (
            <CommandPalette query={query.slice(1)} roomId={activeRoomId} onClose={() => onOpenChange(false)} />
          ) : (
            <SearchResults
              query={query}
              roomId={scope === 'room' ? activeRoomId : undefined}
              onClose={() => onOpenChange(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
