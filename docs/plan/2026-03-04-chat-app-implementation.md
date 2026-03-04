# Phase 5 Chat App Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the ezagent Chat App — an Electron + Next.js desktop client with 4-layer Render Pipeline, GitHub OAuth, and desktop packaging.

**Architecture:** Electron main process manages window/tray/daemon. Next.js static export provides React UI. Zustand stores hold state. REST + WebSocket connect to FastAPI backend at localhost:8847. GitHub OAuth for authentication.

**Tech Stack:** Next.js 15, Electron 33, React 19, TypeScript, Tailwind CSS, shadcn/ui, Zustand, Vitest, React Testing Library, electron-builder

**Design Doc:** `docs/plan/2026-03-04-chat-app-design.md`
**Test Cases:** `docs/plan/phase-5-chat-app.md` (77 test cases)

---

## Milestone 1: Project Scaffold (Tasks 1-3)

### Task 1: Initialize Next.js + Electron project

**Files:**
- Create: `app/package.json`
- Create: `app/next.config.js`
- Create: `app/tsconfig.json`
- Create: `app/tailwind.config.ts`
- Create: `app/postcss.config.js`
- Create: `app/electron/main.ts`
- Create: `app/electron/preload.ts`
- Create: `app/electron/tsconfig.json`
- Create: `app/src/app/layout.tsx`
- Create: `app/src/app/page.tsx`
- Create: `app/src/app/globals.css`

**Step 1: Create package.json with all dependencies**

```json
{
  "name": "ezagent-app",
  "version": "0.1.0",
  "private": true,
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "next dev",
    "dev:electron": "concurrently \"next dev\" \"wait-on http://localhost:3000 && electron .\"",
    "build": "next build",
    "build:electron": "next build && tsc -p electron/tsconfig.json",
    "package": "pnpm build:electron && electron-builder",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^15.2.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zustand": "^5.0.0",
    "react-markdown": "^9.0.0",
    "remark-gfm": "^4.0.0",
    "shiki": "^1.24.0",
    "@dnd-kit/core": "^6.3.0",
    "@dnd-kit/sortable": "^9.0.0",
    "@emoji-mart/react": "^1.1.0",
    "@emoji-mart/data": "^1.2.0",
    "@tanstack/react-virtual": "^3.11.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.6.0",
    "class-variance-authority": "^0.7.0",
    "lucide-react": "^0.468.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.7.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "electron": "^33.0.0",
    "electron-builder": "^25.0.0",
    "concurrently": "^9.1.0",
    "wait-on": "^8.0.0",
    "vitest": "^2.1.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "^15.2.0"
  }
}
```

**Step 2: Create Next.js config with static export**

`app/next.config.js`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
};
module.exports = nextConfig;
```

**Step 3: Create Tailwind config**

`app/tailwind.config.ts`:
```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
      },
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)' },
    },
  },
  plugins: [],
};
export default config;
```

**Step 4: Create root layout and page**

`app/src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'ezagent', description: 'Programmable Organization OS' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
```

`app/src/app/page.tsx`:
```tsx
'use client';
import { useAuthStore } from '@/stores/auth-store';

export default function Home() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  // Redirect logic will be added in Task 13
  return <div>Loading...</div>;
}
```

**Step 5: Create Electron main process**

`app/electron/main.ts`:
```typescript
import { app, BrowserWindow } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../out/index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!mainWindow) createWindow(); });
```

`app/electron/preload.ts`:
```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  auth: {
    startGitHubOAuth: () => ipcRenderer.invoke('auth:github-oauth'),
    getStoredCredentials: () => ipcRenderer.invoke('auth:get-credentials'),
    clearCredentials: () => ipcRenderer.invoke('auth:clear-credentials'),
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:version'),
    onDeepLink: (callback: (url: string) => void) => {
      ipcRenderer.on('deep-link', (_event, url) => callback(url));
    },
  },
});
```

`app/electron/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "../dist-electron",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "moduleResolution": "node"
  },
  "include": ["./**/*.ts"]
}
```

**Step 6: Create vitest config**

`app/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

`app/src/test/setup.ts`:
```typescript
import '@testing-library/jest-dom/vitest';
```

**Step 7: Install dependencies and verify**

Run: `cd app && pnpm install`
Expected: Install completes with no errors.

Run: `cd app && pnpm build`
Expected: Next.js static export succeeds, `out/` directory created.

**Step 8: Commit**

```bash
git add app/
git commit -m "feat(app): scaffold Next.js + Electron + Tailwind project"
```

---

### Task 2: Add shadcn/ui base components

