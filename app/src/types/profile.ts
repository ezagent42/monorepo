export interface UserProfile {
  entity_id: string;
  display_name: string;
  bio?: string;
  avatar_url?: string;
  avatar_blob_hash?: string;
}

export interface UpdateProfileParams {
  display_name?: string;
  bio?: string;
  avatar_blob_hash?: string;
}
