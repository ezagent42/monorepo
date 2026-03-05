/**
 * Search API — wraps search and discovery endpoints.
 *
 * Endpoints:
 *   GET  /api/rooms/{id}/messages/search?q= — search messages in a room
 *   GET  /api/search/messages?q=            — search messages globally
 *   POST /api/ext/discovery/search          — search people / entities
 */

import { api } from './client';
import type { Message } from '@/types';
import type { UserProfile } from '@/types/profile';

export interface SearchMessagesResult {
  messages: Array<Message & { room_name: string }>;
}

export interface SearchPeopleResult {
  entities: UserProfile[];
}

/**
 * Search messages, optionally scoped to a specific room.
 */
export function searchMessages(query: string, roomId?: string): Promise<SearchMessagesResult> {
  const path = roomId
    ? `/api/rooms/${roomId}/messages/search?q=${encodeURIComponent(query)}`
    : `/api/search/messages?q=${encodeURIComponent(query)}`;
  return api.get<SearchMessagesResult>(path);
}

/**
 * Search for people / entities.
 */
export function searchPeople(query: string): Promise<SearchPeopleResult> {
  return api.post<SearchPeopleResult>('/api/ext/discovery/search', { query, type: 'entity' });
}
