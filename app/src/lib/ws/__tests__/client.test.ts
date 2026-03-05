import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WsClient } from '../client';

describe('WsClient', () => {
  let ws: WsClient;

  beforeEach(() => {
    ws = new WsClient('ws://localhost:6142/ws');
  });

  afterEach(() => {
    ws.disconnect();
  });

  it('stores the connection URL', () => {
    expect(ws.url).toBe('ws://localhost:6142/ws');
  });

  it('starts in disconnected state', () => {
    expect(ws.state).toBe('disconnected');
  });

  it('dispatches events to registered handlers', () => {
    const handler = vi.fn();
    ws.on('message.new', handler);
    ws.handleEvent({
      type: 'message.new',
      timestamp: '2026-03-04T10:00:00Z',
      data: { body: 'hi' },
    });
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'message.new' })
    );
  });

  it('supports wildcard handler', () => {
    const handler = vi.fn();
    ws.on('*', handler);
    ws.handleEvent({
      type: 'room.created',
      timestamp: '2026-03-04T10:00:00Z',
      data: {},
    });
    expect(handler).toHaveBeenCalled();
  });

  it('calls wildcard handler for every event type', () => {
    const handler = vi.fn();
    ws.on('*', handler);
    ws.handleEvent({
      type: 'message.new',
      timestamp: '2026-03-04T10:00:00Z',
      data: {},
    });
    ws.handleEvent({
      type: 'presence.joined',
      timestamp: '2026-03-04T10:00:00Z',
      data: {},
    });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('does not call unrelated handlers', () => {
    const messageHandler = vi.fn();
    const roomHandler = vi.fn();
    ws.on('message.new', messageHandler);
    ws.on('room.created', roomHandler);
    ws.handleEvent({
      type: 'message.new',
      timestamp: '2026-03-04T10:00:00Z',
      data: {},
    });
    expect(messageHandler).toHaveBeenCalledTimes(1);
    expect(roomHandler).not.toHaveBeenCalled();
  });

  it('supports multiple handlers for the same event type', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    ws.on('message.new', handler1);
    ws.on('message.new', handler2);
    ws.handleEvent({
      type: 'message.new',
      timestamp: '2026-03-04T10:00:00Z',
      data: {},
    });
    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('removes handlers with off()', () => {
    const handler = vi.fn();
    ws.on('message.new', handler);
    ws.off('message.new', handler);
    ws.handleEvent({
      type: 'message.new',
      timestamp: '2026-03-04T10:00:00Z',
      data: {},
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('removes wildcard handlers with off()', () => {
    const handler = vi.fn();
    ws.on('*', handler);
    ws.off('*', handler);
    ws.handleEvent({
      type: 'message.new',
      timestamp: '2026-03-04T10:00:00Z',
      data: {},
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('passes the full event object to handlers', () => {
    const handler = vi.fn();
    ws.on('presence.joined', handler);
    const event = {
      type: 'presence.joined' as const,
      room_id: 'room-1',
      author: 'user-42',
      timestamp: '2026-03-04T10:00:00Z',
      data: { display_name: 'Alice' },
    };
    ws.handleEvent(event);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('does not throw when dispatching event with no handlers', () => {
    expect(() => {
      ws.handleEvent({
        type: 'typing.start',
        timestamp: '2026-03-04T10:00:00Z',
        data: {},
      });
    }).not.toThrow();
  });
});
