'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { SearchModal } from '@/components/search/SearchModal';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  const [modalOpen, setModalOpen] = useState(false);

  // Register Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setModalOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="px-3 py-2">
      <Input
        placeholder="Search... (⌘K)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setModalOpen(true)}
        className="h-8 text-sm cursor-pointer"
        readOnly
      />
      <SearchModal open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
}
