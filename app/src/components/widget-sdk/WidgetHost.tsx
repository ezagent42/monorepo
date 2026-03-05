'use client';

import { useMemo, type ComponentType } from 'react';
import type { WidgetProps } from '@/types/renderer';
import * as messagesApi from '@/lib/api/messages';

interface WidgetHostProps {
  component: ComponentType<WidgetProps>;
  data: WidgetProps['data'];
  context: WidgetProps['context'];
  roomId: string;
}

/**
 * WidgetHost sandbox -- wraps a custom widget component and provides
 * a controlled actions API. Scopes data access to subscriptions.
 */
export function WidgetHost({ component: Widget, data, context, roomId }: WidgetHostProps) {
  const actions = useMemo<WidgetProps['actions']>(() => ({
    sendMessage: async (params: unknown) => {
      const p = params as { body: string; datatype?: string; format?: string };
      await messagesApi.sendMessage(roomId, { body: p.body, datatype: p.datatype, format: p.format });
    },
    writeAnnotation: async (params: unknown) => {
      const p = params as { refId: string; key: string; value: unknown };
      // Annotations written via the messages API
      await messagesApi.addReaction(roomId, p.refId, String(p.value));
    },
    advanceFlow: async (params: unknown) => {
      const p = params as { refId: string; transition: string };
      // Flow advancement writes an annotation triggering the transition
      await messagesApi.addReaction(roomId, p.refId, `flow:${p.transition}`);
    },
    navigate: (params: unknown) => {
      const p = params as { uri: string };
      // Navigation handled by the app router -- dispatch custom event
      window.dispatchEvent(new CustomEvent('ezagent:navigate', { detail: p }));
    },
  }), [roomId]);

  return (
    <div className="widget-host" data-testid="widget-host">
      <Widget data={data} context={context} actions={actions} />
    </div>
  );
}
