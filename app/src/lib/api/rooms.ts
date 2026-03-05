/**
 * Rooms API — wraps room-related endpoints.
 *
 * Endpoints:
 *   GET   /api/rooms              — list joined rooms
 *   POST  /api/rooms              — create a new room
 *   GET   /api/rooms/{id}         — get room config
 *   PATCH /api/rooms/{id}         — update room settings
 *   GET   /api/rooms/{id}/views   — room tab views
 *   GET   /api/rooms/{id}/members — room member list
 *   POST  /api/rooms/{id}/leave   — leave a room
 */

import { api } from './client';
import type { Room, RoomMember, RoomTabConfig, CreateRoomParams, UpdateRoomParams } from '@/types';

/**
 * List all rooms the current user has joined.
 */
export function listRooms(): Promise<Room[]> {
  return api.get<Room[]>('/api/rooms');
}

/**
 * Create a new room.
 */
export function createRoom(body: CreateRoomParams): Promise<Room> {
  return api.post<Room>('/api/rooms', body);
}

/**
 * Get a single room's configuration by ID.
 */
export function getRoom(roomId: string): Promise<Room> {
  return api.get<Room>(`/api/rooms/${roomId}`);
}

/**
 * Update a room's settings (partial update).
 */
export function updateRoom(roomId: string, body: UpdateRoomParams): Promise<Room> {
  return api.patch<Room>(`/api/rooms/${roomId}`, body);
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

/**
 * Leave a room.
 */
export function leaveRoom(roomId: string): Promise<void> {
  return api.post<void>(`/api/rooms/${roomId}/leave`);
}
