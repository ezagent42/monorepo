import type { RendererConfig } from './renderer';

export interface Message {
  ref_id: string;
  room_id: string;
  author: string;
  timestamp: string;
  datatype: string;
  body: string;
  format?: string;
  schema?: Record<string, SchemaField>;
  annotations: Record<string, unknown>;
  ext: Record<string, unknown>;
  renderer?: RendererConfig;
  flow_state?: string;
  flow_actions?: FlowAction[];
}

export interface SchemaField {
  type: 'string' | 'number' | 'boolean' | 'datetime' | 'array' | 'object';
  value: unknown;
}

export interface FlowAction {
  transition: string;         // "open -> claimed"
  label: string;
  icon?: string;
  style: 'primary' | 'secondary' | 'danger';
  visible_to: string;        // "role:ta:worker"
  confirm: boolean;
  confirm_message?: string;
}

export type { RendererConfig } from './renderer';
