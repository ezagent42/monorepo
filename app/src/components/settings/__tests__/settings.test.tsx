import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsDialog } from '../SettingsDialog';
import { useAuthStore } from '@/stores/auth-store';
import { useUiStore } from '@/stores/ui-store';

vi.mock('@/lib/api/auth', () => ({
  logout: vi.fn().mockResolvedValue(undefined),
}));

describe('SettingsDialog (TC-5-OPS-053)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      ...useAuthStore.getInitialState(),
      isAuthenticated: true,
      session: { entity_id: '@alice', display_name: 'Alice', authenticated: true, github_id: 12345 },
    });
    useUiStore.setState(useUiStore.getInitialState());
  });

  it('renders Account, Appearance, About tabs', () => {
    render(<SettingsDialog open={true} onOpenChange={() => {}} />);
    expect(screen.getByText('Account')).toBeInTheDocument();
    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
  });

  it('shows entity ID and GitHub on Account tab', () => {
    render(<SettingsDialog open={true} onOpenChange={() => {}} />);
    expect(screen.getByText('@alice')).toBeInTheDocument();
    expect(screen.getByText('12345')).toBeInTheDocument();
  });

  it('theme switch applies dark mode (TC-5-OPS-055)', async () => {
    const user = userEvent.setup();
    render(<SettingsDialog open={true} onOpenChange={() => {}} />);
    await user.click(screen.getByRole('tab', { name: 'Appearance' }));
    await waitFor(() => {
      expect(screen.getByText('Dark')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Dark'));
    expect(useUiStore.getState().theme).toBe('dark');
  });

  it('Sign Out clears auth store (TC-5-OPS-056)', async () => {
    render(<SettingsDialog open={true} onOpenChange={() => {}} />);
    fireEvent.click(screen.getByText('Sign Out'));
    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });
});
