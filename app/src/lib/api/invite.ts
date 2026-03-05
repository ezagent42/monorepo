/**
 * Invite API — wraps invite code endpoints.
 *
 * Endpoints:
 *   POST   /api/rooms/{id}/invite        — generate an invite code
 *   GET    /api/rooms/{id}/invite        — list invite codes for a room
 *   DELETE /api/rooms/{id}/invite/{code} — revoke an invite code
 *   POST   /api/invite/{code}            — join a room by invite code
 */

import { api } from './client';
import type { InviteCode, JoinByInviteResult } from '@/types';

/**
 * Generate a new invite code for a room.
 */
export function generateInviteCode(roomId: string): Promise<InviteCode> {
  return api.post<InviteCode>(`/api/rooms/${roomId}/invite`);
}

/**
 * List all active invite codes for a room.
 */
export function listInviteCodes(roomId: string): Promise<InviteCode[]> {
  return api.get<InviteCode[]>(`/api/rooms/${roomId}/invite`);
}

/**
 * Revoke an invite code.
 */
export function revokeInviteCode(roomId: string, code: string): Promise<void> {
  return api.delete<void>(`/api/rooms/${roomId}/invite/${code}`);
}

/**
 * Join a room using an invite code.
 */
export function joinByInviteCode(code: string): Promise<JoinByInviteResult> {
  return api.post<JoinByInviteResult>(`/api/invite/${code}`);
}
