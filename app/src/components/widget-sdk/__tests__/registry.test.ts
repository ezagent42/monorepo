import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerRenderer,
  unregisterRenderer,
  getWidget,
  lookupWidgetByDatatype,
  getAllWidgets,
  clearRegistry,
} from '../registry';
import type { WidgetRegistration } from '@/types/renderer';

const mockWidget: WidgetRegistration = {
  id: 'sw:ew:dag_view',
  type: 'room_view',
  subscriptions: { datatypes: ['ew_event'] },
  component: () => null,
};

beforeEach(() => {
  clearRegistry();
});

describe('Widget Registry', () => {
  // TC-5-WIDGET-001: registerRenderer
  it('registers a widget (TC-5-WIDGET-001)', () => {
    registerRenderer(mockWidget);
    expect(getWidget('sw:ew:dag_view')).toEqual(mockWidget);
  });

  // TC-5-WIDGET-003: Multiple widgets
  it('registers multiple widgets (TC-5-WIDGET-003)', () => {
    const widget2: WidgetRegistration = {
      id: 'sw:ta:board',
      type: 'room_view',
      subscriptions: { datatypes: ['ta_task'] },
      component: () => null,
    };
    registerRenderer(mockWidget);
    registerRenderer(widget2);
    expect(getAllWidgets()).toHaveLength(2);
  });

  it('looks up widget by datatype', () => {
    registerRenderer(mockWidget);
    expect(lookupWidgetByDatatype('ew_event')).toBe(mockWidget.component);
    expect(lookupWidgetByDatatype('unknown')).toBeNull();
  });

  it('unregisters a widget', () => {
    registerRenderer(mockWidget);
    unregisterRenderer('sw:ew:dag_view');
    expect(getWidget('sw:ew:dag_view')).toBeUndefined();
  });

  it('clears all registrations', () => {
    registerRenderer(mockWidget);
    clearRegistry();
    expect(getAllWidgets()).toHaveLength(0);
  });
});
