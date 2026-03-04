import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WidgetHost } from '../WidgetHost';
import type { WidgetProps } from '@/types/renderer';

// Mock the messages API
vi.mock('@/lib/api/messages', () => ({
  sendMessage: vi.fn().mockResolvedValue({ ref_id: 'new-ref' }),
  addReaction: vi.fn().mockResolvedValue({ ok: true }),
  listMessages: vi.fn().mockResolvedValue([]),
}));

import * as messagesApi from '@/lib/api/messages';

const mockContext: WidgetProps['context'] = {
  viewer: { entityId: '@alice:relay', displayName: 'Alice' },
  viewer_roles: ['ta:worker'],
  room_config: {},
};

const mockData: WidgetProps['data'] = {
  ref: { ref_id: 'ref-1', body: 'Test' },
  annotations: { pinned: true },
};

describe('WidgetHost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // TC-5-WIDGET-002: Renders widget with props
  it('renders widget component with data and context (TC-5-WIDGET-002)', () => {
    const TestWidget = ({ data, context }: WidgetProps) => (
      <div>
        <span data-testid="viewer">{context.viewer.displayName}</span>
        <span data-testid="data">{JSON.stringify(data.ref)}</span>
      </div>
    );
    render(
      <WidgetHost component={TestWidget} data={mockData} context={mockContext} roomId="room-1" />,
    );
    expect(screen.getByTestId('viewer')).toHaveTextContent('Alice');
    expect(screen.getByTestId('data')).toHaveTextContent('ref-1');
  });

  // TC-5-WIDGET-004: sendMessage action
  it('sendMessage action calls API (TC-5-WIDGET-004)', async () => {
    const TestWidget = ({ actions }: WidgetProps) => (
      <button onClick={() => actions.sendMessage({ body: 'From widget' })}>Send</button>
    );
    render(
      <WidgetHost component={TestWidget} data={mockData} context={mockContext} roomId="room-1" />,
    );
    fireEvent.click(screen.getByText('Send'));
    expect(messagesApi.sendMessage).toHaveBeenCalledWith('room-1', expect.objectContaining({ body: 'From widget' }));
  });

  // TC-5-WIDGET-005: writeAnnotation
  it('writeAnnotation calls API (TC-5-WIDGET-005)', async () => {
    const TestWidget = ({ actions }: WidgetProps) => (
      <button onClick={() => actions.writeAnnotation({ refId: 'ref-1', key: 'pin', value: '\u{1F4CC}' })}>Pin</button>
    );
    render(
      <WidgetHost component={TestWidget} data={mockData} context={mockContext} roomId="room-1" />,
    );
    fireEvent.click(screen.getByText('Pin'));
    expect(messagesApi.addReaction).toHaveBeenCalledWith('room-1', 'ref-1', '\u{1F4CC}');
  });

  // TC-5-WIDGET-006: advanceFlow
  it('advanceFlow calls API (TC-5-WIDGET-006)', async () => {
    const TestWidget = ({ actions }: WidgetProps) => (
      <button onClick={() => actions.advanceFlow({ refId: 'ref-1', transition: 'open -> claimed' })}>Advance</button>
    );
    render(
      <WidgetHost component={TestWidget} data={mockData} context={mockContext} roomId="room-1" />,
    );
    fireEvent.click(screen.getByText('Advance'));
    expect(messagesApi.addReaction).toHaveBeenCalledWith('room-1', 'ref-1', 'flow:open -> claimed');
  });

  // TC-5-WIDGET-007: navigate
  it('navigate dispatches custom event (TC-5-WIDGET-007)', () => {
    const handler = vi.fn();
    window.addEventListener('ezagent:navigate', handler);

    const TestWidget = ({ actions }: WidgetProps) => (
      <button onClick={() => actions.navigate({ uri: 'ezagent://relay/r/room-1' })}>Nav</button>
    );
    render(
      <WidgetHost component={TestWidget} data={mockData} context={mockContext} roomId="room-1" />,
    );
    fireEvent.click(screen.getByText('Nav'));
    expect(handler).toHaveBeenCalled();

    window.removeEventListener('ezagent:navigate', handler);
  });

  // TC-5-WIDGET-008: Widget receives subscribed data
  it('passes subscribed data to widget (TC-5-WIDGET-008)', () => {
    const TestWidget = ({ data }: WidgetProps) => (
      <div data-testid="annotations">{JSON.stringify(data.annotations)}</div>
    );
    render(
      <WidgetHost component={TestWidget} data={mockData} context={mockContext} roomId="room-1" />,
    );
    expect(screen.getByTestId('annotations')).toHaveTextContent('pinned');
  });
});
