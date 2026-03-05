export interface SocialwareApp {
  id: string;
  name: string;
  version: string;
  status: 'running' | 'stopped';
  identity?: string;
  description?: string;
  commands?: string[];
  datatypes?: string[];
  roles?: string[];
  room_tabs?: string[];
}