**Files:**
- Create: `app/src/lib/utils.ts`
- Create: `app/src/components/ui/button.tsx`
- Create: `app/src/components/ui/input.tsx`
- Create: `app/src/components/ui/dialog.tsx`
- Create: `app/src/components/ui/tabs.tsx`
- Create: `app/src/components/ui/scroll-area.tsx`
- Create: `app/src/components/ui/avatar.tsx`
- Create: `app/src/components/ui/badge.tsx`
- Create: `app/src/components/ui/tooltip.tsx`
- Create: `app/src/components/ui/dropdown-menu.tsx`
- Create: `app/src/components/ui/context-menu.tsx`
- Create: `app/src/components/ui/separator.tsx`
- Create: `app/src/components/ui/popover.tsx`
- Create: `app/src/components/ui/card.tsx`

**Step 1: Create utility function**

`app/src/lib/utils.ts`:
```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Step 2: Install Radix UI primitives**

Run: `cd app && pnpm add @radix-ui/react-dialog @radix-ui/react-tabs @radix-ui/react-scroll-area @radix-ui/react-avatar @radix-ui/react-tooltip @radix-ui/react-dropdown-menu @radix-ui/react-context-menu @radix-ui/react-separator @radix-ui/react-popover @radix-ui/react-slot`

**Step 3: Create shadcn/ui components**

Use the shadcn/ui component source code patterns. Each component wraps a Radix primitive with Tailwind styling. Create all components listed above following the shadcn/ui v2 patterns. Exact implementations follow the official shadcn/ui source — copy-paste from https://ui.shadcn.com/docs/components/[name].

**Step 4: Commit**

```bash
git add app/src/
git commit -m "feat(app): add shadcn/ui base components"
```

---

### Task 3: TypeScript types for ezagent protocol

**Files:**
- Create: `app/src/types/index.ts`
- Create: `app/src/types/message.ts`
- Create: `app/src/types/room.ts`
- Create: `app/src/types/identity.ts`
- Create: `app/src/types/renderer.ts`
- Create: `app/src/types/events.ts`

**Step 1: Write the failing test**

`app/src/types/__tests__/types.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import type { Message, Room, Identity, RendererConfig, WsEvent } from '@/types';

