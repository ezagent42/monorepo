'use client';

import type { FlowAction } from '@/types';
import { ActionButton } from './ActionButton';

interface ActionLayerProps {
  actions: FlowAction[];
  viewerRoles: string[];
  onAction: (action: FlowAction) => void;
}

/**
 * Renders action buttons filtered by the viewer's roles.
 * Actions are displayed in their original declaration order.
 */
export function ActionLayer({ actions, viewerRoles, onAction }: ActionLayerProps) {
  const visible = actions.filter((action) => isRoleMatch(action.visible_to, viewerRoles));

  if (visible.length === 0) return null;

  return (
    <div className="flex gap-2 mt-2" data-testid="action-layer">
      {visible.map((action) => (
        <ActionButton key={action.transition} action={action} onAction={onAction} />
      ))}
    </div>
  );
}

/**
 * Check if the viewer has a matching role.
 * visible_to format: "role:ta:worker" or "*" for any role
 */
function isRoleMatch(visibleTo: string, viewerRoles: string[]): boolean {
  if (visibleTo === '*') return true;
  return viewerRoles.some((role) => role === visibleTo || `role:${role}` === visibleTo);
}
