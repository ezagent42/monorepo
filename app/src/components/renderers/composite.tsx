'use client';

import type { Message } from '@/types';
import type { RendererConfig } from '@/types/renderer';
import type { ResolvedRenderer } from '@/lib/pipeline/types';

// Forward declaration to avoid circular imports -- ContentRenderer will be passed as a prop
interface CompositeProps {
  message: Message;
  subRenderers: RendererConfig[];
  renderContent: (resolved: ResolvedRenderer) => React.ReactNode;
}

/**
 * Renders multiple sub-renderers vertically in order.
 */
export function Composite({ message, subRenderers, renderContent }: CompositeProps) {
  if (!subRenderers || subRenderers.length === 0) {
    return <p className="text-sm">{message.body}</p>;
  }

  return (
    <div className="space-y-2">
      {subRenderers.map((sub, i) => {
        const resolved: ResolvedRenderer = {
          level: 1,
          type: sub.type,
          config: sub,
          component: null,
          message,
        };
        return <div key={i}>{renderContent(resolved)}</div>;
      })}
    </div>
  );
}
