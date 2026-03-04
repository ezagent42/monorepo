import { create } from 'zustand';
import type { Message } from '@/types/message';

interface MessageState {
  messagesByRoom: Record<string, Message[]>;
  isLoading: boolean;
  hasMore: Record<string, boolean>;
  setMessages: (roomId: string, messages: Message[]) => void;
  addMessage: (roomId: string, message: Message) => void;
  prependMessages: (roomId: string, messages: Message[]) => void;
  updateAnnotation: (roomId: string, refId: string, key: string, value: unknown) => void;
  setHasMore: (roomId: string, hasMore: boolean) => void;
}

export const useMessageStore = create<MessageState>()((set) => ({
  messagesByRoom: {},
  isLoading: false,
  hasMore: {},

  setMessages: (roomId, messages) =>
    set((state) => ({
      messagesByRoom: { ...state.messagesByRoom, [roomId]: messages },
    })),

  addMessage: (roomId, message) =>
    set((state) => ({
      messagesByRoom: {
        ...state.messagesByRoom,
        [roomId]: [...(state.messagesByRoom[roomId] ?? []), message],
      },
    })),

  prependMessages: (roomId, messages) =>
    set((state) => ({
      messagesByRoom: {
        ...state.messagesByRoom,
        [roomId]: [...messages, ...(state.messagesByRoom[roomId] ?? [])],
      },
    })),

  updateAnnotation: (roomId, refId, key, value) =>
    set((state) => {
      const roomMessages = state.messagesByRoom[roomId];
      if (!roomMessages) return state;
      return {
        messagesByRoom: {
          ...state.messagesByRoom,
          [roomId]: roomMessages.map((msg) =>
            msg.ref_id === refId
              ? { ...msg, annotations: { ...msg.annotations, [key]: value } }
              : msg
          ),
        },
      };
    }),

  setHasMore: (roomId, hasMore) =>
    set((state) => ({
      hasMore: { ...state.hasMore, [roomId]: hasMore },
    })),
}));
