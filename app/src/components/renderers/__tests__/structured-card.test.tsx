import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StructuredCard } from '../structured-card';
import { ContentRenderer } from '../ContentRenderer';
import type { Message } from '@/types';
import type { ResolvedRenderer } from '@/lib/pipeline/types';
import type { FieldMapping } from '@/types/renderer';

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    ref_id: 'ref-1',
    room_id: 'room-1',
    author: '@alice:relay.ezagent.dev',
    timestamp: '2026-03-04T10:00:00Z',
    datatype: 'ta_task',
    body: 'Task body',
    annotations: {},
    ext: {},
    ...overrides,
  };
}

describe('StructuredCard', () => {
  // TC-5-RENDER-003: structured_card rendering
  it('renders card with header from field_mapping (TC-5-RENDER-003)', () => {
    const msg = makeMessage({
      schema: {
        title: { type: 'string', value: 'Fix login bug' },
        reward: { type: 'number', value: 50 },
        currency: { type: 'string', value: 'USD' },
        status: { type: 'string', value: 'open' },
      },
    });
    const fieldMapping: FieldMapping = {
      header: 'title',
      metadata: [
        { field: 'reward', format: '{value} {currency}', icon: 'coin' },
      ],
      badge: { field: 'status' },
    };

    render(<StructuredCard message={msg} fieldMapping={fieldMapping} />);

    expect(screen.getByText('Fix login bug')).toBeInTheDocument();
    expect(screen.getByText('50 USD')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('renders metadata with icon emoji', () => {
    const msg = makeMessage({
      schema: {
        points: { type: 'number', value: 100 },
      },
    });
    const fieldMapping: FieldMapping = {
      metadata: [
        { field: 'points', icon: 'star' },
      ],
    };

    render(<StructuredCard message={msg} fieldMapping={fieldMapping} />);
    expect(screen.getByText('\u2B50')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('falls back to message.body when header field not found', () => {
    const msg = makeMessage({ body: 'Fallback title' });
    render(<StructuredCard message={msg} fieldMapping={{ header: 'missing_field' }} />);
    expect(screen.getByText('Fallback title')).toBeInTheDocument();
  });

  it('renders without badge when not configured', () => {
    const msg = makeMessage({
      schema: { title: { type: 'string', value: 'No badge' } },
    });
    render(<StructuredCard message={msg} fieldMapping={{ header: 'title' }} />);
    expect(screen.getByText('No badge')).toBeInTheDocument();
  });

  it('skips null metadata values', () => {
    const msg = makeMessage({
      schema: {
        title: { type: 'string', value: 'Test' },
      },
    });
    const fieldMapping: FieldMapping = {
      header: 'title',
      metadata: [
        { field: 'nonexistent', icon: 'star' },
      ],
    };
    render(<StructuredCard message={msg} fieldMapping={fieldMapping} />);
    // Should not render the metadata row for nonexistent field
    expect(screen.queryByText('\u2B50')).not.toBeInTheDocument();
  });
});

describe('ContentRenderer with structured_card', () => {
  it('routes structured_card type correctly', () => {
    const msg = makeMessage({
      schema: {
        title: { type: 'string', value: 'Routed Card' },
      },
    });
    const resolved: ResolvedRenderer = {
      level: 1,
      type: 'structured_card',
      config: {
        type: 'structured_card',
        field_mapping: { header: 'title' },
      },
      component: null,
      message: msg,
    };
    render(<ContentRenderer resolved={resolved} />);
    expect(screen.getByText('Routed Card')).toBeInTheDocument();
  });
});
