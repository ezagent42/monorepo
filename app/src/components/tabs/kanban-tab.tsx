'use client';

import { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Message, FlowAction } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface KanbanTabProps {
  messages: Message[];
  columns: KanbanColumn[];
  viewerRoles: string[];
  onTransition: (messageRefId: string, action: FlowAction) => void;
}

export interface KanbanColumn {
  state: string;
  label: string;
  color?: string;
}

/**
 * Kanban board tab - displays messages as cards in columns by Flow state.
 * Drag-and-drop triggers flow transitions.
 *
 * Real-time sync (TC-5-SYNC-004): The messages prop comes from the Zustand
 * message store, which is updated by WebSocket event handlers
 * (registerDefaultHandlers). When flow_state changes arrive via WS, the store
 * updates and React re-renders this board automatically — no additional
 * plumbing is required.
 */
export function KanbanTab({ messages, columns, viewerRoles, onTransition }: KanbanTabProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  // Group messages by flow_state
  const messagesByState = useMemo(() => {
    const map: Record<string, Message[]> = {};
    for (const col of columns) {
      map[col.state] = [];
    }
    for (const msg of messages) {
      const state = msg.flow_state ?? 'unknown';
      if (map[state]) {
        map[state].push(msg);
      }
    }
    return map;
  }, [messages, columns]);

  const activeMessage = activeId
    ? messages.find((m) => m.ref_id === activeId)
    : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const messageId = String(active.id);
    const targetState = String(over.id);
    const msg = messages.find((m) => m.ref_id === messageId);
    if (!msg || msg.flow_state === targetState) return;

    // Find matching flow action for this transition
    const transition = `${msg.flow_state} -> ${targetState}`;
    const action = msg.flow_actions?.find((a) => a.transition === transition);
    if (!action) return;

    // Role check
    const hasRole = action.visible_to === '*' ||
      viewerRoles.some((r) => r === action.visible_to || `role:${r}` === action.visible_to);
    if (!hasRole) return;

    onTransition(messageId, action);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 p-4 overflow-x-auto h-full" data-testid="kanban-board">
        {columns.map((col) => (
          <KanbanColumnView
            key={col.state}
            column={col}
            messages={messagesByState[col.state] ?? []}
          />
        ))}
      </div>
      <DragOverlay>
        {activeMessage && <KanbanCard message={activeMessage} isDragOverlay />}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumnView({ column, messages }: { column: KanbanColumn; messages: Message[] }) {
  return (
    <div className="flex-shrink-0 w-72" data-testid={`kanban-column-${column.state}`}>
      <div className="flex items-center gap-2 mb-3 px-1">
        <h3 className="font-semibold text-sm">{column.label}</h3>
        <Badge variant="secondary" className="text-xs">{messages.length}</Badge>
      </div>
      <SortableContext
        id={column.state}
        items={messages.map((m) => m.ref_id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2 min-h-[100px]" data-testid={`kanban-drop-${column.state}`}>
          {messages.map((msg) => (
            <SortableCard key={msg.ref_id} message={msg} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableCard({ message }: { message: Message }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: message.ref_id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <KanbanCard message={message} />
    </div>
  );
}

function KanbanCard({ message, isDragOverlay }: { message: Message; isDragOverlay?: boolean }) {
  const title = (message.schema?.title?.value as string) ?? message.body;
  const status = message.flow_state ?? '';

  return (
    <Card className={`cursor-grab ${isDragOverlay ? 'shadow-lg rotate-2' : ''}`} data-testid={`kanban-card-${message.ref_id}`}>
      <CardHeader className="p-3 pb-1">
        <CardTitle className="text-sm font-medium truncate">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{message.author}</span>
          {status && <Badge variant="outline" className="text-xs">{status}</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}
