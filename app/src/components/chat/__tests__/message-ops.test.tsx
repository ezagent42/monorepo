import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditMessageForm } from '../EditMessageForm';
import { ReplyPreview } from '../ReplyPreview';

describe('EditMessageForm', () => {
  it('shows initial body and save/cancel buttons', () => {
    render(<EditMessageForm initialBody="hello" onSave={() => {}} onCancel={() => {}} />);
    expect(screen.getByDisplayValue('hello')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls onSave with updated text (TC-5-OPS-043)', () => {
    const onSave = vi.fn();
    render(<EditMessageForm initialBody="hello" onSave={onSave} onCancel={() => {}} />);
    fireEvent.change(screen.getByDisplayValue('hello'), { target: { value: 'updated' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith('updated');
  });

  it('calls onCancel', () => {
    const onCancel = vi.fn();
    render(<EditMessageForm initialBody="hello" onSave={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe('ReplyPreview', () => {
  const msg = {
    ref_id: 'm1',
    room_id: 'r1',
    author: '@alice',
    timestamp: '2024-01-01T00:00:00Z',
    datatype: 'message',
    body: 'Original message',
    annotations: {},
    ext: {},
  };

  it('shows author and message body', () => {
    render(<ReplyPreview message={msg as any} onClose={() => {}} />);
    expect(screen.getByText('@alice')).toBeInTheDocument();
    expect(screen.getByText('Original message')).toBeInTheDocument();
  });

  it('calls onClose when X is clicked', () => {
    const onClose = vi.fn();
    render(<ReplyPreview message={msg as any} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Cancel reply'));
    expect(onClose).toHaveBeenCalled();
  });
});
