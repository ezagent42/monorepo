export interface InviteCode {
  code: string;
  room_id: string;
  created_by: string;
  created_at: string;
  expires_at: string;
  use_count: number;
  invite_uri: string;
}

export interface JoinByInviteResult {
  room_id: string;
  room_name: string;
}
