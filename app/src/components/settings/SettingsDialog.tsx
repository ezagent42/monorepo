'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { useUiStore } from '@/stores/ui-store';
import { logout as logoutApi } from '@/lib/api/auth';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const session = useAuthStore((s) => s.session);
  const authLogout = useAuthStore((s) => s.logout);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  const handleSignOut = async () => {
    try { await logoutApi(); } catch { /* ignore */ }
    authLogout();
    onOpenChange(false);
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    // Apply theme class to document
    try {
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      if (newTheme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.add(isDark ? 'dark' : 'light');
      } else {
        root.classList.add(newTheme);
      }
      localStorage.setItem('ezagent-theme', newTheme);
    } catch { /* ignore in test environment */ }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Manage your account and preferences.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="account">
          <TabsList className="w-full">
            <TabsTrigger value="account" className="flex-1">Account</TabsTrigger>
            <TabsTrigger value="appearance" className="flex-1">Appearance</TabsTrigger>
            <TabsTrigger value="about" className="flex-1">About</TabsTrigger>
          </TabsList>
          <TabsContent value="account">
            <div className="flex flex-col gap-3 py-4">
              {session && (
                <>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">Entity ID</span>
                    <span className="text-sm text-muted-foreground font-mono">{session.entity_id}</span>
                  </div>
                  {session.github_id && (
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium">GitHub</span>
                      <span className="text-sm text-muted-foreground">{session.github_id}</span>
                    </div>
                  )}
                </>
              )}
              <Button variant="outline" className="text-destructive" onClick={handleSignOut}>Sign Out</Button>
            </div>
          </TabsContent>
          <TabsContent value="appearance">
            <div className="flex flex-col gap-3 py-4">
              <span className="text-sm font-medium">Theme</span>
              <div className="flex gap-2">
                {(['system', 'light', 'dark'] as const).map((t) => (
                  <Button
                    key={t}
                    variant={theme === t ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleThemeChange(t)}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>
          <TabsContent value="about">
            <div className="flex flex-col gap-2 py-4 text-sm text-muted-foreground">
              <p>EZAgent Desktop Client</p>
              <p>Version: 0.1.0</p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
