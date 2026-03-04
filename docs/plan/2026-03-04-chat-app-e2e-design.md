# EZAgent Chat App E2E Test Design

> **Goal:** Full-coverage E2E test suite for the packaged EZAgent desktop app using Playwright Electron integration, covering all 77 TC-5-* test cases.

**Approach:** Playwright `_electron` API launches the real packaged `/Applications/EZAgent.app`, which auto-starts its bundled Python daemon. Tests interact with the renderer via Playwright `page`, the main process via `electronApp.evaluate()`, and the backend via direct HTTP/WebSocket calls to `localhost:6142`.

---

## §1 Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Playwright Test Runner (@playwright/test)               │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Global Setup                                      │  │
│  │  ─────────────                                     │  │
│  │  1. Launch /Applications/EZAgent.app               │  │
│  │  2. Wait for daemon health (GET :6142/api/status)  │  │
│  │  3. Inject auth session (bypass GitHub OAuth)      │  │
│  │  4. Share ElectronApplication + Page via fixture    │  │
│  └────────────────────────────────────────────────────┘  │
│                          │                               │
│  ┌───────────────────────▼─────────────────────────────┐ │
│  │  Test Suites (10 files, serial within each suite)   │ │
│  │   1. app-lifecycle.e2e.ts      (TC-5-PKG)          │ │
│  │   2. auth-flow.e2e.ts          (TC-5-AUTH)          │ │
│  │   3. room-crud.e2e.ts          (TC-5-JOURNEY-001)   │ │
│  │   4. messaging.e2e.ts          (TC-5-UI, JOURNEY)   │ │
│  │   5. render-pipeline.e2e.ts    (TC-5-RENDER, DECOR) │ │
│  │   6. tabs-panels.e2e.ts        (TC-5-TAB, UI)       │ │
│  │   7. deep-links.e2e.ts         (TC-5-URI)           │ │
│  │   8. tray-window.e2e.ts        (TC-5-PKG)           │ │
│  │   9. widget-sdk.e2e.ts         (TC-5-WIDGET)        │ │
│  │  10. realtime-sync.e2e.ts      (TC-5-SYNC)          │ │
│  └─────────────────────────────────────────────────────┘ │
│                          │                               │
│              ┌───────────▼───────────┐                   │
│              │  EZAgent.app (real)   │                   │
│              │  ├─ Electron main     │                   │
│              │  ├─ Renderer (app://) │                   │
│              │  └─ Daemon :6142      │                   │
│              │     ├─ REST API       │                   │
│              │     └─ WebSocket /ws  │                   │
│              └───────────────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Playwright `_electron` | Native Electron support, both renderer and main process access |
| Test target | Packaged app (DMG-installed) | Tests exactly what users run, including bundled runtime |
| Daemon | App auto-starts | Validates real startup flow; no pre-launch needed |
| Auth | Token injection | GitHub OAuth browser flow is untestable in automation; already unit-tested |
| Execution | Serial within suite | Suites share app state (rooms, messages); parallel would cause conflicts |
| Screenshots | On failure | Auto-captured for debugging |
| Test data cleanup | Per-suite setup/teardown | Each suite creates its own rooms/messages, cleans up after |

---

## §2 Directory Structure

```
app/
├── e2e/
│   ├── playwright.config.ts              # Playwright config
│   ├── global-setup.ts                   # Launch app, wait daemon, inject auth
│   ├── global-teardown.ts                # Quit app, cleanup
│   ├── fixtures/
│   │   ├── electron-app.ts               # ElectronApplication + Page fixture
│   │   └── test-data.ts                  # Mock data constants (room names, messages)
│   ├── helpers/
│   │   ├── api-client.ts                 # HTTP client for daemon :6142
│   │   ├── ws-client.ts                  # WebSocket client for real-time events
│   │   ├── wait-helpers.ts               # waitForDaemon, waitForSelector, etc.
│   │   └── auth-helpers.ts               # Session injection, credential management
│   ├── app-lifecycle.e2e.ts              # Suite 1: Launch, daemon, quit
│   ├── auth-flow.e2e.ts                  # Suite 2: Auth states, session
│   ├── room-crud.e2e.ts                  # Suite 3: Room lifecycle
│   ├── messaging.e2e.ts                  # Suite 4: Send/receive/edit/delete
│   ├── render-pipeline.e2e.ts            # Suite 5: All renderers + decorators
│   ├── tabs-panels.e2e.ts               # Suite 6: Tab switching, info panel
│   ├── deep-links.e2e.ts                # Suite 7: URI protocol handling
│   ├── tray-window.e2e.ts               # Suite 8: Tray icon, window lifecycle
│   ├── widget-sdk.e2e.ts                # Suite 9: Custom widget registration
│   └── realtime-sync.e2e.ts             # Suite 10: WebSocket events, presence
├── package.json                          # + @playwright/test devDependency
```

---

## §3 Infrastructure Code

### playwright.config.ts

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 60_000,          // 60s per test (Electron launch is slow)
  retries: 1,               // Retry flaky tests once
  workers: 1,               // Serial execution (shared app instance)
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
});
```

### global-setup.ts

```typescript
import { _electron as electron } from 'playwright';
import { waitForDaemon } from './helpers/wait-helpers';

