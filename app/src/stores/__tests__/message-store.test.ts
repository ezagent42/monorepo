import { describe, it, expect, beforeEach } from 'vitest';
import { useMessageStore } from '../message-store';
import type { Message } from '@/types/message';

const makeMessage = (overrides: Partial<Message> = {}): Message => ({
  ref_id: 'msg-1',
  room_id: 'room-1',
  author: '@alice:relay.ezagent.dev',
  timestamp: '2026-03-04T10:00:00Z',
  datatype: 'socialware.chat.text',
  body: 'Hello, world!',
  annotations: {},
  ext: {},
  ...overrides,
});

describe('MessageStore', () => {
  beforeEach(() => useMessageStore.setState(useMessageStore.getInitialState()));

  it('starts with empty messagesByRoom', () => {
    expect(useMessageStore.getState().messagesByRoom).toEqual({});
  });

  it('starts with isLoading false', () => {
    expect(useMessageStore.getState().isLoading).toBe(false);
  });

  it('starts with empty hasMore', () => {
    expect(useMessageStore.getState().hasMore).toEqual({});
  });

  it('setMessages replaces messages for a room', () => {
    const msgs = [
      makeMessage({ ref_id: 'msg-1' }),
      makeMessage({ ref_id: 'msg-2' }),
    ];
    useMessageStore.getState().setMessages('room-1', msgs);
    expect(useMessageStore.getState().messagesByRoom['room-1']).toHaveLength(2);
    expect(useMessageStore.getState().messagesByRoom['room-1'][0].ref_id).toBe('msg-1');
    expect(useMessageStore.getState().messagesByRoom['room-1'][1].ref_id).toBe('msg-2');

    // Replace with a different set
    const newMsgs = [makeMessage({ ref_id: 'msg-3' })];
    useMessageStore.getState().setMessages('room-1', newMsgs);
    expect(useMessageStore.getState().messagesByRoom['room-1']).toHaveLength(1);
    expect(useMessageStore.getState().messagesByRoom['room-1'][0].ref_id).toBe('msg-3');
  });

  it('addMessage appends to existing room messages', () => {
    useMessageStore.getState().setMessages('room-1', [makeMessage({ ref_id: 'msg-1' })]);
    useMessageStore.getState().addMessage('room-1', makeMessage({ ref_id: 'msg-2', body: 'New message' }));
    const msgs = useMessageStore.getState().messagesByRoom['room-1'];
    expect(msgs).toHaveLength(2);
    expect(msgs[0].ref_id).toBe('msg-1');
    expect(msgs[1].ref_id).toBe('msg-2');
    expect(msgs[1].body).toBe('New message');
  });

  it('addMessage creates room entry if it does not exist', () => {
    useMessageStore.getState().addMessage('room-new', makeMessage({ ref_id: 'msg-1', room_id: 'room-new' }));
    expect(useMessageStore.getState().messagesByRoom['room-new']).toHaveLength(1);
    expect(useMessageStore.getState().messagesByRoom['room-new'][0].ref_id).toBe('msg-1');
  });

  it('prependMessages adds older messages at the beginning', () => {
    useMessageStore.getState().setMessages('room-1', [
      makeMessage({ ref_id: 'msg-3', timestamp: '2026-03-04T10:03:00Z' }),
    ]);
    useMessageStore.getState().prependMessages('room-1', [
      makeMessage({ ref_id: 'msg-1', timestamp: '2026-03-04T10:01:00Z' }),
      makeMessage({ ref_id: 'msg-2', timestamp: '2026-03-04T10:02:00Z' }),
    ]);
    const msgs = useMessageStore.getState().messagesByRoom['room-1'];
    expect(msgs).toHaveLength(3);
    expect(msgs[0].ref_id).toBe('msg-1');
    expect(msgs[1].ref_id).toBe('msg-2');
    expect(msgs[2].ref_id).toBe('msg-3');
  });

  it('prependMessages creates room entry if it does not exist', () => {
    useMessageStore.getState().prependMessages('room-new', [
      makeMessage({ ref_id: 'msg-old', room_id: 'room-new' }),
    ]);
    expect(useMessageStore.getState().messagesByRoom['room-new']).toHaveLength(1);
    expect(useMessageStore.getState().messagesByRoom['room-new'][0].ref_id).toBe('msg-old');
  });

  it('updateAnnotation modifies correct message', () => {
    useMessageStore.getState().setMessages('room-1', [
      makeMessage({ ref_id: 'msg-1', annotations: { likes: 0 } }),
      makeMessage({ ref_id: 'msg-2', annotations: {} }),
    ]);
    useMessageStore.getState().updateAnnotation('room-1', 'msg-1', 'likes', 42);
    const msgs = useMessageStore.getState().messagesByRoom['room-1'];
    expect(msgs[0].annotations['likes']).toBe(42);
    // Other message untouched
    expect(msgs[1].annotations).toEqual({});
  });

  it('updateAnnotation does not affect other rooms', () => {
    useMessageStore.getState().setMessages('room-1', [
      makeMessage({ ref_id: 'msg-1', annotations: { likes: 0 } }),
    ]);
    useMessageStore.getState().setMessages('room-2', [
      makeMessage({ ref_id: 'msg-1', room_id: 'room-2', annotations: { likes: 0 } }),
    ]);
    useMessageStore.getState().updateAnnotation('room-1', 'msg-1', 'likes', 99);
    expect(useMessageStore.getState().messagesByRoom['room-2'][0].annotations['likes']).toBe(0);
  });

  it('setHasMore sets pagination flag for a room', () => {
    useMessageStore.getState().setHasMore('room-1', true);
    expect(useMessageStore.getState().hasMore['room-1']).toBe(true);
    useMessageStore.getState().setHasMore('room-1', false);
    expect(useMessageStore.getState().hasMore['room-1']).toBe(false);
  });

  it('setMessages does not affect other rooms', () => {
    useMessageStore.getState().setMessages('room-1', [makeMessage({ ref_id: 'msg-1' })]);
    useMessageStore.getState().setMessages('room-2', [makeMessage({ ref_id: 'msg-2', room_id: 'room-2' })]);
    useMessageStore.getState().setMessages('room-1', [makeMessage({ ref_id: 'msg-3' })]);
    expect(useMessageStore.getState().messagesByRoom['room-2']).toHaveLength(1);
    expect(useMessageStore.getState().messagesByRoom['room-2'][0].ref_id).toBe('msg-2');
  });
});