describe('Protocol types', () => {
  it('Message type has required fields', () => {
    const msg: Message = {
      ref_id: 'ulid:01HZ...',
      room_id: 'uuid:019...',
      author: '@alice:relay.ezagent.dev',
      timestamp: '2026-03-04T10:00:00Z',
      datatype: 'message',
      body: 'Hello',
      format: 'text/plain',
      annotations: {},
      ext: {},
    };
    expect(msg.ref_id).toBeDefined();
    expect(msg.author).toContain('@');
  });

  it('Room type has required fields', () => {
    const room: Room = {
      room_id: 'uuid:019...',
      name: 'Test Room',
      members: ['@alice:relay.ezagent.dev'],
      config: {},
      enabled_extensions: [],
    };
    expect(room.room_id).toBeDefined();
  });

  it('RendererConfig resolves type', () => {
    const config: RendererConfig = {
      type: 'structured_card',
      field_mapping: { header: 'title', metadata: [], badge: { field: 'status', source: 'flow:ta:task_lifecycle' } },
    };
    expect(config.type).toBe('structured_card');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd app && pnpm test -- src/types/__tests__/types.test.ts`
Expected: FAIL — types not defined yet.

**Step 3: Write type definitions**

`app/src/types/identity.ts`:
```typescript
export interface Identity {
  entity_id: string;        // "@alice:relay.ezagent.dev"
  display_name: string;
  avatar_url?: string;
  pubkey?: string;
}

export interface AuthSession {
  entity_id: string;
  display_name: string;
  avatar_url?: string;
  github_id?: number;
  authenticated: boolean;
}
```

`app/src/types/room.ts`:
```typescript
export interface Room {
  room_id: string;
  name: string;
  members: string[];
  config: Record<string, unknown>;
  enabled_extensions: string[];
  unread_count?: number;
}

export interface RoomMember {
  entity_id: string;
  display_name: string;
  avatar_url?: string;
  is_online: boolean;
  roles: string[];
}
```

`app/src/types/message.ts`:
```typescript
export interface Message {
  ref_id: string;
  room_id: string;
  author: string;
  timestamp: string;
  datatype: string;
  body: string;
  format?: string;
  schema?: Record<string, SchemaField>;
  annotations: Record<string, unknown>;
  ext: Record<string, unknown>;
  renderer?: RendererConfig;
  flow_state?: string;
  flow_actions?: FlowAction[];
}

export interface SchemaField {
  type: 'string' | 'number' | 'boolean' | 'datetime' | 'array' | 'object';
  value: unknown;
}

export interface FlowAction {
  transition: string;         // "open → claimed"
  label: string;
  icon?: string;
  style: 'primary' | 'secondary' | 'danger';
  visible_to: string;        // "role:ta:worker"
  confirm: boolean;
  confirm_message?: string;
}

// Re-export from renderer.ts
export type { RendererConfig } from './renderer';
```

`app/src/types/renderer.ts`:
```typescript
export type RendererType =
  | 'text'
  | 'structured_card'
  | 'media_message'
  | 'code_block'
  | 'document_link'
  | 'embed'
  | 'composite';

export interface RendererConfig {
  type: RendererType | string;
  field_mapping?: FieldMapping;
  sub_renderers?: RendererConfig[];
}

export interface FieldMapping {
  header?: string;
  body?: string;
  metadata?: MetadataField[];
  badge?: BadgeConfig;
  thumbnail?: string;
}

export interface MetadataField {
  field: string;
  format?: string;
  icon?: string;
}

export interface BadgeConfig {
  field: string;
  source?: string;         // "flow:ta:task_lifecycle"
}

export interface DecoratorConfig {
  position: 'above' | 'below' | 'inline' | 'badge' | 'overlay';
  type: string;
  priority: number;
  interaction?: Record<string, string>;
}

export interface RoomTabConfig {
  tab_label: string;
  tab_icon?: string;
  layout: 'message_list' | 'kanban' | 'grid' | 'table' | 'calendar' | 'document' | 'split_pane' | 'graph';
  layout_config?: Record<string, unknown>;
  as_room_tab: boolean;
}

export interface FlowBadgeStyle {
  color: string;
  label: string;
}

export interface FlowRendererConfig {
  actions: FlowActionDef[];
  badge: Record<string, FlowBadgeStyle>;
}

export interface FlowActionDef {
  transition: string;
  label: string;
  icon?: string;
  style: 'primary' | 'secondary' | 'danger';
  visible_to: string;
  confirm: boolean;
  confirm_message?: string;
}

export interface WidgetRegistration {
  id: string;
  type: 'inline_widget' | 'room_view' | 'panel_widget';
  subscriptions: {
    datatypes?: string[];
    annotations?: string[];
    indexes?: string[];
  };
  component: React.ComponentType<WidgetProps>;
}

export interface WidgetProps {
  data: {
    ref?: unknown;
    room?: unknown;
    query_results?: unknown;
    annotations?: Record<string, unknown>;
  };
  context: {
    viewer: { entityId: string; displayName: string };
    viewer_roles: string[];
    room_config: Record<string, unknown>;
  };
  actions: {
    sendMessage: (params: unknown) => Promise<void>;
    writeAnnotation: (params: unknown) => Promise<void>;
    advanceFlow: (params: unknown) => Promise<void>;
    navigate: (params: unknown) => void;
  };
}
```

`app/src/types/events.ts`:
```typescript
export type WsEventType =
  | 'message.new'
  | 'message.deleted'
  | 'message.edited'
  | 'room.created'
  | 'room.member_joined'
  | 'room.member_left'
  | 'room.config_updated'
  | 'reaction.added'
  | 'reaction.removed'
  | 'presence.joined'
  | 'presence.left'
  | 'typing.start'
  | 'typing.stop'
  | 'command.invoked'
  | 'command.result';

export interface WsEvent {
  type: WsEventType;
  room_id?: string;
  ref_id?: string;
  author?: string;
  timestamp: string;
  data: Record<string, unknown>;
}
```

`app/src/types/index.ts`:
```typescript
export type { Identity, AuthSession } from './identity';
export type { Room, RoomMember } from './room';
export type { Message, SchemaField, FlowAction } from './message';
export type {
  RendererConfig, RendererType, FieldMapping, MetadataField, BadgeConfig,
  DecoratorConfig, RoomTabConfig, FlowBadgeStyle, FlowRendererConfig, FlowActionDef,
  WidgetRegistration, WidgetProps,
} from './renderer';
export type { WsEvent, WsEventType } from './events';
```

**Step 4: Run test to verify it passes**

Run: `cd app && pnpm test -- src/types/__tests__/types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/src/types/
git commit -m "feat(app): add TypeScript types for ezagent protocol"
```

---

## Milestone 2: API & Store Layer (Tasks 4-7)

### Task 4: REST API client

**Files:**
- Create: `app/src/lib/api/client.ts`
- Create: `app/src/lib/api/auth.ts`
- Create: `app/src/lib/api/rooms.ts`
- Create: `app/src/lib/api/messages.ts`
- Create: `app/src/lib/api/renderers.ts`
- Test: `app/src/lib/api/__tests__/client.test.ts`

**Step 1: Write the failing test**

```typescript
// app/src/lib/api/__tests__/client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '../client';

describe('ApiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('constructs with base URL', () => {
    const client = new ApiClient('http://localhost:8847');
    expect(client.baseUrl).toBe('http://localhost:8847');
  });

  it('GET request calls fetch correctly', async () => {
    const mockResponse = { rooms: [] };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 })
    );
    const client = new ApiClient('http://localhost:8847');
    const result = await client.get('/api/rooms');
    expect(result).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledWith('http://localhost:8847/api/rooms', expect.objectContaining({ method: 'GET' }));
  });

  it('POST request sends JSON body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ref_id: 'test' }), { status: 201 })
    );
    const client = new ApiClient('http://localhost:8847');
    await client.post('/api/rooms/123/messages', { body: 'Hello' });
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8847/api/rooms/123/messages',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ body: 'Hello' }),
      })
    );
  });

  it('maps error responses to ApiError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'ROOM_NOT_FOUND', message: 'Not found' } }), { status: 404 })
    );
    const client = new ApiClient('http://localhost:8847');
    await expect(client.get('/api/rooms/bad')).rejects.toThrow('ROOM_NOT_FOUND');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd app && pnpm test -- src/lib/api/__tests__/client.test.ts`
Expected: FAIL

**Step 3: Implement ApiClient**

`app/src/lib/api/client.ts`:
```typescript
export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiClient {
  constructor(public baseUrl: string) {}

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
    const json = await res.json();
    if (!res.ok) {
      const err = json.error || { code: 'UNKNOWN', message: res.statusText };
      throw new ApiError(err.code, err.message, res.status);
    }
    return json as T;
  }

  get<T>(path: string): Promise<T> { return this.request<T>(path, { method: 'GET' }); }
  post<T>(path: string, body?: unknown): Promise<T> { return this.request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }); }
  put<T>(path: string, body?: unknown): Promise<T> { return this.request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }); }
  patch<T>(path: string, body?: unknown): Promise<T> { return this.request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }); }
  delete<T>(path: string): Promise<T> { return this.request<T>(path, { method: 'DELETE' }); }
}

