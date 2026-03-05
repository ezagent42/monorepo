/**
 * Renderers API — wraps render pipeline endpoints.
 *
 * Endpoints:
 *   GET /api/rooms/{id}/renderers — renderer declarations for a room
 */

import { api } from './client';
import type { RendererConfig } from '@/types';

/**
 * Get the renderer configuration for a room.
 *
 * Returns the aggregated renderer declarations from all enabled
 * extensions and socialware installed in the room.
 */
export function getRendererConfig(roomId: string): Promise<RendererConfig[]> {
  return api.get<RendererConfig[]>(`/api/rooms/${roomId}/renderers`);
}
