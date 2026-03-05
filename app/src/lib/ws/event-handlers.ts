import { wsClient } from './client';
import { registerDefaultHandlers } from './handlers';

/**
 * Register all WebSocket event handlers on the singleton `wsClient`.
 *
 * Call this once when the chat layout mounts. The handlers wire incoming
 * WsEvents to the appropriate Zustand store actions (message-store,
 * room-store, presence-store).
 */
export function registerWsHandlers(): void {
  registerDefaultHandlers(wsClient);
}
