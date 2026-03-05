/**
 * Socialware API — wraps socialware extension endpoints.
 *
 * Endpoints:
 *   GET    /api/socialware              — list installed socialware apps
 *   GET    /api/socialware/{id}         — get socialware detail
 *   POST   /api/socialware/install      — install socialware into a room
 *   DELETE /api/socialware/{id}         — uninstall socialware
 *   POST   /api/socialware/{id}/start   — start socialware
 *   POST   /api/socialware/{id}/stop    — stop socialware
 */

import { api } from './client';
import type { SocialwareApp } from '@/types';

/**
 * List all installed socialware apps.
 */
export function listSocialware(): Promise<SocialwareApp[]> {
  return api.get<SocialwareApp[]>('/api/socialware');
}

/**
 * Get detail for a single socialware app.
 */
export function getSocialwareDetail(swId: string): Promise<SocialwareApp> {
  return api.get<SocialwareApp>(`/api/socialware/${swId}`);
}

/**
 * Install a socialware app into a room.
 */
export function installSocialware(swId: string, roomId: string): Promise<void> {
  return api.post<void>('/api/socialware/install', { sw_id: swId, room_id: roomId });
}

/**
 * Uninstall a socialware app.
 */
export function uninstallSocialware(swId: string): Promise<void> {
  return api.delete<void>(`/api/socialware/${swId}`);
}

/**
 * Start a socialware app.
 */
export function startSocialware(swId: string): Promise<void> {
  return api.post<void>(`/api/socialware/${swId}/start`);
}

/**
 * Stop a socialware app.
 */
export function stopSocialware(swId: string): Promise<void> {
  return api.post<void>(`/api/socialware/${swId}/stop`);
}
