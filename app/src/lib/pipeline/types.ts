import type { ComponentType } from 'react';
import type { Message, RendererConfig } from '@/types';

/** Result of the pipeline resolution */
export interface ResolvedRenderer {
  /** The level that was resolved: 0 = schema-derived, 1 = declarative, 2 = custom widget */
  level: 0 | 1 | 2;
  /** The renderer type string (e.g. 'text', 'structured_card', 'schema') */
  type: string;
  /** The renderer config (for Level 1) or null */
  config: RendererConfig | null;
  /** Custom component (for Level 2) or null */
  component: ComponentType<any> | null;
  /** The message being rendered */
  message: Message;
}

/** Widget registry lookup function signature */
export type WidgetLookup = (datatype: string) => ComponentType<any> | null;
