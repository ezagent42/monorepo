import { describe, it, expect, vi } from 'vitest';
import { resolveRenderer } from '../resolve';
import type { Message } from '@/types';
import type { ComponentType } from 'react';

// Helper to create a minimal test message
function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    ref_id: 'ref-1',
    room_id: 'room-1',
    author: '@alice:relay.ezagent.dev',
    timestamp: '2026-03-04T10:00:00Z',
    datatype: 'message',
    body: 'Hello',
    annotations: {},
    ext: {},
    ...overrides,
  };
}

describe('resolveRenderer', () => {
  // TC-5-OVERRIDE-001: Level 0 Schema-derived auto-rendering
  it('returns Level 0 schema renderer when no renderer field and no widget (TC-5-OVERRIDE-001)', () => {
    const msg = makeMessage({
      datatype: 'custom_report',
      schema: {
        title: { type: 'string', value: 'Q2 Report' },
        score: { type: 'number', value: 85 },
        passed: { type: 'boolean', value: true },
        tags: { type: 'array', value: ['quarterly'] },
      },
    });

    const result = resolveRenderer(msg);

    expect(result.level).toBe(0);
    expect(result.type).toBe('schema');
    expect(result.config).toBeNull();
    expect(result.component).toBeNull();
    expect(result.message).toBe(msg);
  });

  // TC-5-OVERRIDE-003: Level 1 overrides Level 0
  it('returns Level 1 declarative renderer when renderer field is present (TC-5-OVERRIDE-003)', () => {
    const msg = makeMessage({
      datatype: 'ta_task',
      renderer: {
        type: 'structured_card',
        field_mapping: { header: 'title', body: 'description' },
      },
    });

    const result = resolveRenderer(msg);

    expect(result.level).toBe(1);
    expect(result.type).toBe('structured_card');
    expect(result.config).toEqual(msg.renderer);
    expect(result.component).toBeNull();
  });

  // TC-5-OVERRIDE-004: Level 2 overrides Level 1
  it('returns Level 2 custom widget even when Level 1 renderer exists (TC-5-OVERRIDE-004)', () => {
    const CustomComponent: ComponentType<any> = () => null;
    const widgetLookup = vi.fn().mockReturnValue(CustomComponent);

    const msg = makeMessage({
      datatype: 'ew_event',
      renderer: { type: 'structured_card' }, // Level 1 exists but should be ignored
    });

    const result = resolveRenderer(msg, widgetLookup);

    expect(result.level).toBe(2);
    expect(result.type).toBe('custom');
    expect(result.component).toBe(CustomComponent);
    expect(result.config).toBeNull();
    expect(widgetLookup).toHaveBeenCalledWith('ew_event');
  });

  // TC-5-OVERRIDE-005: Fallback chain per datatype
  it('resolves different levels for different datatypes in same room (TC-5-OVERRIDE-005)', () => {
    const CustomWidget: ComponentType<any> = () => null;
    const widgetLookup = (datatype: string) =>
      datatype === 'type_a' ? CustomWidget : null;

    const msgA = makeMessage({ datatype: 'type_a' });
    const msgB = makeMessage({
      datatype: 'type_b',
      renderer: { type: 'structured_card' },
    });
    const msgC = makeMessage({ datatype: 'type_c' });

    expect(resolveRenderer(msgA, widgetLookup).level).toBe(2);
    expect(resolveRenderer(msgB, widgetLookup).level).toBe(1);
    expect(resolveRenderer(msgC, widgetLookup).level).toBe(0);
  });

  // TC-5-OVERRIDE-006: Same extension different levels
  it('resolves independently per usage context (TC-5-OVERRIDE-006)', () => {
    // Thread indicator (decorator) -- no custom renderer, falls to Level 0
    const threadMsg = makeMessage({ datatype: 'thread_indicator' });
    const noWidgets = () => null;

    const threadResult = resolveRenderer(threadMsg, noWidgets);
    expect(threadResult.level).toBe(0);

    // Thread panel tab -- has Level 1 renderer declaration
    const threadPanelMsg = makeMessage({
      datatype: 'thread_panel',
      renderer: { type: 'text' },
    });

    const panelResult = resolveRenderer(threadPanelMsg, noWidgets);
    expect(panelResult.level).toBe(1);
  });

  // TC-5-OVERRIDE-002: Level 0 auto-generates room tab (conceptual -- resolver returns level 0)
  it('returns Level 0 for datatype with index but no renderer (TC-5-OVERRIDE-002)', () => {
    const msg = makeMessage({
      datatype: 'custom_report',
      schema: {
        title: { type: 'string', value: 'Report' },
        score: { type: 'number', value: 42 },
      },
    });

    const result = resolveRenderer(msg);

    expect(result.level).toBe(0);
    expect(result.type).toBe('schema');
  });

  // Edge cases
  it('handles message with empty renderer object gracefully', () => {
    const msg = makeMessage({
      renderer: { type: '' } as any,
    });

    const result = resolveRenderer(msg);
    // Empty string type is falsy -> falls to Level 0
    expect(result.level).toBe(0);
  });

  it('passes datatype to widgetLookup for Level 2 resolution', () => {
    const lookup = vi.fn().mockReturnValue(null);
    const msg = makeMessage({ datatype: 'my_custom_type' });

    resolveRenderer(msg, lookup);
    expect(lookup).toHaveBeenCalledWith('my_custom_type');
  });

  it('works with default widgetLookup (no widgets registered)', () => {
    const msg = makeMessage({
      renderer: { type: 'text' },
    });

    const result = resolveRenderer(msg);
    expect(result.level).toBe(1);
    expect(result.type).toBe('text');
  });
});