export const api = new ApiClient('http://localhost:8847');
```

Then create domain-specific API modules (`auth.ts`, `rooms.ts`, `messages.ts`, `renderers.ts`) that wrap `api` calls.

**Step 4: Run tests, verify pass**

Run: `cd app && pnpm test -- src/lib/api/__tests__/client.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/src/lib/api/
git commit -m "feat(app): add REST API client with typed endpoints"
```

---

### Task 5: WebSocket client

**Files:**
- Create: `app/src/lib/ws/client.ts`
- Create: `app/src/lib/ws/handlers.ts`
- Test: `app/src/lib/ws/__tests__/client.test.ts`

Implements the WebSocket connection manager with reconnect logic and event-type → store-action dispatching. The WS client connects to `ws://localhost:8847/ws`, parses `WsEvent` JSON, and calls the appropriate Zustand store action for each event type.

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { WsClient } from '../client';

describe('WsClient', () => {
  it('connects to the correct URL', () => {
    const ws = new WsClient('ws://localhost:8847/ws');
    expect(ws.url).toBe('ws://localhost:8847/ws');
  });

  it('dispatches events to registered handlers', () => {
    const ws = new WsClient('ws://localhost:8847/ws');
    const handler = vi.fn();
    ws.on('message.new', handler);
    ws.handleEvent({ type: 'message.new', timestamp: '2026-03-04T10:00:00Z', data: { body: 'hi' } });
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: 'message.new' }));
  });

  it('supports wildcard handler', () => {
    const ws = new WsClient('ws://localhost:8847/ws');
    const handler = vi.fn();
    ws.on('*', handler);
    ws.handleEvent({ type: 'room.created', timestamp: '2026-03-04T10:00:00Z', data: {} });
    expect(handler).toHaveBeenCalled();
  });
});
```

**Step 2-5: Implement, test, commit** — follow same TDD pattern as Task 4.

---

### Task 6: Zustand stores — auth, room, ui

**Files:**
- Create: `app/src/stores/auth-store.ts`
- Create: `app/src/stores/room-store.ts`
- Create: `app/src/stores/ui-store.ts`
- Test: `app/src/stores/__tests__/auth-store.test.ts`
- Test: `app/src/stores/__tests__/room-store.test.ts`

**Step 1: Write the failing test for auth store**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../auth-store';

describe('AuthStore', () => {
  beforeEach(() => useAuthStore.setState(useAuthStore.getInitialState()));

  it('starts unauthenticated', () => {
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('login sets session data', () => {
    useAuthStore.getState().login({
      entity_id: '@alice:relay.ezagent.dev',
      display_name: 'Alice',
      avatar_url: 'https://avatars.githubusercontent.com/u/123',
      authenticated: true,
    });
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.session?.entity_id).toBe('@alice:relay.ezagent.dev');
  });

  it('logout clears session', () => {
    useAuthStore.getState().login({ entity_id: '@alice', display_name: 'Alice', authenticated: true });
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().session).toBeNull();
  });
});
```

