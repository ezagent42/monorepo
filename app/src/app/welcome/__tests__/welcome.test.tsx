import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WelcomePage from '../page';
import { useAuthStore } from '@/stores/auth-store';

// Mock the electron IPC module
vi.mock('@/lib/electron/ipc', () => ({
  electronAuth: {
    startGitHubOAuth: vi.fn(),
    getStoredCredentials: vi.fn(),
    clearCredentials: vi.fn(),
  },
}));

describe('WelcomePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState(useAuthStore.getInitialState());
  });

  it('renders sign in button', () => {
    render(<WelcomePage />);
    expect(screen.getByText('Sign in with GitHub')).toBeInTheDocument();
  });

  it('renders welcome title', () => {
    render(<WelcomePage />);
    expect(screen.getByText('Welcome to ezagent')).toBeInTheDocument();
  });

  it('shows loading state during auth', async () => {
    const { electronAuth } = await import('@/lib/electron/ipc');
    (electronAuth.startGitHubOAuth as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {}) // Never resolves - simulates loading
    );

    render(<WelcomePage />);
    fireEvent.click(screen.getByText('Sign in with GitHub'));
    await waitFor(() => {
      expect(screen.getByText('Waiting for GitHub authorization...')).toBeInTheDocument();
      expect(
        screen.getByText('A browser window has opened. Please authorize there and return here.')
      ).toBeInTheDocument();
    });
  });

  it('shows error on auth failure', async () => {
    const { electronAuth } = await import('@/lib/electron/ipc');
    (electronAuth.startGitHubOAuth as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Auth window closed')
    );

    render(<WelcomePage />);
    fireEvent.click(screen.getByText('Sign in with GitHub'));
    await waitFor(() => {
      expect(screen.getByText('Auth window closed')).toBeInTheDocument();
    });
  });

  it('calls login on successful auth', async () => {
    const { electronAuth } = await import('@/lib/electron/ipc');
    (electronAuth.startGitHubOAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      entity_id: '@alice:relay.ezagent.dev',
      display_name: 'Alice',
      avatar_url: 'https://example.com/alice.png',
      is_new_user: true,
    });

    render(<WelcomePage />);
    fireEvent.click(screen.getByText('Sign in with GitHub'));
    await waitFor(() => {
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.session?.entity_id).toBe('@alice:relay.ezagent.dev');
    });
  });
});
