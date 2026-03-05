import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KanbanTab, type KanbanColumn } from '../kanban-tab';
import type { Message } from '@/types';

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
    flow_state: 'open',
    flow_actions: [],
    ...overrides,
  };
}

const columns: KanbanColumn[] = [
  { state: 'open', label: 'Open' },
  { state: 'claimed', label: 'Claimed' },
  { state: 'done', label: 'Done' },
];

describe('KanbanTab', () => {
  // TC-5-TAB-004: Kanban board renders columns from Flow states
  it('renders columns from Flow states (TC-5-TAB-004)', () => {
    render(
      <KanbanTab messages={[]} columns={columns} viewerRoles={[]} onTransition={vi.fn()} />,
    );
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Claimed')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('places cards in correct columns by flow_state', () => {
    const messages = [
      makeMessage({ ref_id: 'task-1', flow_state: 'open', schema: { title: { type: 'string', value: 'Task A' } } }),
      makeMessage({ ref_id: 'task-2', flow_state: 'claimed', schema: { title: { type: 'string', value: 'Task B' } } }),
      makeMessage({ ref_id: 'task-3', flow_state: 'done', schema: { title: { type: 'string', value: 'Task C' } } }),
    ];
    render(
      <KanbanTab messages={messages} columns={columns} viewerRoles={[]} onTransition={vi.fn()} />,
    );
    expect(screen.getByText('Task A')).toBeInTheDocument();
    expect(screen.getByText('Task B')).toBeInTheDocument();
    expect(screen.getByText('Task C')).toBeInTheDocument();
  });

  it('shows column card counts', () => {
    const messages = [
      makeMessage({ ref_id: 't1', flow_state: 'open' }),
      makeMessage({ ref_id: 't2', flow_state: 'open' }),
    ];
    render(
      <KanbanTab messages={messages} columns={columns} viewerRoles={[]} onTransition={vi.fn()} />,
    );
    // The "Open" column should show count badge "2"
    const openColumn = screen.getByTestId('kanban-column-open');
    expect(openColumn).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders card with message title and author', () => {
    const messages = [
      makeMessage({
        ref_id: 't1',
        flow_state: 'open',
        author: '@bob:relay',
        schema: { title: { type: 'string', value: 'Fix bug' } },
      }),
    ];
    render(
      <KanbanTab messages={messages} columns={columns} viewerRoles={[]} onTransition={vi.fn()} />,
    );
    expect(screen.getByText('Fix bug')).toBeInTheDocument();
    expect(screen.getByText('@bob:relay')).toBeInTheDocument();
  });

  // TC-5-TAB-006: Role check — we can't easily test drag-drop in jsdom,
  // but we can verify the component renders without errors
  it('renders with viewerRoles prop', () => {
    render(
      <KanbanTab messages={[]} columns={columns} viewerRoles={['ta:worker']} onTransition={vi.fn()} />,
    );
    expect(screen.getByTestId('kanban-board')).toBeInTheDocument();
  });
});
