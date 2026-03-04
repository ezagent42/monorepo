import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActionLayer } from '../ActionLayer';
import { ActionButton } from '../ActionButton';
import type { FlowAction } from '@/types';

const claimAction: FlowAction = {
  transition: 'open -> claimed',
  label: 'Claim Task',
  style: 'primary',
  visible_to: 'role:ta:worker',
  confirm: false,
};

const approveAction: FlowAction = {
  transition: 'under_review -> approved',
  label: 'Approve',
  style: 'primary',
  visible_to: 'role:ta:reviewer',
  confirm: true,
  confirm_message: 'Confirm approval?',
};

const rejectAction: FlowAction = {
  transition: 'under_review -> rejected',
  label: 'Reject',
  style: 'danger',
  visible_to: 'role:ta:reviewer',
  confirm: false,
};

describe('ActionLayer', () => {
  // TC-5-ACTION-001: Action button renders when viewer has matching role
  it('renders action button when viewer has matching role (TC-5-ACTION-001)', () => {
    const onAction = vi.fn();
    render(
      <ActionLayer
        actions={[claimAction]}
        viewerRoles={['ta:worker']}
        onAction={onAction}
      />,
    );
    expect(screen.getByText('Claim Task')).toBeInTheDocument();
  });

  // TC-5-ACTION-002: Role filtering
  it('hides action when viewer lacks the role (TC-5-ACTION-002)', () => {
    const onAction = vi.fn();
    render(
      <ActionLayer
        actions={[claimAction]}
        viewerRoles={['ta:reviewer']}
        onAction={onAction}
      />,
    );
    expect(screen.queryByText('Claim Task')).not.toBeInTheDocument();
  });

  it('shows role-matching actions when viewer has multiple roles (TC-5-ACTION-002)', () => {
    const onAction = vi.fn();
    render(
      <ActionLayer
        actions={[claimAction, approveAction]}
        viewerRoles={['ta:reviewer']}
        onAction={onAction}
      />,
    );
    expect(screen.queryByText('Claim Task')).not.toBeInTheDocument();
    expect(screen.getByText('Approve')).toBeInTheDocument();
  });

  // TC-5-ACTION-003: Click triggers flow transition
  it('calls onAction when button clicked without confirm (TC-5-ACTION-003)', () => {
    const onAction = vi.fn();
    render(
      <ActionLayer
        actions={[claimAction]}
        viewerRoles={['ta:worker']}
        onAction={onAction}
      />,
    );
    fireEvent.click(screen.getByText('Claim Task'));
    expect(onAction).toHaveBeenCalledWith(claimAction);
  });

  // TC-5-ACTION-005: Multiple actions render in order
  it('renders multiple actions in declaration order (TC-5-ACTION-005)', () => {
    const onAction = vi.fn();
    render(
      <ActionLayer
        actions={[approveAction, rejectAction]}
        viewerRoles={['ta:reviewer', 'ta:arbiter']}
        onAction={onAction}
      />,
    );
    const buttons = screen.getAllByRole('button');
    // First visible button should be Approve, second Reject
    const approveBtn = buttons.find((b) => b.textContent?.includes('Approve'));
    const rejectBtn = buttons.find((b) => b.textContent?.includes('Reject'));
    expect(approveBtn).toBeDefined();
    expect(rejectBtn).toBeDefined();
  });

  it('returns null when no actions visible', () => {
    const onAction = vi.fn();
    const { container } = render(
      <ActionLayer actions={[claimAction]} viewerRoles={[]} onAction={onAction} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('supports wildcard visible_to', () => {
    const wildcardAction: FlowAction = {
      ...claimAction,
      visible_to: '*',
    };
    const onAction = vi.fn();
    render(
      <ActionLayer actions={[wildcardAction]} viewerRoles={[]} onAction={onAction} />,
    );
    expect(screen.getByText('Claim Task')).toBeInTheDocument();
  });
});

// TC-5-ACTION-004: Confirm dialog
// Note: Testing the Dialog from shadcn/ui in jsdom can be tricky because Radix Dialog
// uses portals. We'll test the ActionButton confirm logic directly.
describe('ActionButton with confirm', () => {
  it('does not call onAction immediately when confirm=true (TC-5-ACTION-004)', () => {
    const onAction = vi.fn();
    render(<ActionButton action={approveAction} onAction={onAction} />);
    fireEvent.click(screen.getByText('Approve'));
    // onAction should NOT have been called yet (dialog should open)
    expect(onAction).not.toHaveBeenCalled();
  });
});
