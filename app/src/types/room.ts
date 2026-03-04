export interface Room {
  room_id: string;
  name: string;
  members: string[];
  config: Record<string, unknown>;
  enabled_extensions: string[];
  unread_count?: number;
}

export interface RoomMember {
  entity_id: string;
  display_name: string;
  avatar_url?: string;
  is_online: boolean;
  roles: string[];
}
