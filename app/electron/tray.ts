/**
 * TrayManager — manages the system tray icon and context menu.
 *
 * Provides:
 * - System tray icon (template image for macOS, standard for others)
 * - Context menu with status display, window toggle, and quit action
 * - Dynamic status updates via updateStatus()
 *
 * NOTE: This file uses Electron APIs (Tray, Menu, nativeImage) and cannot
 * be unit-tested in Vitest (jsdom). The logic is straightforward enough
 * that manual/E2E testing suffices.
 */

import { Tray, Menu, nativeImage, app, BrowserWindow, MenuItemConstructorOptions } from 'electron';
import path from 'path';

export class TrayManager {
  private tray: Tray | null = null;
  private statusText = 'EZAgent: Stopped';
  private getMainWindow: () => BrowserWindow | null;

  /**
   * @param getMainWindow - Callback that returns the current main window
   *   (or null if none). Used by menu actions to show/focus the window.
   */
  constructor(getMainWindow: () => BrowserWindow | null) {
    this.getMainWindow = getMainWindow;
  }

  /**
   * Creates the system tray icon and builds the initial context menu.
   * Should be called once after app.whenReady().
   */
  create(): void {
    // Create a 16x16 template icon.
    // On macOS, template images are automatically themed for light/dark mode.
    // We create a simple programmatic icon since we don't bundle asset files yet.
    const icon = this.createTrayIcon();
    this.tray = new Tray(icon);
    this.tray.setToolTip('EZAgent');
    this.buildContextMenu();
  }

  /**
   * Updates the displayed daemon status in the tray context menu.
   *
   * @param status - Human-readable status string (e.g., "Running", "Stopped", "Error")
   */
  updateStatus(status: string): void {
    this.statusText = `EZAgent: ${status}`;
    this.buildContextMenu();
  }

  /**
   * Destroys the tray icon. Called during app shutdown.
   */
  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }

  // --- Private helpers ---

  /**
   * Builds (or rebuilds) the tray context menu with the current status.
   *
   * Menu structure:
   *   - Status line (disabled, informational)
   *   - ---
   *   - Open EZAgent
   *   - Preferences... (disabled placeholder)
   *   - About EZAgent (disabled placeholder)
   *   - ---
   *   - Quit EZAgent
   */
  private buildContextMenu(): void {
    if (!this.tray) return;

    const template: MenuItemConstructorOptions[] = [
      {
        label: this.statusText,
        enabled: false,
      },
      { type: 'separator' },
      {
        label: 'Open EZAgent',
        click: () => {
          const win = this.getMainWindow();
          if (win) {
            win.show();
            win.focus();
          }
        },
      },
      {
        label: 'Preferences...',
        enabled: false, // placeholder — not yet implemented
      },
      {
        label: 'About EZAgent',
        enabled: false, // placeholder — not yet implemented
      },
      { type: 'separator' },
      {
        label: 'Quit EZAgent',
        click: () => {
          app.quit();
        },
      },
    ];

    const contextMenu = Menu.buildFromTemplate(template);
    this.tray.setContextMenu(contextMenu);
  }

  /**
   * Creates a minimal 16x16 tray icon.
   *
   * On macOS we mark it as a template image so the OS can adapt it
   * to the current menu bar appearance (light or dark).
   *
   * The icon is a simple circle — a proper branded icon should replace
   * this once design assets are available.
   */
  private createTrayIcon(): Electron.NativeImage {
    // Try to load a bundled icon file first
    const iconName = process.platform === 'darwin' ? 'tray-iconTemplate.png' : 'tray-icon.png';
    const iconPath = path.join(__dirname, '..', 'assets', iconName);

    try {
      const img = nativeImage.createFromPath(iconPath);
      if (!img.isEmpty()) {
        if (process.platform === 'darwin') {
          img.setTemplateImage(true);
        }
        return img;
      }
    } catch {
      // Fall through to programmatic icon
    }

    // Fallback: create a simple 16x16 programmatic icon (white circle on transparent)
    // This is a minimal PNG encoded as a data URL — a 16x16 filled circle.
    const size = { width: 16, height: 16 };

    // Create a simple buffer with a tiny PNG as fallback.
    // For now, use a 1x1 pixel as absolute minimum — the real icon comes from assets/.
    const fallback = nativeImage.createFromBuffer(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAFklEQVQ4jWP8z8BQz0BFwDRqwKgBAABnAAH/QsCXAAAAAElFTkSuQmCC',
        'base64'
      ),
      size
    );

    if (process.platform === 'darwin') {
      fallback.setTemplateImage(true);
    }

    return fallback;
  }
}