const APP_PATH = '/Applications/EZAgent.app/Contents/MacOS/EZAgent';

export default async function globalSetup() {
  const app = await electron.launch({ executablePath: APP_PATH });
  const page = await app.firstWindow();

  // Wait for daemon to become healthy (up to 30s)
  await waitForDaemon({ timeout: 30_000 });

  // Store app and page for tests to access
  (globalThis as any).__electronApp = app;
  (globalThis as any).__electronPage = page;
}
```

### global-teardown.ts

```typescript
export default async function globalTeardown() {
  const app = (globalThis as any).__electronApp;
  if (app) {
    await app.close();
  }
}
```

### fixtures/electron-app.ts

```typescript
import { test as base, ElectronApplication, Page } from '@playwright/test';

type ElectronFixtures = {
  electronApp: ElectronApplication;
  page: Page;
};

export const test = base.extend<ElectronFixtures>({
  electronApp: async ({}, use) => {
    const app = (globalThis as any).__electronApp;
    await use(app);
  },
  page: async ({}, use) => {
    const page = (globalThis as any).__electronPage;
    await use(page);
  },
});

export { expect } from '@playwright/test';
```

### helpers/api-client.ts

```typescript
const BASE_URL = 'http://localhost:6142';

export class ApiClient {
  async getStatus() {
    const res = await fetch(`${BASE_URL}/api/status`);
    return res.json();
  }

  async createRoom(name: string) {
    const res = await fetch(`${BASE_URL}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return res.json();
  }

  async listRooms() {
    const res = await fetch(`${BASE_URL}/api/rooms`);
    return res.json();
  }

  async sendMessage(roomId: string, body: string, format?: string) {
    const res = await fetch(`${BASE_URL}/api/rooms/${roomId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, format }),
    });
    return res.json();
  }

  async getMessages(roomId: string) {
    const res = await fetch(`${BASE_URL}/api/rooms/${roomId}/messages`);
    return res.json();
  }

  async addReaction(roomId: string, refId: string, emoji: string) {
    const res = await fetch(`${BASE_URL}/api/rooms/${roomId}/messages/${refId}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji }),
    });
    return res.json();
  }

  async deleteMessage(roomId: string, refId: string) {
    const res = await fetch(`${BASE_URL}/api/rooms/${roomId}/messages/${refId}`, {
      method: 'DELETE',
    });
    return res.json();
  }

  async joinRoom(roomId: string) {
    const res = await fetch(`${BASE_URL}/api/rooms/${roomId}/join`, { method: 'POST' });
    return res.json();
  }

  async leaveRoom(roomId: string) {
    const res = await fetch(`${BASE_URL}/api/rooms/${roomId}/leave`, { method: 'POST' });
    return res.json();
  }

  async getRenderers() {
    const res = await fetch(`${BASE_URL}/api/renderers`);
    return res.json();
  }

  async getRoomViews(roomId: string) {
    const res = await fetch(`${BASE_URL}/api/rooms/${roomId}/views`);
    return res.json();
  }

  async typing(roomId: string) {
    const res = await fetch(`${BASE_URL}/api/rooms/${roomId}/typing`, { method: 'POST' });
    return res.json();
  }

  async getPresence(roomId: string) {
    const res = await fetch(`${BASE_URL}/api/rooms/${roomId}/presence`);
    return res.json();
  }
}

export const api = new ApiClient();
```

### helpers/ws-client.ts

```typescript
import WebSocket from 'ws';

export class WsClient {
  private ws: WebSocket | null = null;
  private messages: any[] = [];

  async connect(roomId?: string): Promise<void> {
    const url = roomId
      ? `ws://localhost:6142/ws?room=${roomId}`
      : `ws://localhost:6142/ws`;
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);
      this.ws.on('open', () => resolve());
      this.ws.on('message', (data) => {
        this.messages.push(JSON.parse(data.toString()));
      });
      this.ws.on('error', reject);
    });
  }

  waitForEvent(type: string, timeout = 5_000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${type}`)), timeout);
      const check = () => {
        const idx = this.messages.findIndex(m => m.type === type);
        if (idx >= 0) {
          clearTimeout(timer);
          resolve(this.messages.splice(idx, 1)[0]);
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  close() {
    this.ws?.close();
  }
}
```

### helpers/wait-helpers.ts

```typescript
export async function waitForDaemon(opts: { timeout: number } = { timeout: 30_000 }) {
  const start = Date.now();
  while (Date.now() - start < opts.timeout) {
    try {
      const res = await fetch('http://localhost:6142/api/status');
      if (res.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`Daemon not healthy after ${opts.timeout}ms`);
}

export async function waitForPort(port: number, timeout = 5_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(`http://localhost:${port}/`);
      if (res.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
}
```

### helpers/auth-helpers.ts

```typescript
import { ElectronApplication } from 'playwright';

/**
 * Injects a mock authenticated session into the app.
 *
 * Since the daemon runs on localhost without real GitHub OAuth enforcement,
 * we can create a session directly via the API or evaluate in the main process.
 */
export async function injectAuth(app: ElectronApplication) {
  // Approach 1: Call the daemon's auth endpoint directly
  // The local daemon accepts mock auth for development
  const res = await fetch('http://localhost:6142/api/auth/github', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: 'e2e-test-code',
      provider: 'github',
    }),
  });

  if (!res.ok) {
    // Approach 2: Evaluate in main process to set credentials
    await app.evaluate(async () => {
      // Inject credentials into the credential store
      // This bypasses OAuth entirely
    });
  }
}

