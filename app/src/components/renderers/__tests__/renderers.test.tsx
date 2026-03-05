import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MediaMessage } from '../media-message';
import { CodeBlock } from '../code-block';
import { DocumentLink } from '../document-link';
import { Composite } from '../composite';
import { SchemaRenderer } from '../schema-renderer';
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
    body: 'Hello',
    annotations: {},
    ext: {},
    ...overrides,
  };
}

describe('MediaMessage (TC-5-RENDER-004)', () => {
  it('renders image with filename', () => {
    const msg = makeMessage({
      datatype: 'media_message',
      schema: {
        filename: { type: 'string', value: 'photo.png' },
        mime_type: { type: 'string', value: 'image/png' },
        size: { type: 'number', value: 1048576 },
        url: { type: 'string', value: 'https://example.com/photo.png' },
      },
    });
    render(<MediaMessage message={msg} />);
    expect(screen.getByText('photo.png')).toBeInTheDocument();
    expect(screen.getByText(/1\.0 MB/)).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('alt', 'photo.png');
  });

  it('renders generic attachment for non-media files', () => {
    const msg = makeMessage({
      schema: {
        filename: { type: 'string', value: 'data.csv' },
        mime_type: { type: 'string', value: 'text/csv' },
      },
    });
    render(<MediaMessage message={msg} />);
    expect(screen.getByText('\u{1F4CE}')).toBeInTheDocument();
    // filename appears in both the attachment box and the metadata line
    expect(screen.getAllByText('data.csv').length).toBeGreaterThanOrEqual(1);
  });
});

describe('CodeBlock (TC-5-RENDER-005)', () => {
  it('renders code with language label', () => {
    const msg = makeMessage({
      body: 'fn main() {}',
      format: 'text/x-code;lang=rust',
      schema: {
        language: { type: 'string', value: 'rust' },
      },
    });
    render(<CodeBlock message={msg} />);
    expect(screen.getByText('rust')).toBeInTheDocument();
    expect(screen.getByText('fn main() {}')).toBeInTheDocument();
  });

  it('renders copy button', () => {
    const msg = makeMessage({ body: 'console.log("hi")' });
    render(<CodeBlock message={msg} />);
    expect(screen.getByText('Copy')).toBeInTheDocument();
  });

  it('extracts language from format string', () => {
    const msg = makeMessage({ body: 'x = 1', format: 'text/x-python' });
    render(<CodeBlock message={msg} />);
    expect(screen.getByText('python')).toBeInTheDocument();
  });
});

describe('DocumentLink (TC-5-RENDER-006)', () => {
  it('renders document title and open button', () => {
    const msg = makeMessage({
      schema: {
        title: { type: 'string', value: 'Project Spec' },
        summary: { type: 'string', value: 'Architecture overview for v2' },
      },
    });
    render(<DocumentLink message={msg} />);
    expect(screen.getByText('Project Spec')).toBeInTheDocument();
    expect(screen.getByText('Architecture overview for v2')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('falls back to message body for title', () => {
    const msg = makeMessage({ body: 'Untitled Doc' });
    render(<DocumentLink message={msg} />);
    expect(screen.getByText('Untitled Doc')).toBeInTheDocument();
  });
});

describe('Composite (TC-5-RENDER-007)', () => {
  it('renders sub-renderers vertically', () => {
    const msg = makeMessage({ body: 'Composite content' });
    const subRenderers = [
      { type: 'text' as const },
      { type: 'text' as const },
    ];
    const renderContent = (resolved: ResolvedRenderer) => (
      <div data-testid={`sub-${resolved.type}`}>{resolved.message.body}</div>
    );

    render(
      <Composite message={msg} subRenderers={subRenderers} renderContent={renderContent} />,
    );
    const subs = screen.getAllByTestId('sub-text');
    expect(subs).toHaveLength(2);
  });

  it('renders message body when no sub-renderers', () => {
    const msg = makeMessage({ body: 'Fallback body' });
    render(
      <Composite message={msg} subRenderers={[]} renderContent={() => null} />,
    );
    expect(screen.getByText('Fallback body')).toBeInTheDocument();
  });
});

describe('SchemaRenderer (TC-5-RENDER-008)', () => {
  it('renders unknown datatype as key:value pairs', () => {
    const msg = makeMessage({
      datatype: 'custom_unknown',
      schema: {
        name: { type: 'string', value: 'Test Item' },
        count: { type: 'number', value: 42 },
      },
    });
    render(<SchemaRenderer message={msg} />);
    expect(screen.getByText('custom_unknown')).toBeInTheDocument();
    expect(screen.getByText('Test Item')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });
});

describe('ContentRenderer routing', () => {
  it('routes media_message type', () => {
    const msg = makeMessage({
      schema: { filename: { type: 'string', value: 'test.txt' } },
    });
    const resolved: ResolvedRenderer = {
      level: 1, type: 'media_message', config: { type: 'media_message' },
      component: null, message: msg,
    };
    render(<ContentRenderer resolved={resolved} />);
    expect(screen.getAllByText('test.txt').length).toBeGreaterThanOrEqual(1);
  });

  it('routes code_block type', () => {
    const msg = makeMessage({ body: 'let x = 1;' });
    const resolved: ResolvedRenderer = {
      level: 1, type: 'code_block', config: { type: 'code_block' },
      component: null, message: msg,
    };
    render(<ContentRenderer resolved={resolved} />);
    expect(screen.getByText('let x = 1;')).toBeInTheDocument();
  });

  it('routes document_link type', () => {
    const msg = makeMessage({ body: 'My Doc' });
    const resolved: ResolvedRenderer = {
      level: 1, type: 'document_link', config: { type: 'document_link' },
      component: null, message: msg,
    };
    render(<ContentRenderer resolved={resolved} />);
    expect(screen.getByText('My Doc')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
  });
});
