import type { ComponentType } from 'react';

export type RendererType =
  | 'text'
  | 'structured_card'
  | 'media_message'
  | 'code_block'
  | 'document_link'
  | 'embed'
  | 'composite';

export interface RendererConfig {
  type: RendererType | string;
  field_mapping?: FieldMapping;
  sub_renderers?: RendererConfig[];
}

export interface FieldMapping {
  header?: string;
  body?: string;
  metadata?: MetadataField[];
  badge?: BadgeConfig;
  thumbnail?: string;
}

export interface MetadataField {
  field: string;
  format?: string;
  icon?: string;
}

export interface BadgeConfig {
  field: string;
  source?: string;         // "flow:ta:task_lifecycle"
}

export interface DecoratorConfig {
  position: 'above' | 'below' | 'inline' | 'badge' | 'overlay';
  type: string;
  priority: number;
  interaction?: Record<string, string>;
}

export interface RoomTabConfig {
  tab_label: string;
  tab_icon?: string;
  layout: 'message_list' | 'kanban' | 'grid' | 'table' | 'calendar' | 'document' | 'split_pane' | 'graph';
  layout_config?: Record<string, unknown>;
  as_room_tab: boolean;
}

export interface FlowBadgeStyle {
  color: string;
  label: string;
}

export interface FlowRendererConfig {
  actions: FlowActionDef[];
  badge: Record<string, FlowBadgeStyle>;
}

export interface FlowActionDef {
  transition: string;
  label: string;
  icon?: string;
  style: 'primary' | 'secondary' | 'danger';
  visible_to: string;
  confirm: boolean;
  confirm_message?: string;
}

export interface WidgetRegistration {
  id: string;
  type: 'inline_widget' | 'room_view' | 'panel_widget';
  subscriptions: {
    datatypes?: string[];
    annotations?: string[];
    indexes?: string[];
  };
  component: ComponentType<WidgetProps>;
}

export interface WidgetProps {
  data: {
    ref?: unknown;
    room?: unknown;
    query_results?: unknown;
    annotations?: Record<string, unknown>;
  };
  context: {
    viewer: { entityId: string; displayName: string };
    viewer_roles: string[];
    room_config: Record<string, unknown>;
  };
  actions: {
    sendMessage: (params: unknown) => Promise<void>;
    writeAnnotation: (params: unknown) => Promise<void>;
    advanceFlow: (params: unknown) => Promise<void>;
    navigate: (params: unknown) => void;
  };
}
