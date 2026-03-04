import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GalleryTab } from '../gallery-tab';
import { TableTab } from '../table-tab';
import type { Message } from '@/types';

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    ref_id: 'ref-1',
    room_id: 'room-1',
    author: '@alice:relay',
    timestamp: '2026-03-04T10:00:00Z',
    datatype: 'message',
    body: 'Hello',
    annotations: {},
    ext: {},
    ...overrides,
  };
}

describe('GalleryTab (TC-5-TAB-007)', () => {
  it('renders media thumbnails in grid', () => {
    const messages = [
      makeMessage({
        ref_id: 'img-1',
        schema: {
          mime_type: { type: 'string', value: 'image/png' },
          url: { type: 'string', value: 'https://example.com/a.png' },
          filename: { type: 'string', value: 'a.png' },
        },
      }),
      makeMessage({
        ref_id: 'img-2',
        schema: {
          mime_type: { type: 'string', value: 'image/jpeg' },
          url: { type: 'string', value: 'https://example.com/b.jpg' },
          filename: { type: 'string', value: 'b.jpg' },
        },
      }),
    ];
    render(<GalleryTab messages={messages} />);
    expect(screen.getByTestId('gallery-grid')).toBeInTheDocument();
    expect(screen.getByTestId('gallery-item-img-1')).toBeInTheDocument();
    expect(screen.getByTestId('gallery-item-img-2')).toBeInTheDocument();
  });

  it('shows empty state when no media', () => {
    render(<GalleryTab messages={[makeMessage()]} />);
    expect(screen.getByText('No media yet')).toBeInTheDocument();
  });

  it('filters non-media messages', () => {
    const messages = [
      makeMessage({ ref_id: 'text-1' }),  // no media
      makeMessage({
        ref_id: 'img-1',
        schema: { mime_type: { type: 'string', value: 'image/png' }, url: { type: 'string', value: 'x' } },
      }),
    ];
    render(<GalleryTab messages={messages} />);
    expect(screen.getByTestId('gallery-item-img-1')).toBeInTheDocument();
    expect(screen.queryByTestId('gallery-item-text-1')).not.toBeInTheDocument();
  });
});

describe('TableTab (TC-5-TAB-008, TC-5-TAB-009)', () => {
  const messages = [
    makeMessage({
      ref_id: 't1',
      author: '@alice:relay',
      schema: {
        title: { type: 'string', value: 'Fix bug' },
        priority: { type: 'number', value: 1 },
      },
    }),
    makeMessage({
      ref_id: 't2',
      author: '@bob:relay',
      schema: {
        title: { type: 'string', value: 'Add feature' },
        priority: { type: 'number', value: 3 },
      },
    }),
    makeMessage({
      ref_id: 't3',
      author: '@carol:relay',
      schema: {
        title: { type: 'string', value: 'Write docs' },
        priority: { type: 'number', value: 2 },
      },
    }),
  ];

  it('renders table with columns from schema (TC-5-TAB-008)', () => {
    render(<TableTab messages={messages} />);
    expect(screen.getByTestId('table-header-title')).toBeInTheDocument();
    expect(screen.getByTestId('table-header-priority')).toBeInTheDocument();
    expect(screen.getByText('Fix bug')).toBeInTheDocument();
    expect(screen.getByText('Add feature')).toBeInTheDocument();
  });

  it('sorts by column on click', () => {
    render(<TableTab messages={messages} />);
    const titleHeader = screen.getByTestId('table-header-title');
    fireEvent.click(titleHeader);
    // After sort by title ascending, first row should be "Add feature"
    const rows = screen.getAllByTestId(/^table-row-/);
    expect(rows[0]).toHaveAttribute('data-testid', 'table-row-t2'); // "Add feature"
  });

  it('filters by text input (TC-5-TAB-009)', () => {
    render(<TableTab messages={messages} />);
    const filterInput = screen.getByTestId('table-filter');
    fireEvent.change(filterInput, { target: { value: 'bug' } });
    expect(screen.getByText('Fix bug')).toBeInTheDocument();
    expect(screen.queryByText('Add feature')).not.toBeInTheDocument();
  });

  it('shows all rows when filter cleared', () => {
    render(<TableTab messages={messages} />);
    const filterInput = screen.getByTestId('table-filter');
    fireEvent.change(filterInput, { target: { value: 'bug' } });
    fireEvent.change(filterInput, { target: { value: '' } });
    expect(screen.getByText('Fix bug')).toBeInTheDocument();
    expect(screen.getByText('Add feature')).toBeInTheDocument();
  });
});
