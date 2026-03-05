'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

const HINTS_DISMISSED_KEY = 'ezagent-onboarding-dismissed';

const hints = [
  'Create a room to start collaborating with your team.',
  'Install Socialware apps to extend room functionality.',
  'Use \u2318K to quickly search rooms, people, and messages.',
];

export function OnboardingHints() {
  const [dismissed, setDismissed] = useState(true); // default true to avoid flash

  useEffect(() => {
    try {
      const stored = localStorage.getItem(HINTS_DISMISSED_KEY);
      setDismissed(stored === 'true');
    } catch {
      setDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(HINTS_DISMISSED_KEY, 'true'); } catch {}
  };

  if (dismissed) return null;

  return (
    <div data-testid="onboarding-hints" className="mx-4 mb-4 rounded-md border bg-muted/50 p-4">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-medium">Getting Started</h4>
          <ul className="list-disc pl-4 text-sm text-muted-foreground space-y-1">
            {hints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        </div>
        <Button variant="ghost" size="sm" onClick={handleDismiss} aria-label="Dismiss hints">
          {'\u2715'}
        </Button>
      </div>
    </div>
  );
}
