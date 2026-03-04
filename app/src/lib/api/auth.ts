/**
 * Auth API — wraps authentication endpoints.
 *
 * Endpoints:
 *   POST /api/auth/github  — exchange GitHub token for entity + keypair
 *   GET  /api/auth/session  — current session info
 *   POST /api/auth/logout   — clear session
 */

import { api } from './client';
import type { AuthSession } from '@/types';

export interface GitHubAuthResponse {
  entity_id: string;
  display_name: string;
  avatar_url?: string;
  keypair: string;
  is_new_user: boolean;
}

/**
 * Exchange a GitHub OAuth token for an ezagent entity and keypair.
 */
export function exchangeGitHubToken(github_token: string): Promise<GitHubAuthResponse> {
  return api.post<GitHubAuthResponse>('/api/auth/github', { github_token });
}

/**
 * Get the current authentication session.
 */
export function getSession(): Promise<AuthSession> {
  return api.get<AuthSession>('/api/auth/session');
}

/**
 * Log out and clear the current session.
 */
export function logout(): Promise<void> {
  return api.post<void>('/api/auth/logout');
}
