/** Shared test data constants for E2E suites. */

export const TEST_ENTITY_ID = '@e2e-tester:relay.ezagent.dev';
export const TEST_DISPLAY_NAME = 'E2E Tester';

export const ROOMS = {
  general: { name: 'E2E General', description: 'General E2E test room' },
  messaging: { name: 'E2E Messaging', description: 'Messaging test room' },
  renderPipeline: { name: 'E2E Render', description: 'Render pipeline test room' },
  tabs: { name: 'E2E Tabs', description: 'Tabs and panels test room' },
  deepLinks: { name: 'E2E Deep Links', description: 'Deep links test room' },
  widgets: { name: 'E2E Widgets', description: 'Widget SDK test room' },
  sync: { name: 'E2E Sync', description: 'Real-time sync test room' },
};

export const MESSAGES = {
  plainText: 'Hello from E2E test',
  markdown: '# E2E Title\n\n**Bold text** and `inline code`\n\n```rust\nfn main() {\n    println!(\"hello\");\n}\n```',
  longText: 'This is a longer message for testing purposes. '.repeat(10),
};

export const SELECTORS = {
  // Welcome / Login
  loginButton: 'button:has-text("Sign in with GitHub")',
  welcomeTitle: 'text=Welcome to ezagent',

  // Empty state
  emptyState: '[data-testid="empty-state"]',
  createRoomButton: 'button:has-text("Create a room")',

  // Create Room Dialog
  roomNameInput: 'input[id="room-name"]',
  roomDescInput: 'textarea[id="room-description"]',
  dialogCreateButton: 'button:has-text("Create")',
  dialogCancelButton: 'button:has-text("Cancel")',

  // Sidebar
  sidebar: 'aside',
  searchInput: 'input[placeholder="Search rooms..."]',
  roomsHeader: 'text=Rooms',

  // Room Header
  roomHeader: '.h-12.border-b',
  toggleSidebar: '[aria-label="Toggle sidebar"]',
  toggleInfoPanel: '[aria-label="Toggle info panel"]',

  // Timeline
  timeline: '[data-testid="timeline-scroll"]',
  noMessages: 'text=No messages yet',

  // Compose Area
  composeInput: 'textarea[placeholder="Type a message..."]',
  sendButton: 'button:has-text("Send")',
  emojiButton: '[aria-label="Open emoji picker"]',

  // Message bubble
  messageBubble: '.flex.gap-3.px-4.py-2',

  // Tabs
  tabPanel: (name: string) => `[data-testid="tab-panel-${name}"]`,

  // Decorators
  emojiBar: '[data-testid="emoji-bar"]',
  quotePreview: '[data-testid="quote-preview"]',
  textTag: '[data-testid="text-tag"]',
  threadIndicator: '[data-testid="thread-indicator"]',
  tagList: '[data-testid="tag-list"]',
  redactOverlay: '[data-testid="redact-overlay"]',
  typingIndicator: '[data-testid="typing-indicator"]',
  presenceDot: '[data-testid="presence-dot"]',

  // Actions
  actionLayer: '[data-testid="action-layer"]',
  actionButton: (label: string) => `[data-testid="action-btn-${label}"]`,

  // Tabs specific
  kanbanBoard: '[data-testid="kanban-board"]',
  kanbanColumn: (state: string) => `[data-testid="kanban-column-${state}"]`,
  galleryGrid: '[data-testid="gallery-grid"]',
  tableTab: '[data-testid="table-tab"]',

  // Info Panel
  memberList: '[data-testid="member-list"]',
  pinnedMessages: '[data-testid="pinned-messages"]',
  mediaGallery: '[data-testid="media-gallery"]',
  threadPanel: '[data-testid="thread-panel"]',

  // Widget
  widgetHost: '[data-testid="widget-host"]',

  // URI Link
  uriLink: '[data-testid="uri-link"]',
};