**Step 2-5: Implement stores, test, commit.** Each store follows Zustand `create()` pattern with typed state + actions.

---

### Task 7: Zustand stores — message, presence, renderer

**Files:**
- Create: `app/src/stores/message-store.ts`
- Create: `app/src/stores/presence-store.ts`
- Create: `app/src/stores/renderer-store.ts`
- Test: `app/src/stores/__tests__/message-store.test.ts`

Message store holds messages keyed by room_id, supports addMessage, updateAnnotation, pagination. Presence store tracks online users and typing indicators with 3-second timeout. Renderer store caches renderer configs fetched from `/api/renderers`.

---

## Milestone 3: GitHub OAuth + Welcome (Tasks 8-10)

### Task 8: Backend auth endpoints

**Files:**
- Modify: `ezagent/python/ezagent/server.py` — add auth routes
- Test: `ezagent/tests/python/test_http_auth.py`

Add `POST /api/auth/github`, `GET /api/auth/session`, `POST /api/auth/logout` to the FastAPI server. The GitHub endpoint accepts a `github_token`, calls the GitHub API to verify, then creates or retrieves an Entity.

**Note:** Ref `docs/products/http-spec.md` §2.6 for exact request/response schemas.

---

### Task 9: Electron GitHub Device Flow

**Files:**
- Rewrite: `app/electron/auth.ts` — replace OAuth BrowserWindow with Device Flow
- Modify: `app/electron/main.ts` — register IPC handlers (unchanged)

Implements the Device Flow: POST to `/login/device/code` to get `user_code` + `device_code`, display code to user via IPC to renderer, open browser to `github.com/login/device`, poll `/login/oauth/access_token` with `device_code` at `interval` until success/failure, then call backend `/api/auth/github` with the token.

Client ID: `Iv23likJpbvAY27c18tA` (GitHub App "EZAgent Login")

**Covers:** TC-5-AUTH-001, TC-5-AUTH-004

---

### Task 10: Welcome page — Device Flow UI

**Files:**
- Rewrite: `app/src/app/welcome/page.tsx` — Device Flow verification code display
- Modify: `app/src/lib/electron/ipc.ts` — add device flow IPC methods
- Test: `app/src/app/welcome/__tests__/welcome.test.tsx`

Welcome page shows "Sign in with GitHub" button. On click, triggers Device Flow via IPC. App transitions to verification code display: large user_code, "Open GitHub" button, polling status indicator. On success, stores credentials and redirects to `/chat`.

**Covers:** TC-5-AUTH-001, TC-5-AUTH-002, TC-5-AUTH-005, TC-5-JOURNEY-001

---

## Milestone 4: Core Chat UI (Tasks 11-16)

### Task 11: Three-panel layout

**Files:**
- Create: `app/src/app/chat/layout.tsx`
- Create: `app/src/components/sidebar/Sidebar.tsx`
- Create: `app/src/components/info-panel/InfoPanel.tsx`

The chat layout: resizable sidebar (left) | main area (center) | collapsible info panel (right).

---

### Task 12: Sidebar — Room list

**Files:**
- Create: `app/src/components/sidebar/RoomList.tsx`
- Create: `app/src/components/sidebar/RoomItem.tsx`
- Test: `app/src/components/sidebar/__tests__/RoomList.test.tsx`

**Covers:** TC-5-UI-001 (room list with unread badges, sorted by unread)

---

### Task 13: Sidebar — Channel list + Search

**Files:**
- Create: `app/src/components/sidebar/ChannelList.tsx`
- Create: `app/src/components/sidebar/SearchBar.tsx`

**Covers:** TC-5-UI-002

---

### Task 14: Timeline view with virtual scroll

**Files:**
- Create: `app/src/components/chat/Timeline.tsx`
- Create: `app/src/components/chat/MessageBubble.tsx`
- Create: `app/src/app/chat/[roomId]/page.tsx`
- Test: `app/src/components/chat/__tests__/Timeline.test.tsx`

Implements the message timeline with `@tanstack/react-virtual` for performance. Loads messages from REST API on room enter. Displays author, timestamp, body.

**Covers:** TC-5-UI-003, TC-5-TAB-001

---

### Task 15: Compose area

