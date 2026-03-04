import type { ComponentType } from 'react';
import type { WidgetRegistration, WidgetProps } from '@/types/renderer';

/** Global widget registry -- maps widget ID to registration */
const registry = new Map<string, WidgetRegistration>();

/**
 * Register a custom renderer widget.
 * Widgets are Level 2 in the render pipeline.
 */
export function registerRenderer(registration: WidgetRegistration): void {
  registry.set(registration.id, registration);
}

/**
 * Unregister a widget by ID.
 */
export function unregisterRenderer(id: string): void {
  registry.delete(id);
}

/**
 * Get a registered widget by ID.
 */
export function getWidget(id: string): WidgetRegistration | undefined {
  return registry.get(id);
}

/**
 * Look up a widget component by datatype.
 * Used as the widgetLookup function in the pipeline resolver.
 */
export function lookupWidgetByDatatype(datatype: string): ComponentType<WidgetProps> | null {
  for (const widget of registry.values()) {
    if (widget.subscriptions.datatypes?.includes(datatype)) {
      return widget.component as ComponentType<WidgetProps>;
    }
  }
  return null;
}

/**
 * Get all registered widgets.
 */
export function getAllWidgets(): WidgetRegistration[] {
  return Array.from(registry.values());
}

/**
 * Clear the registry (for testing).
 */
export function clearRegistry(): void {
  registry.clear();
}
