import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProfilePopover } from '../ProfilePopover';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/lib/api/auth', () => ({
  logout: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/api/profile', () => ({
  updateProfile: vi.fn().mockResolvedValue({ entity_id: '@alice', display_name: 'Alice Updated' }),
  getProfile: vi.fn().mockResolvedValue({ entity_id: '@alice', display_name: 'Alice', bio: 'hello' }),
}));

describe('ProfilePopover (TC-5-OPS-050)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      ...useAuthStore.getInitialState(),
      isAuthenticated: true,
      session: { entity_id: '@alice', display_name: 'Alice', authenticated: true },
    });
  });

  it('shows user name and entity ID', () => {
    render(<ProfilePopover />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('@alice')).toBeInTheDocument();
  });

  it('opens popover with Edit Profile, Settings, Sign Out buttons', async () => {
    render(<ProfilePopover />);
    fireEvent.click(screen.getByLabelText('Profile menu'));
    await waitFor(() => {
      expect(screen.getByText('Edit Profile')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Sign Out')).toBeInTheDocument();
    });
  });
});