**Files:**
- Create: `app/src/components/chat/ComposeArea.tsx`
- Create: `app/src/components/chat/EmojiPicker.tsx`
- Test: `app/src/components/chat/__tests__/ComposeArea.test.tsx`

Compose input with Enter to send, emoji picker, attachment button. Posts to `POST /api/rooms/{id}/messages`.

**Covers:** TC-5-UI-004, TC-5-UI-005

---

### Task 16: Room header + tab navigation

**Files:**
- Create: `app/src/components/chat/RoomHeader.tsx`
- Create: `app/src/components/tabs/RoomTabContainer.tsx`
- Test: `app/src/components/tabs/__tests__/RoomTabContainer.test.tsx`

Room header shows room name + available tabs. Fetches tab list from `GET /api/rooms/{id}/views`. Tab switching preserves scroll position.

**Covers:** TC-5-TAB-001, TC-5-TAB-002, TC-5-TAB-003

---

## Milestone 5: Render Pipeline (Tasks 17-22)

### Task 17: Pipeline resolver (Level 0/1/2)

**Files:**
- Create: `app/src/lib/pipeline/resolve.ts`
- Create: `app/src/lib/pipeline/types.ts`
- Test: `app/src/lib/pipeline/__tests__/resolve.test.ts`

The core `resolveRenderer(message, rendererStore)` function that implements the fallback chain: Level 2 → Level 1 → Level 0. Returns the component type and props.

**Covers:** TC-5-OVERRIDE-001~006

---

### Task 18: Content Renderers — text + markdown

**Files:**
- Create: `app/src/components/renderers/ContentRenderer.tsx`
- Create: `app/src/components/renderers/text-renderer.tsx`
- Test: `app/src/components/renderers/__tests__/text-renderer.test.tsx`

TextRenderer handles `text/plain` (plain bubble) and `text/markdown` (react-markdown + remark-gfm with code syntax highlighting via shiki).

**Covers:** TC-5-RENDER-001, TC-5-RENDER-002

---

### Task 19: Content Renderers — structured_card

**Files:**
- Create: `app/src/components/renderers/structured-card.tsx`
- Test: `app/src/components/renderers/__tests__/structured-card.test.tsx`

Renders header + metadata rows + badge based on `field_mapping`. Badge color comes from Flow renderer config.

**Covers:** TC-5-RENDER-003

---

### Task 20: Content Renderers — media, code, document_link, composite

**Files:**
- Create: `app/src/components/renderers/media-message.tsx`
- Create: `app/src/components/renderers/code-block.tsx`
- Create: `app/src/components/renderers/document-link.tsx`
- Create: `app/src/components/renderers/composite.tsx`
- Create: `app/src/components/renderers/schema-renderer.tsx`

**Covers:** TC-5-RENDER-004, TC-5-RENDER-005, TC-5-RENDER-006, TC-5-RENDER-007, TC-5-RENDER-008

---

### Task 21: Decorator layer

**Files:**
- Create: `app/src/components/decorators/DecoratorLayer.tsx`
- Create: `app/src/components/decorators/emoji-bar.tsx`
- Create: `app/src/components/decorators/quote-preview.tsx`
- Create: `app/src/components/decorators/text-tag.tsx`
- Create: `app/src/components/decorators/thread-indicator.tsx`
- Create: `app/src/components/decorators/tag-list.tsx`
- Create: `app/src/components/decorators/redact-overlay.tsx`
- Test: `app/src/components/decorators/__tests__/DecoratorLayer.test.tsx`

DecoratorLayer sorts decorators by priority, renders at correct positions (above/below/inline/overlay).

**Covers:** TC-5-DECOR-001~008

---

### Task 22: Action layer

**Files:**
- Create: `app/src/components/actions/ActionLayer.tsx`
- Create: `app/src/components/actions/ActionButton.tsx`
- Create: `app/src/components/actions/ConfirmDialog.tsx`
- Test: `app/src/components/actions/__tests__/ActionLayer.test.tsx`

Renders action buttons filtered by viewer Role. ConfirmDialog for confirm=true actions. Click triggers annotation write → flow transition.

**Covers:** TC-5-ACTION-001~006

---

## Milestone 6: Room Tabs (Tasks 23-26)

### Task 23: Timeline Tab (message_list layout)

Already implemented in Task 14. This task adds the tab wrapper and ensures it integrates with RoomTabContainer.

**Covers:** TC-5-TAB-001

---

### Task 24: Kanban Tab

**Files:**
- Create: `app/src/components/tabs/kanban-tab.tsx`
- Test: `app/src/components/tabs/__tests__/kanban-tab.test.tsx`

Kanban board with columns from Flow states. Cards use the DataType's Content Renderer. Drag-drop via @dnd-kit triggers flow transitions. Role check on drop.