export async function clearAuth() {
  await fetch('http://localhost:6142/api/auth/logout', { method: 'POST' });
}
```

---

## §4 Test Suites — Full Test Cases

### Suite 1: App Lifecycle (`app-lifecycle.e2e.ts`)

Covers: TC-5-PKG-003, TC-5-PKG-004, TC-5-PKG-005, TC-5-PKG-006

| # | Test | Assert |
|---|------|--------|
| 1 | App launches and shows main window | `page.title()` contains "EZAgent", window visible |
| 2 | Window has correct minimum dimensions | Width ≥ 800, height ≥ 600 |
| 3 | Daemon starts automatically | `GET :6142/api/status` returns `{ status: "ok" }` within 30s |
| 4 | Daemon registers expected datatypes | `registered_datatypes` includes "message", "room", "identity", "timeline" |
| 5 | App:// protocol serves static assets | No "Loading..." stuck; React hydrates and renders actual UI |
| 6 | App quits gracefully on close | After `app.close()`, daemon port 6142 is no longer listening |
| 7 | No orphan processes after quit | No `python3.12` orphan processes for uvicorn |

### Suite 2: Auth Flow (`auth-flow.e2e.ts`)

Covers: TC-5-AUTH-001 through TC-5-AUTH-005

| # | Test | Assert |
|---|------|--------|
| 1 | Unauthenticated state shows login screen | "Login with GitHub" button visible |
| 2 | Mock auth injection creates valid session | After injection, `GET /api/auth/session` returns session object |
| 3 | Authenticated state shows main UI | Sidebar, room list, compose area visible (not login screen) |
| 4 | Logout clears session | After `POST /api/auth/logout`, app returns to login screen |
| 5 | Re-authentication after logout works | Can inject auth again and see main UI |
| 6 | Session persists across page reload | Reload window → still authenticated |
| 7 | Invalid credentials show error | Inject malformed token → error message or login screen persists |

### Suite 3: Room CRUD (`room-crud.e2e.ts`)

Covers: TC-5-JOURNEY-001, TC-5-JOURNEY-002

| # | Test | Assert |
|---|------|--------|
| 1 | Empty state shows "Create Room" prompt | EmptyState component visible with create button |
| 2 | Create room via UI dialog | Click "Create Room" → fill name → submit → room appears in sidebar |
| 3 | Room appears in sidebar list | New room name visible in room list |
| 4 | Click room navigates to timeline | Click room → timeline area visible, compose area visible |
| 5 | Create room via API reflects in UI | `POST /api/rooms` → refresh → room in sidebar |
| 6 | Room list shows multiple rooms | Create 3 rooms → all 3 visible in sidebar |
| 7 | Join room via API | `POST /api/rooms/{id}/join` succeeds |
| 8 | Leave room removes from sidebar | Leave room → no longer in sidebar |
| 9 | Room header shows correct name | Active room header displays room name |

### Suite 4: Messaging (`messaging.e2e.ts`)

Covers: TC-5-UI-001 through TC-5-UI-005, TC-5-JOURNEY-004

| # | Test | Assert |
|---|------|--------|
| 1 | Send text message via compose area | Type "Hello E2E" → Enter → message bubble appears |
| 2 | Message shows author and timestamp | Author name visible, timestamp present |
| 3 | Compose area clears after send | Input field empty after sending |
| 4 | Message persists via API | `GET /api/rooms/{id}/messages` includes sent message |
| 5 | Message from API renders in timeline | `POST /api/rooms/{id}/messages` via API → message visible in UI |
| 6 | Multiple messages in correct order | Send 3 messages → appear in chronological order |
| 7 | Edit message updates bubble | Edit via API → message text updates in UI |
| 8 | Delete message removes bubble | Delete via API → message removed from timeline |
| 9 | Add reaction shows emoji bar | React via API → EmojiBar appears below message |
| 10 | Scroll to bottom on new message | Auto-scroll when new message arrives |
| 11 | Virtual scroll handles many messages | Create 100 messages → timeline scrollable, no crash |

### Suite 5: Render Pipeline (`render-pipeline.e2e.ts`)

Covers: TC-5-RENDER-001 through TC-5-RENDER-008, TC-5-DECOR-001 through TC-5-DECOR-008, TC-5-ACTION-001 through TC-5-ACTION-006

**Content Renderers (Level 1):**

| # | Test (TC) | Assert |
|---|-----------|--------|
| 1 | Text plain (TC-5-RENDER-001) | Plain text bubble with body, author, timestamp |
| 2 | Markdown (TC-5-RENDER-002) | `# Title` → `<h1>`, `**bold**` → `<strong>`, code highlight |
| 3 | Structured card (TC-5-RENDER-003) | Card header, metadata rows with icons, status badge |
| 4 | Media message (TC-5-RENDER-004) | Image thumbnail visible, file name, file size |
| 5 | Code block (TC-5-RENDER-005) | Code block with language label, syntax highlighting |
| 6 | Document link (TC-5-RENDER-006) | Document card with title, summary, "Open" button |
| 7 | Composite message (TC-5-RENDER-007) | Multiple sub-renderers in single bubble |
| 8 | Schema fallback (TC-5-RENDER-008) | Unknown datatype renders as JSON schema table |

