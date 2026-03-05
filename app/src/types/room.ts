export type MembershipPolicy = 'open' | 'knock' | 'invite';

export interface CreateRoomParams {
  name: string;
  description?: string;
  membership_policy?: MembershipPolicy;
}

export interface UpdateRoomParams {
  name?: string;
  description?: string;
  membership_policy?: MembershipPolicy;
  archived?: boolean;
}

export interface Room {
  room_id: string;
  name: string;
  members: string[];
  config: Record<string, unknown>;
  enabled_extensions: string[];
  unread_count?: number;
  description?: string;
  membership_policy?: MembershipPolicy;
  archived?: boolean;
}

export interface RoomMember {
  entity_id: string;
  display_name: string;
  avatar_url?: string;
  is_online: boolean;
  roles: string[];
}
