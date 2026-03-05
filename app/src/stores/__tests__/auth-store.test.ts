import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../auth-store';

describe('AuthStore', () => {
  beforeEach(() => useAuthStore.setState(useAuthStore.getInitialState()));

  it('starts unauthenticated', () => {
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('starts with null session', () => {
    expect(useAuthStore.getState().session).toBeNull();
  });

  it('starts with isLoading false', () => {
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('login sets session data', () => {
    useAuthStore.getState().login({
      entity_id: '@alice:relay.ezagent.dev',
      display_name: 'Alice',
      avatar_url: 'https://avatars.githubusercontent.com/u/123',
      authenticated: true,
    });
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.session?.entity_id).toBe('@alice:relay.ezagent.dev');
    expect(state.session?.display_name).toBe('Alice');
    expect(state.session?.avatar_url).toBe('https://avatars.githubusercontent.com/u/123');
  });

  it('logout clears session', () => {
    useAuthStore.getState().login({
      entity_id: '@alice',
      display_name: 'Alice',
      authenticated: true,
    });
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().session).toBeNull();
  });

  it('setLoading updates loading state', () => {
    useAuthStore.getState().setLoading(true);
    expect(useAuthStore.getState().isLoading).toBe(true);
    useAuthStore.getState().setLoading(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});
