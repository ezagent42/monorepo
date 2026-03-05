'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { electronAuth } from '@/lib/electron/ipc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function WelcomePage() {
  const [error, setError] = useState<string | null>(null);
  const login = useAuthStore((s) => s.login);
  const setLoading = useAuthStore((s) => s.setLoading);
  const isLoading = useAuthStore((s) => s.isLoading);

  const handleGitHubLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await electronAuth.startGitHubOAuth();
      login({
        entity_id: result.entity_id,
        display_name: result.display_name,
        avatar_url: result.avatar_url,
        authenticated: true,
      });
      // Navigation to /chat will be handled by the root layout's auth check
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-[400px]">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to ezagent</CardTitle>
          <CardDescription>Programmable Organization OS</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button onClick={handleGitHubLogin} disabled={isLoading} className="w-full">
            {isLoading ? 'Waiting for GitHub authorization...' : 'Sign in with GitHub'}
          </Button>
          {isLoading && (
            <p className="text-sm text-muted-foreground text-center">
              A browser window has opened. Please authorize there and return here.
            </p>
          )}
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
