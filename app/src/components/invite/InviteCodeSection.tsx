'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { generateInviteCode, listInviteCodes, revokeInviteCode } from '@/lib/api/invite';
import type { InviteCode } from '@/types';

interface InviteCodeSectionProps {
  roomId: string;
}

export function InviteCodeSection({ roomId }: InviteCodeSectionProps) {
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    listInviteCodes(roomId).then(setCodes).catch(() => {});
  }, [roomId]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const code = await generateInviteCode(roomId);
      setCodes((prev) => [...prev, code]);
    } catch { /* ignore */ }
    finally { setGenerating(false); }
  }, [roomId]);

  const handleRevoke = useCallback(async (code: string) => {
    await revokeInviteCode(roomId, code);
    setCodes((prev) => prev.filter((c) => c.code !== code));
  }, [roomId]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Invite Codes</h4>
        <Button size="sm" onClick={handleGenerate} disabled={generating}>
          {generating ? 'Generating...' : 'Generate Code'}
        </Button>
      </div>
      {codes.map((c) => (
        <div key={c.code} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
          <span className="font-mono font-bold">{c.code}</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => handleCopy(c.code)}>Copy</Button>
            <Button variant="ghost" size="sm" onClick={() => handleCopy(c.invite_uri)}>Copy Link</Button>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleRevoke(c.code)}>Revoke</Button>
          </div>
        </div>
      ))}
    </div>
  );
}
