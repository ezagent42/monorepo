import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TextRenderer } from '../text-renderer';
import { ContentRenderer } from '../ContentRenderer';
import type { Message } from '@/types';
import type { ResolvedRenderer } from '@/lib/pipeline/types';

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    ref_id: 'ref-1',
    room_id: 'room-1',
    author: '@alice:relay.ezagent.dev',
    timestamp: '2026-03-04T10:00:00Z',
    datatype: 'message',
    body: 'Hello world',
    annotations: {},
    ext: {},
    ...overrides,
  };
}

describe('TextRenderer', () => {
  // TC-5-RENDER-001: text/plain rendering
  it('renders plain text body (TC-5-RENDER-001)', () => {
    const msg = makeMessage({ body: 'Hello world', format: 'text/plain' });
    render(<TextRenderer message={msg} />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders plain text when no format specified', () => {
    const msg = makeMessage({ body: 'No format' });
    render(<TextRenderer message={msg} />);
    expect(screen.getByText('No format')).toBeInTheDocument();
  });

  // TC-5-RENDER-002: text/markdown rendering
  it('renders markdown with bold text (TC-5-RENDER-002)', () => {
    const msg = makeMessage({ body: '**bold** text', format: 'text/markdown' });
    const { container } = render(<TextRenderer message={msg} />);
    const strong = container.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toBe('bold');
  });

  it('renders markdown headers', () => {
    const msg = makeMessage({ body: '# Title', format: 'text/markdown' });
    const { container } = render(<TextRenderer message={msg} />);
    const h1 = container.querySelector('h1');
    expect(h1).not.toBeNull();
    expect(h1?.textContent).toBe('Title');
  });

  it('preserves whitespace in plain text', () => {
    const msg = makeMessage({ body: 'Line 1\nLine 2', format: 'text/plain' });
    render(<TextRenderer message={msg} />);
    const el = screen.getByText(/Line 1/);
    expect(el.className).toContain('whitespace-pre-wrap');
  });
});

describe('ContentRenderer', () => {
  it('routes text type to TextRenderer', () => {
    const resolved: ResolvedRenderer = {
      level: 1,
      type: 'text',
      config: { type: 'text' },
      component: null,
      message: makeMessage({ body: 'Routed text' }),
    };
    render(<ContentRenderer resolved={resolved} />);
    expect(screen.getByText('Routed text')).toBeInTheDocument();
  });

  it('renders Level 0 schema fallback with key:value pairs', () => {
    const msg = makeMessage({
      datatype: 'custom_report',
      schema: {
        title: { type: 'string', value: 'Q2 Report' },
        score: { type: 'number', value: 85 },
      },
    });
    const resolved: ResolvedRenderer = {
      level: 0,
      type: 'schema',
      config: null,
      component: null,
      message: msg,
    };
    render(<ContentRenderer resolved={resolved} />);
    expect(screen.getByText('Q2 Report')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
  });

  it('renders Level 2 custom component', () => {
    const Custom = ({ message }: any) => <div>Custom: {message.body}</div>;
    const resolved: ResolvedRenderer = {
      level: 2,
      type: 'custom',
      config: null,
      component: Custom,
      message: makeMessage({ body: 'Widget data' }),
    };
    render(<ContentRenderer resolved={resolved} />);
    expect(screen.getByText('Custom: Widget data')).toBeInTheDocument();
  });

  it('falls back to text renderer for unknown type', () => {
    const resolved: ResolvedRenderer = {
      level: 1,
      type: 'unknown_future_type',
      config: { type: 'unknown_future_type' },
      component: null,
      message: makeMessage({ body: 'Fallback text' }),
    };
    render(<ContentRenderer resolved={resolved} />);
    expect(screen.getByText('Fallback text')).toBeInTheDocument();
  });

  it('renders schema fallback with boolean values', () => {
    const msg = makeMessage({
      datatype: 'test_result',
      schema: {
        passed: { type: 'boolean', value: true },
        failed: { type: 'boolean', value: false },
      },
    });
    const resolved: ResolvedRenderer = {
      level: 0,
      type: 'schema',
      config: null,
      component: null,
      message: msg,
    };
    render(<ContentRenderer resolved={resolved} />);
    expect(screen.getByText('\u2705')).toBeInTheDocument();
    expect(screen.getByText('\u274C')).toBeInTheDocument();
  });
});
