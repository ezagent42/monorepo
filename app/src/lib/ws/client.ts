import type { WsEvent, WsEventType } from '@/types';

/**
 * Event handler function type for WsClient event subscriptions.
 */
export type WsEventHandler = (event: WsEvent) => void;

/**
 * Connection state of the WebSocket client.
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

/**
 * Wildcard event key that matches all event types.
 */
const WILDCARD = '*';

/**
 * Reconnect configuration constants.
 */
const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
const BACKOFF_MULTIPLIER = 2;

/**
 * WebSocket client with reconnect logic and event-type dispatching.
 *
 * The client connects to a WebSocket endpoint, parses incoming JSON as
 * `WsEvent`, and dispatches each event to registered handlers by type.
 * A wildcard handler (`'*'`) receives all events.
 */
export class WsClient {
  readonly url: string;

  private _state: ConnectionState = 'disconnected';
  private _socket: WebSocket | null = null;
  private _handlers: Map<string, Set<WsEventHandler>> = new Map();
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _backoffMs: number = INITIAL_BACKOFF_MS;
  private _shouldReconnect: boolean = false;

  constructor(url: string) {
    this.url = url;
  }

  /**
   * Current connection state.
   */
  get state(): ConnectionState {
    return this._state;
  }

  /**
   * Register an event handler for a specific event type or wildcard ('*').
   */
  on(eventType: WsEventType | typeof WILDCARD, handler: WsEventHandler): void {
    const key = eventType as string;
    if (!this._handlers.has(key)) {
      this._handlers.set(key, new Set());
    }
    this._handlers.get(key)!.add(handler);
  }

  /**
   * Remove a previously registered event handler.
   */
  off(eventType: WsEventType | typeof WILDCARD, handler: WsEventHandler): void {
    const key = eventType as string;
    const handlers = this._handlers.get(key);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this._handlers.delete(key);
      }
    }
  }

  /**
   * Dispatch a WsEvent to all matching handlers.
   *
   * This method is public so it can be called directly in tests
   * without needing an actual WebSocket connection.
   */
  handleEvent(event: WsEvent): void {
    // Dispatch to type-specific handlers
    const typeHandlers = this._handlers.get(event.type);
    if (typeHandlers) {
      for (const handler of typeHandlers) {
        handler(event);
      }
    }

    // Dispatch to wildcard handlers
    const wildcardHandlers = this._handlers.get(WILDCARD);
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        handler(event);
      }
    }
  }

  /**
   * Open a WebSocket connection and start listening for events.
   * Enables automatic reconnection with exponential backoff on close.
   */
  connect(): void {
    if (this._state === 'connecting' || this._state === 'connected') {
      return;
    }

    this._shouldReconnect = true;
    this._openSocket();
  }

  /**
   * Close the WebSocket connection and disable automatic reconnection.
   */
  disconnect(): void {
    this._shouldReconnect = false;
    this._clearReconnectTimer();
    this._closeSocket();
    this._state = 'disconnected';
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _openSocket(): void {
    this._state = 'connecting';

    try {
      this._socket = new WebSocket(this.url);
    } catch {
      // WebSocket constructor can throw in some environments (e.g. jsdom).
      // Schedule reconnect if enabled.
      this._scheduleReconnect();
      return;
    }

    this._socket.onopen = () => {
      this._state = 'connected';
      this._backoffMs = INITIAL_BACKOFF_MS; // reset backoff on success
    };

    this._socket.onmessage = (msg: MessageEvent) => {
      try {
        const event: WsEvent = JSON.parse(msg.data as string);
        this.handleEvent(event);
      } catch {
        // Ignore malformed messages
      }
    };

    this._socket.onclose = () => {
      this._state = 'disconnected';
      this._socket = null;
      this._scheduleReconnect();
    };

    this._socket.onerror = () => {
      // onerror is always followed by onclose; nothing extra needed.
    };
  }

  private _closeSocket(): void {
    if (this._socket) {
      // Remove listeners before closing to prevent reconnect trigger
      this._socket.onopen = null;
      this._socket.onmessage = null;
      this._socket.onclose = null;
      this._socket.onerror = null;

      try {
        this._socket.close();
      } catch {
        // Ignore close errors in test environments
      }
      this._socket = null;
    }
  }

  private _scheduleReconnect(): void {
    if (!this._shouldReconnect) {
      return;
    }

    this._clearReconnectTimer();
    this._reconnectTimer = setTimeout(() => {
      this._openSocket();
    }, this._backoffMs);

    // Exponential backoff, capped at MAX_BACKOFF_MS
    this._backoffMs = Math.min(this._backoffMs * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS);
  }

  private _clearReconnectTimer(): void {
    if (this._reconnectTimer !== null) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }
}

/**
 * Singleton WsClient instance pre-configured for the local engine endpoint.
 */
export const wsClient = new WsClient('ws://localhost:8847/ws');
