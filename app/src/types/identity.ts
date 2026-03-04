export interface Identity {
  entity_id: string;        // "@alice:relay.ezagent.dev"
  display_name: string;
  avatar_url?: string;
  pubkey?: string;
}

export interface AuthSession {
  entity_id: string;
  display_name: string;
  avatar_url?: string;
  github_id?: number;
  authenticated: boolean;
}
