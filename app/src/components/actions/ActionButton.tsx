'use client';

import { useState } from 'react';
import type { FlowAction } from '@/types';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from './ConfirmDialog';

interface ActionButtonProps {
  action: FlowAction;
  onAction: (action: FlowAction) => void;
}

const styleVariantMap: Record<string, 'default' | 'secondary' | 'destructive'> = {
  primary: 'default',
  secondary: 'secondary',
  danger: 'destructive',
};

export function ActionButton({ action, onAction }: ActionButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleClick = () => {
    if (action.confirm) {
      setConfirmOpen(true);
    } else {
      onAction(action);
    }
  };

  const handleConfirm = () => {
    setConfirmOpen(false);
    onAction(action);
  };

  const variant = styleVariantMap[action.style] ?? 'default';

  return (
    <>
      <Button
        variant={variant}
        size="sm"
        onClick={handleClick}
        data-testid={`action-btn-${action.label.toLowerCase().replace(/\s+/g, '-')}`}
      >
        {action.icon && <span className="mr-1">{action.icon}</span>}
        {action.label}
      </Button>
      {action.confirm && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          message={action.confirm_message ?? `Are you sure you want to "${action.label}"?`}
          onConfirm={handleConfirm}
        />
      )}
    </>
  );
}
