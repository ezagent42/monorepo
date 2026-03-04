'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { electronAuth } from '@/lib/electron/ipc';
import WelcomePage from './welcome/page';

export default function Home() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const login = useAuthStore((s) => s.login);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check for stored credentials on startup
    electronAuth.getStoredCredentials().then((creds) => {
      if (creds) {
        login({
          entity_id: creds.entity_id,
          display_name: creds.display_name,
          avatar_url: creds.avatar_url,
          authenticated: true,
        });
      }
      setChecking(false);
    });
  }, [login]);

  if (checking) return <div className="flex min-h-screen items-center justify-center">Loading...</div>;

  // In Next.js static export, we use client-side routing
  if (isAuthenticated) {
    // Will be replaced with proper routing in Task 11
    return <div>Authenticated! Chat UI coming in Milestone 4.</div>;
  }

  // Render welcome page inline (static export doesn't support next/navigation redirect)
  return <WelcomePage />;
}
