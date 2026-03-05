import { describe, it, expect, beforeEach } from 'vitest';
import { useMessageStore } from '../message-store';
import type { Message } from '@/types';

const makeMessage = (overrides: Partial<Message> = {}): Message => ({
  ref_id: 'm1',
  room_id: 'r1',
  author: '@alice',
  timestamp: '2024-01-01T00:00:00Z',
  datatype: 'message',
  body: 'hello',
  annotations: {},
  ext: {},
  ...overrides,
});

describe('message-store operations', () => {
  beforeEach(() => {
    useMessageStore.setState({
      messagesByRoom: {},
      isLoading: false,
      hasMore: {},
    });
  });

  it('removeMessage removes a message by refId', () => {
    useMessageStore.getState().setMessages('r1', [makeMessage()]);
    useMessageStore.getState().removeMessage('r1', 'm1');
    expect(useMessageStore.getState().messagesByRoom['r1']).toHaveLength(0);
  });

  it('removeMessage is a no-op for unknown room', () => {
    useMessageStore.getState().removeMessage('r999', 'm1');
    expect(useMessageStore.getState().messagesByRoom).toEqual({});
  });

  it('updateMessage patches a message', () => {
    useMessageStore.getState().setMessages('r1', [makeMessage()]);
    useMessageStore.getState().updateMessage('r1', 'm1', { body: 'updated' });
    expect(useMessageStore.getState().messagesByRoom['r1'][0].body).toBe('updated');
  });

  it('updateMessage is a no-op for unknown room', () => {
    useMessageStore.getState().updateMessage('r999', 'm1', { body: 'updated' });
    expect(useMessageStore.getState().messagesByRoom).toEqual({});
  });
});
