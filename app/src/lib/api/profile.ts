/**
 * Profile API — wraps identity profile endpoints.
 *
 * Endpoints:
 *   GET /api/identity/{id}/profile — get user profile
 *   PUT /api/identity/{id}/profile — update user profile
 */

import { api } from './client';
import type { UserProfile, UpdateProfileParams } from '@/types';

/**
 * Get a user's profile by entity ID.
 */
export function getProfile(entityId: string): Promise<UserProfile> {
  return api.get<UserProfile>(`/api/identity/${entityId}/profile`);
}

/**
 * Update a user's profile.
 */
export function updateProfile(entityId: string, body: UpdateProfileParams): Promise<UserProfile> {
  return api.put<UserProfile>(`/api/identity/${entityId}/profile`, body);
}