**Covers:** TC-5-TAB-004, TC-5-TAB-005, TC-5-TAB-006

---

### Task 25: Gallery Tab + Table Tab

**Files:**
- Create: `app/src/components/tabs/gallery-tab.tsx`
- Create: `app/src/components/tabs/table-tab.tsx`

Gallery: grid layout with media thumbnails. Table: sortable/filterable data table.

**Covers:** TC-5-TAB-007, TC-5-TAB-008, TC-5-TAB-009

---

### Task 26: Tab data persistence on switch

**Files:**
- Modify: `app/src/components/tabs/RoomTabContainer.tsx`

Ensure tab switching preserves scroll position and state (no remount).

**Covers:** TC-5-TAB-003

---

## Milestone 7: Info Panel (Tasks 27-29)

### Task 27: Member list + presence

**Files:**
- Create: `app/src/components/info-panel/MemberList.tsx`
- Create: `app/src/components/decorators/presence-dot.tsx`
- Create: `app/src/components/decorators/typing-indicator.tsx`

**Covers:** TC-5-UI-006, TC-5-DECOR-008

---

### Task 28: Pinned messages + Media gallery

**Files:**
- Create: `app/src/components/info-panel/PinnedMessages.tsx`
- Create: `app/src/components/info-panel/MediaGallery.tsx`

**Covers:** TC-5-UI-007, TC-5-UI-008

---

### Task 29: Thread panel

**Files:**
- Create: `app/src/components/info-panel/ThreadPanel.tsx`

Thread panel replaces info panel when thread indicator is clicked. Shows parent message + replies. Compose within thread.

**Covers:** TC-5-UI-009

---

## Milestone 8: Widget SDK (Tasks 30-31)

### Task 30: Widget registry + WidgetHost

**Files:**
- Create: `app/src/components/widget-sdk/registry.ts`
- Create: `app/src/components/widget-sdk/WidgetHost.tsx`
- Test: `app/src/components/widget-sdk/__tests__/registry.test.ts`

Implements `registerRenderer()` API and `WidgetHost` sandbox component. WidgetHost provides props.data, props.context, props.actions to registered components.

**Covers:** TC-5-WIDGET-001, TC-5-WIDGET-002, TC-5-WIDGET-003, TC-5-WIDGET-008

---

### Task 31: Widget actions API + sandbox

**Files:**
- Modify: `app/src/components/widget-sdk/WidgetHost.tsx`
- Test: `app/src/components/widget-sdk/__tests__/WidgetHost.test.tsx`

Implements the actions API (sendMessage, writeAnnotation, advanceFlow, navigate). Sandbox restrictions: data scoped to subscriptions, no external fetch.

**Covers:** TC-5-WIDGET-004, TC-5-WIDGET-005, TC-5-WIDGET-006, TC-5-WIDGET-007

---

## Milestone 9: Real-time Sync (Tasks 32-33)

### Task 32: WebSocket → Store integration

**Files:**
- Create: `app/src/lib/ws/handlers.ts`
- Modify: `app/src/lib/ws/client.ts`

Maps WebSocket events to Zustand store actions:
- `message.new` → `messageStore.addMessage()`
- `reaction.*` → `messageStore.updateAnnotation()`
- `presence.*` → `presenceStore.update()`
- `typing.*` → `presenceStore.setTyping()`
- `room.*` → `roomStore.update()`

**Covers:** TC-5-SYNC-001, TC-5-SYNC-002, TC-5-SYNC-003, TC-5-SYNC-005

---

### Task 33: Kanban real-time sync

**Files:**
- Modify: `app/src/components/tabs/kanban-tab.tsx`

When a WebSocket event indicates a flow state change, kanban board re-renders with cards in updated columns.

**Covers:** TC-5-SYNC-004

---

## Milestone 10: URI Deep Links (Tasks 34-35)

### Task 34: Electron URI scheme handler

**Files:**
- Modify: `app/electron/main.ts` — add protocol handler
- Create: `app/src/lib/electron/deep-link.ts`

Register `ezagent://` scheme. On deep link, parse URI, navigate to room/message.

**Covers:** TC-5-URI-001

---

### Task 35: URI rendering + copy

**Files:**
- Create: `app/src/components/renderers/uri-link.tsx`
- Modify: `app/src/components/chat/MessageBubble.tsx` — add context menu

Detect `ezagent://` URIs in message text, render as clickable links with resource type icons. Right-click "Copy ezagent URI" on messages.

**Covers:** TC-5-URI-002, TC-5-URI-003

---

## Milestone 11: User Journeys (Tasks 36-37)

### Task 36: First-use journey — create room

