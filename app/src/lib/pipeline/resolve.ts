import type { Message } from '@/types';
import type { ResolvedRenderer, WidgetLookup } from './types';

/**
 * Resolve the renderer for a message using the 3-level fallback chain:
 * Level 2 (Widget SDK) -> Level 1 (declarative) -> Level 0 (schema-derived)
 *
 * @param message - The message to resolve a renderer for
 * @param widgetLookup - Function to check for Level 2 registered widgets
 * @returns ResolvedRenderer with level, type, config, and component info
 */
export function resolveRenderer(
  message: Message,
  widgetLookup: WidgetLookup = () => null,
): ResolvedRenderer {
  // Level 2: Check Widget SDK registry
  const customComponent = widgetLookup(message.datatype);
  if (customComponent) {
    return {
      level: 2,
      type: 'custom',
      config: null,
      component: customComponent,
      message,
    };
  }

  // Level 1: Check declarative renderer config on the message
  if (message.renderer && message.renderer.type) {
    return {
      level: 1,
      type: message.renderer.type,
      config: message.renderer,
      component: null,
      message,
    };
  }

  // Level 0: Schema-derived auto-rendering
  return {
    level: 0,
    type: 'schema',
    config: null,
    component: null,
    message,
  };
}
