import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock the shadcn Tabs UI wrapper to avoid Radix jsdom pointer-event issues
vi.mock('@/components/ui/tabs', () => {
  const React = require('react');

  function Tabs({ value, onValueChange, className, children }: any) {
    const contextRef = React.useRef({ value, onValueChange });
    contextRef.current = { value, onValueChange };

    // Clone children with context
    return (
      <div className={className} data-testid="tabs-root">
        {React.Children.map(children, (child: any) =>
          React.isValidElement(child)
            ? React.cloneElement(child as React.ReactElement<any>, {
                __tabValue: value,
                __tabOnChange: onValueChange,
              })
            : child,
        )}
      </div>
    );
  }

  const TabsList = React.forwardRef<HTMLDivElement, any>(
    ({ className, children, __tabValue, __tabOnChange, ...props }: any, ref: any) => (
      <div ref={ref} role="tablist" className={className} {...props}>
        {React.Children.map(children, (child: any) =>
          React.isValidElement(child)
            ? React.cloneElement(child as React.ReactElement<any>, {
                __tabValue,
                __tabOnChange,
              })
            : child,
        )}
      </div>
    ),
  );

  const TabsTrigger = React.forwardRef<HTMLButtonElement, any>(
    ({ value, className, children, __tabValue, __tabOnChange, ...props }: any, ref: any) => (
      <button
        ref={ref}
        role="tab"
        className={className}
        data-state={value === __tabValue ? 'active' : 'inactive'}
        aria-selected={value === __tabValue}
        onClick={() => __tabOnChange?.(value)}
        type="button"
        {...props}
      >
        {children}
      </button>
    ),
  );

  const TabsContent = React.forwardRef<HTMLDivElement, any>(
    ({ value, className, children, __tabValue, __tabOnChange, ...props }: any, ref: any) => {
      if (value !== __tabValue) return null;
      return (
        <div ref={ref} role="tabpanel" className={className} data-state="active" {...props}>
          {children}
        </div>
      );
    },
  );

  return { Tabs, TabsList, TabsTrigger, TabsContent };
});

// Import after mock setup
import { RoomTabContainer } from '../RoomTabContainer';

describe('RoomTabContainer', () => {
  it('renders children directly when no tabs (TC-5-TAB-001)', () => {
    render(
      <RoomTabContainer roomId="room-1" tabs={[]}>
        <div>Timeline Content</div>
      </RoomTabContainer>,
    );
    expect(screen.getByText('Timeline Content')).toBeInTheDocument();
  });

  it('renders Messages tab and custom tabs (TC-5-TAB-002)', () => {
    render(
      <RoomTabContainer
        roomId="room-1"
        tabs={[
          { tab_label: 'Tasks', layout: 'kanban', as_room_tab: true },
          { tab_label: 'Files', layout: 'grid', as_room_tab: true },
        ]}
      >
        <div>Timeline Content</div>
      </RoomTabContainer>,
    );
    expect(screen.getByText('Messages')).toBeInTheDocument();
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('Files')).toBeInTheDocument();
  });

  it('switches tabs on click (TC-5-TAB-003)', () => {
    render(
      <RoomTabContainer
        roomId="room-1"
        tabs={[{ tab_label: 'Tasks', layout: 'kanban', as_room_tab: true }]}
      >
        <div>Timeline Content</div>
      </RoomTabContainer>,
    );

    const tasksTab = screen.getByRole('tab', { name: 'Tasks' });
    fireEvent.click(tasksTab);

    expect(screen.getByText('Tasks view (kanban)')).toBeInTheDocument();
  });

  it('shows Messages tab content by default', () => {
    render(
      <RoomTabContainer
        roomId="room-1"
        tabs={[{ tab_label: 'Tasks', layout: 'kanban', as_room_tab: true }]}
      >
        <div>Timeline Content</div>
      </RoomTabContainer>,
    );
    expect(screen.getByText('Timeline Content')).toBeInTheDocument();
  });
});
