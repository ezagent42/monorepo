/**
 * Rooms API — wraps room-related endpoints.
 *
 * Endpoints:
 *   GET  /api/rooms              — list joined rooms
 *   POST /api/rooms              — create a new room
 *   GET  /api/rooms/{id}         — get room config
 *   GET  /api/rooms/{id}/views   — room tab views
 *   GET  /api/rooms/{id}/members — room member list
 */

import { api } from './client';
import type { Room, RoomMember, RoomTabConfig } from '@/types';

/**
 * List all rooms the current user has joined.
 */
export function listRooms(): Promise<Room[]> {
  return api.get<Room[]>('/api/rooms');
}

/**
 * Create a new room.
 */
export function createRoom(body: { name: string; description: string }): Promise<Room> {
  return api.post<Room>('/api/rooms', body);
}

/**
 * Get a single room's configuration by ID.
 */
export function getRoom(roomId: string): Promise<Room> {
  return api.get<Room>(`/api/rooms/${roomId}`);
}

/**
 * Get the available view tabs for a room.
 */
export function getRoomViews(roomId: string): Promise<RoomTabConfig[]> {
  return api.get<RoomTabConfig[]>(`/api/rooms/${roomId}/views`);
}

/**
 * Get the member list for a room.
 */
export function getRoomMembers(roomId: string): Promise<RoomMember[]> {
  return api.get<RoomMember[]>(`/api/rooms/${roomId}/members`);
}
