export type WsEventType =
  | 'message.new'
  | 'message.deleted'
  | 'message.edited'
  | 'room.created'
  | 'room.member_joined'
  | 'room.member_left'
  | 'room.config_updated'
  | 'reaction.added'
  | 'reaction.removed'
  | 'presence.joined'
  | 'presence.left'
  | 'typing.start'
  | 'typing.stop'
  | 'command.invoked'
  | 'command.result';

export interface WsEvent {
  type: WsEventType;
  room_id?: string;
  ref_id?: string;
  author?: string;
  timestamp: string;
  data: Record<string, unknown>;
}