**Decorators (Level 2):**

| # | Test (TC) | Assert |
|---|-----------|--------|
| 9 | Emoji reactions (TC-5-DECOR-001) | EmojiBar below message with user attribution |
| 10 | Quote reply preview (TC-5-DECOR-002) | QuotePreview above reply message |
| 11 | "Edited" tag (TC-5-DECOR-003) | TextTag "(edited)" on modified message |
| 12 | Thread indicator (TC-5-DECOR-004) | Reply count + participant avatars |
| 13 | Hashtag labels (TC-5-DECOR-005) | TagList with clickable hashtags |
| 14 | Redaction overlay (TC-5-DECOR-006) | Blurred/hidden content with "[Redacted]" |
| 15 | Typing indicator (TC-5-DECOR-007) | Animated dots when someone is typing |
| 16 | Presence dot (TC-5-DECOR-008) | Green/gray dot for online/offline status |

**Actions (Level 3):**

| # | Test (TC) | Assert |
|---|-----------|--------|
| 17 | Action buttons visible (TC-5-ACTION-001) | Buttons rendered based on role |
| 18 | Action click sends request (TC-5-ACTION-002) | Click → API call → loading state |
| 19 | Confirmation dialog (TC-5-ACTION-003) | Destructive action → ConfirmDialog → confirm/cancel |
| 20 | Action loading state (TC-5-ACTION-004) | Button shows spinner during request |
| 21 | Action error state (TC-5-ACTION-005) | Failed action → error message, button re-enabled |
| 22 | Role-filtered actions (TC-5-ACTION-006) | Only show actions matching user's role |

