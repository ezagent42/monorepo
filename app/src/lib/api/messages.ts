/**
 * Messages API — wraps timeline/message endpoints.
 *
 * Endpoints:
 *   GET  /api/rooms/{id}/messages                      — paginated message list
 *   POST /api/rooms/{id}/messages                      — send a message
 *   POST /api/rooms/{id}/messages/{ref}/reactions       — add reaction
 */

import { api } from './client';
import type { Message } from '@/types';

export interface ListMessagesParams {
  before?: string;
  limit?: number;
}

export interface SendMessageBody {
  body: string;
  datatype?: string;
  format?: string;
}

export interface SendMessageResponse {
  ref_id: string;
}

export interface AddReactionResponse {
  ok: boolean;
}

/**
 * List messages in a room with optional cursor-based pagination.
 */
export function listMessages(
  roomId: string,
  params?: ListMessagesParams,
): Promise<Message[]> {
  const query = new URLSearchParams();
  if (params?.before) query.set('before', params.before);
  if (params?.limit != null) query.set('limit', String(params.limit));
  const qs = query.toString();
  const path = `/api/rooms/${roomId}/messages${qs ? `?${qs}` : ''}`;
  return api.get<Message[]>(path);
}

/**
 * Send a message to a room.
 */
export function sendMessage(
  roomId: string,
  body: SendMessageBody,
): Promise<SendMessageResponse> {
  return api.post<SendMessageResponse>(`/api/rooms/${roomId}/messages`, body);
}

/**
 * Add a reaction (emoji) to a message.
 */
export function addReaction(
  roomId: string,
  refId: string,
  emoji: string,
): Promise<AddReactionResponse> {
  return api.post<AddReactionResponse>(
    `/api/rooms/${roomId}/messages/${refId}/reactions`,
    { emoji },
  );
}
