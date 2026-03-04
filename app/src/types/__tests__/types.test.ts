import { describe, it, expect } from 'vitest';
import type { Message, Room, Identity, RendererConfig, WsEvent } from '@/types';

describe('Protocol types', () => {
  it('Message type has required fields', () => {
    const msg: Message = {
      ref_id: 'ulid:01HZ...',
      room_id: 'uuid:019...',
      author: '@alice:relay.ezagent.dev',
      timestamp: '2026-03-04T10:00:00Z',
      datatype: 'message',
      body: 'Hello',
      format: 'text/plain',
      annotations: {},
      ext: {},
    };
    expect(msg.ref_id).toBeDefined();
    expect(msg.author).toContain('@');
  });

  it('Room type has required fields', () => {
    const room: Room = {
      room_id: 'uuid:019...',
      name: 'Test Room',
      members: ['@alice:relay.ezagent.dev'],
      config: {},
      enabled_extensions: [],
    };
    expect(room.room_id).toBeDefined();
  });

  it('RendererConfig resolves type', () => {
    const config: RendererConfig = {
      type: 'structured_card',
      field_mapping: { header: 'title', metadata: [], badge: { field: 'status', source: 'flow:ta:task_lifecycle' } },
    };
    expect(config.type).toBe('structured_card');
  });
});