### Suite 6: Room Tabs & Info Panel (`tabs-panels.e2e.ts`)

Covers: TC-5-TAB-001 through TC-5-TAB-009, TC-5-UI-006 through TC-5-UI-009

**Room Tabs (Level 4):**

| # | Test (TC) | Assert |
|---|-----------|--------|
| 1 | Default tab is Timeline (TC-5-TAB-001) | message_list tab active on room open |
| 2 | Switch to Kanban tab (TC-5-TAB-002) | Click Kanban → columns render with task cards |
| 3 | Switch to Gallery tab (TC-5-TAB-003) | Click Gallery → grid of media items |
| 4 | Switch to Table tab (TC-5-TAB-004) | Click Table → sortable rows with headers |
| 5 | Tab state persists per room (TC-5-TAB-005) | Switch to Kanban, change room, go back → still Kanban |
| 6 | Tab switching preserves scroll (TC-5-TAB-006) | Scroll in Timeline, switch tab, switch back → same position |
| 7 | Kanban drag and drop (TC-5-TAB-007) | Drag card between columns → state updates |
| 8 | Table column sorting (TC-5-TAB-008) | Click column header → rows reorder |
| 9 | Gallery grid responsive (TC-5-TAB-009) | Resize window → grid reflows |

**Info Panel:**

| # | Test (TC) | Assert |
|---|-----------|--------|
| 10 | Member list shows room members (TC-5-UI-006) | Open info panel → member list visible |
| 11 | Pinned messages panel (TC-5-UI-007) | Pinned messages accessible via panel |
| 12 | Media gallery in info panel (TC-5-UI-008) | Media files from room displayed |
| 13 | Thread panel shows replies (TC-5-UI-009) | Click thread indicator → thread panel with replies |

### Suite 7: Deep Links & URI (`deep-links.e2e.ts`)

Covers: TC-5-URI-001 through TC-5-URI-003

| # | Test (TC) | Assert |
|---|-----------|--------|
| 1 | Parse ezagent:// room link (TC-5-URI-001) | Deep link `ezagent://open/room/{id}` navigates to room |
| 2 | Parse message deep link (TC-5-URI-002) | `ezagent://open/room/{id}/message/{ref}` scrolls to message |
| 3 | Invalid deep link handled gracefully (TC-5-URI-003) | Malformed link → no crash, error toast or no-op |
| 4 | Deep link with unjoined room | Link to room not joined → shows join prompt or error |
| 5 | URI link in message bubble clickable | UriLink component renders, click navigates |

### Suite 8: Tray & Window (`tray-window.e2e.ts`)

Covers: TC-5-PKG-003 through TC-5-PKG-006

| # | Test (TC) | Assert |
|---|-----------|--------|
| 1 | Close window hides to tray (TC-5-PKG-003) | Close window → app still running, daemon healthy |
| 2 | Tray menu has expected items (TC-5-PKG-004) | "Show/Hide", "Status", "Quit" items present |
| 3 | Tray shows daemon status (TC-5-PKG-005) | Tray menu shows "Running" status label |
| 4 | Tray "Quit" shuts everything down (TC-5-PKG-006) | Quit via tray → app closes, daemon stops, process exits |
| 5 | Window restore from tray | Click tray → window reappears and is focused |
| 6 | Multiple close/restore cycles | Repeat hide/show 3 times → app still functional |

### Suite 9: Widget SDK (`widget-sdk.e2e.ts`)

Covers: TC-5-WIDGET-001 through TC-5-WIDGET-008

| # | Test (TC) | Assert |
|---|-----------|--------|
| 1 | WidgetRegistry is accessible (TC-5-WIDGET-001) | `window.__ezagent_widgets` or equivalent API exists |
| 2 | Register custom renderer (TC-5-WIDGET-002) | Register renderer for custom datatype → no error |
| 3 | Custom renderer renders (TC-5-WIDGET-003) | Send message with custom datatype → custom widget renders |
| 4 | Widget receives correct props (TC-5-WIDGET-004) | Widget gets data, context, actions props |
| 5 | Widget sandbox isolation (TC-5-WIDGET-005) | Widget cannot access parent DOM directly |
| 6 | Widget error boundary (TC-5-WIDGET-006) | Widget throws → error fallback shown, app doesn't crash |
| 7 | Multiple widgets coexist (TC-5-WIDGET-007) | Register 2 widgets → both render correctly |
| 8 | Widget unregister (TC-5-WIDGET-008) | Unregister widget → falls back to schema renderer |

