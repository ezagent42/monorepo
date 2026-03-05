import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RoomEmptyState } from '../RoomEmptyState';
import { OnboardingHints } from '../OnboardingHints';

vi.mock('@/lib/api/rooms', () => ({
  updateRoom: vi.fn(),
  leaveRoom: vi.fn(),
  getRoomMembers: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/api/socialware', () => ({
  listSocialware: vi.fn().mockResolvedValue([]),
  installSocialware: vi.fn(),
  startSocialware: vi.fn(),
  stopSocialware: vi.fn(),
  uninstallSocialware: vi.fn(),
}));

vi.mock('@/lib/api/invite', () => ({
  generateInviteCode: vi.fn(),
  listInviteCodes: vi.fn().mockResolvedValue([]),
  revokeInviteCode: vi.fn(),
}));

describe('RoomEmptyState (TC-5-OPS-002)', () => {
  it('shows admin shortcuts in empty room', () => {
    render(<RoomEmptyState roomId="r1" />);
    expect(screen.getByTestId('room-empty-state')).toBeInTheDocument();
    expect(screen.getByText('Invite Members')).toBeInTheDocument();
    expect(screen.getByText('Install Apps')).toBeInTheDocument();
  });
});

describe('OnboardingHints (TC-5-OPS-003)', () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
      removeItem: vi.fn((key: string) => { delete store[key]; }),
      clear: vi.fn(() => { store = {}; }),
      get length() { return Object.keys(store).length; },
      key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows onboarding hints on first visit', async () => {
    render(<OnboardingHints />);
    await waitFor(() => {
      expect(screen.getByTestId('onboarding-hints')).toBeInTheDocument();
    });
    expect(screen.getByText('Getting Started')).toBeInTheDocument();
  });

  it('dismisses hints and persists', async () => {
    render(<OnboardingHints />);

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-hints')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Dismiss hints'));

    await waitFor(() => {
      expect(screen.queryByTestId('onboarding-hints')).not.toBeInTheDocument();
    });
    expect(store['ezagent-onboarding-dismissed']).toBe('true');
  });
});