**Files:**
- Create: `app/src/components/chat/EmptyState.tsx`
- Create: `app/src/components/chat/CreateRoomDialog.tsx`

Empty state shows "Create a room" or "Enter invite code". Create room dialog → POST /api/rooms → navigate to new room.

**Covers:** TC-5-JOURNEY-002

---

### Task 37: Agent interaction + peer chat

Integration testing tasks that verify:
- Agent sends structured_card → user clicks action → flow transition (TC-5-JOURNEY-003)
- Two peers send messages, both see real-time (TC-5-JOURNEY-004)

These are E2E tests requiring a running backend. Create test scripts that can be run manually.

**Covers:** TC-5-JOURNEY-003, TC-5-JOURNEY-004

---

## Milestone 12: Electron Shell + Tray (Tasks 38-40)

### Task 38: Daemon manager

**Files:**
- Create: `app/electron/daemon.ts`

Manages the `ezagent serve` subprocess lifecycle. Starts on app ready, monitors health via `GET /api/status`, restarts on crash. Provides status to tray.

**Covers:** TC-5-PKG-006

---

### Task 39: Tray manager

**Files:**
- Create: `app/electron/tray.ts`
- Modify: `app/electron/main.ts` — integrate tray

Tray icon (◆/◇) with menu: status, agent count, room count, Open, Preferences, About, Quit. Close window → tray stays. Quit → daemon stops.

**Covers:** Part of TC-5-PKG-003~006

---

### Task 40: Window lifecycle — close vs quit

**Files:**
- Modify: `app/electron/main.ts`

On macOS: close window hides to tray, Cmd+Q quits. Other platforms: close = minimize to tray. Tray "Quit" stops daemon.

---

## Milestone 13: Desktop Packaging (Tasks 41-43)

### Task 41: electron-builder configuration

**Files:**
- Create: `app/electron-builder.yml`
- Modify: `app/package.json` — add `build` config

Configure electron-builder for DMG (macOS), MSI (Windows), AppImage (Linux). Register `ezagent://` protocol. Include `out/` and `dist-electron/` in build.

**Covers:** TC-5-PKG-003, TC-5-PKG-004, TC-5-PKG-005

---

### Task 42: Python runtime bundling script

**Files:**
- Create: `app/scripts/bundle-python.sh`

Downloads python-build-standalone, installs ezagent wheel + deps into `runtime/` directory. Included in electron-builder extraResources.

**Covers:** TC-5-PKG-006

---

### Task 43: Build + verify package

Run the full build pipeline: `pnpm build:electron && pnpm package`

Verify:
- DMG/MSI/AppImage produced
- App launches, shows welcome page
- Daemon starts, API responds
- Size ≤ 60MB

**Covers:** TC-5-PKG-001~006

---

## Milestone 14: Final Integration (Tasks 44-45)

### Task 44: Cross-device auth test

Manual E2E test for GitHub OAuth key recovery across devices.

**Covers:** TC-5-AUTH-003

---

### Task 45: Full test suite run + cleanup

Run all Vitest tests, fix any failures. Verify 77 test cases are covered.

```bash
cd app && pnpm test
```

**Final commit:**
```bash
git add .
git commit -m "feat(app): complete Phase 5 Chat App implementation"
```

---

## Appendix: Test Case → Task Mapping

| Test Cases | Task | Milestone |
|------------|------|-----------|
| TC-5-RENDER-001~002 | 18 | 5 |
| TC-5-RENDER-003 | 19 | 5 |
| TC-5-RENDER-004~008 | 20 | 5 |
| TC-5-DECOR-001~008 | 21, 27 | 5, 7 |
| TC-5-ACTION-001~006 | 22 | 5 |
| TC-5-TAB-001~003 | 14, 16, 26 | 4, 4, 6 |
| TC-5-TAB-004~006 | 24 | 6 |
| TC-5-TAB-007~009 | 25 | 6 |
| TC-5-OVERRIDE-001~006 | 17 | 5 |
| TC-5-WIDGET-001~008 | 30, 31 | 8 |
| TC-5-UI-001~002 | 12, 13 | 4 |
| TC-5-UI-003~005 | 14, 15 | 4 |
| TC-5-UI-006~009 | 27, 28, 29 | 7 |
| TC-5-JOURNEY-001 | 10 | 3 |
| TC-5-JOURNEY-002 | 36 | 11 |
| TC-5-JOURNEY-003~004 | 37 | 11 |
| TC-5-AUTH-001~005 | 8, 9, 10 | 3 |
| TC-5-PKG-001~006 | 41, 42, 43 | 13 |
| TC-5-SYNC-001~005 | 32, 33 | 9 |
| TC-5-URI-001~003 | 34, 35 | 10 |