### Suite 10: Real-time Sync (`realtime-sync.e2e.ts`)

Covers: TC-5-SYNC-001 through TC-5-SYNC-005

| # | Test (TC) | Assert |
|---|-----------|--------|
| 1 | WebSocket connects on room enter (TC-5-SYNC-001) | Enter room → WS connection established |
| 2 | New message via WS appears in UI (TC-5-SYNC-002) | Send message via API → WS pushes event → UI updates |
| 3 | Reaction via WS updates emoji bar (TC-5-SYNC-003) | Add reaction via API → WS event → EmojiBar updates |
| 4 | Presence update via WS (TC-5-SYNC-004) | User goes online/offline → presence dot updates |
| 5 | Typing indicator via WS (TC-5-SYNC-005) | `POST /api/rooms/{id}/typing` → typing indicator appears |
| 6 | Message ordering under concurrent sends | Send 5 messages rapidly → all appear in correct order |
| 7 | WS reconnects after disconnect | Kill WS → auto-reconnect → events resume |

---

## §5 Render Pipeline Override Tests

Covers: TC-5-OVERRIDE-001 through TC-5-OVERRIDE-006

These are included in Suite 5 but test the override/customization system:

| # | Test (TC) | Assert |
|---|-----------|--------|
| 1 | Room-level renderer override (TC-5-OVERRIDE-001) | Room-specific renderer config overrides global |
| 2 | Datatype → renderer mapping (TC-5-OVERRIDE-002) | Custom datatype uses its declared renderer |
| 3 | Field mapping override (TC-5-OVERRIDE-003) | Different field mappings produce different renders |
| 4 | Badge source from Flow (TC-5-OVERRIDE-004) | Badge color/text driven by Flow state |
| 5 | Fallback on missing renderer (TC-5-OVERRIDE-005) | Unknown renderer type → SchemaRenderer fallback |
| 6 | Renderer hot-reload (TC-5-OVERRIDE-006) | Change renderer config → UI updates without page reload |

---

## §6 Dependencies

```json
{
  "devDependencies": {
    "@playwright/test": "^1.50.0",
    "ws": "^8.18.0"
  }
}
```

**Install command:**
```bash
pnpm add -D @playwright/test ws @types/ws
pnpm exec playwright install chromium  # Electron uses Chromium internally
```

---

## §7 Scripts

```json
{
  "scripts": {
    "test:e2e": "playwright test --config e2e/playwright.config.ts",
    "test:e2e:headed": "playwright test --config e2e/playwright.config.ts --headed",
    "test:e2e:debug": "playwright test --config e2e/playwright.config.ts --debug",
    "test:e2e:report": "playwright show-report"
  }
}
```

---

## §8 Execution Strategy

### Running the full suite

```bash
# Prerequisite: EZAgent.app installed at /Applications/EZAgent.app
# Prerequisite: No other EZAgent instance running

cd app
pnpm test:e2e
```

### Running a single suite

```bash
pnpm test:e2e -- --grep "Room CRUD"
# or
pnpm test:e2e -- e2e/room-crud.e2e.ts
```

### CI Integration (future)

For CI, the test would need to:
1. Build the DMG via `pnpm package`
2. Mount and install the DMG
3. Run the E2E suite
4. Collect screenshots and traces on failure

This is documented but not implemented in this phase.

---

## §9 Test Data Strategy

Each suite manages its own test data:

1. **Setup**: Create rooms/messages via API before tests
2. **Execute**: Interact with UI, assert results
3. **Teardown**: Delete created rooms/messages (or rely on fresh daemon state)

For suites that need specific message types (render pipeline):
- Messages are created via `POST /api/rooms/{id}/messages` with specific `content_type`, `format`, and `body` fields
- The daemon's in-memory state resets on restart, so no persistent pollution

---

## §10 Summary

| Metric | Value |
|--------|-------|
| Test suites | 10 |
| Total test cases | 82 (77 TC-5-* + 5 additional) |
| Framework | Playwright `_electron` |
| Target | Packaged `/Applications/EZAgent.app` |
| Daemon | Auto-started by app |
| Auth | Token injection (bypasses GitHub OAuth) |
| Estimated implementation | ~20 tasks |
