import WebSocket from 'ws';

export class WsClient {
  private ws: WebSocket | null = null;
  private events: any[] = [];
  private listeners: Array<{ type: string; resolve: (event: any) => void }> = [];

  async connect(roomId?: string): Promise<void> {
    const url = roomId
      ? `ws://localhost:6142/ws?room=${roomId}`
      : 'ws://localhost:6142/ws';
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);
      this.ws.on('open', () => resolve());
      this.ws.on('message', (data) => {
        const event = JSON.parse(data.toString());
        // Check if any listener is waiting for this type
        const idx = this.listeners.findIndex((l) => l.type === event.type);
        if (idx >= 0) {
          const listener = this.listeners.splice(idx, 1)[0];
          listener.resolve(event);
        } else {
          this.events.push(event);
        }
      });
      this.ws.on('error', reject);
      setTimeout(() => reject(new Error('WebSocket connect timeout')), 10_000);
    });
  }

  waitForEvent(type: string, timeout = 5_000): Promise<any> {
    // Check buffered events first
    const idx = this.events.findIndex((e) => e.type === type);
    if (idx >= 0) {
      return Promise.resolve(this.events.splice(idx, 1)[0]);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const listenerIdx = this.listeners.findIndex((l) => l.resolve === resolver);
        if (listenerIdx >= 0) this.listeners.splice(listenerIdx, 1);
        reject(new Error(`Timeout waiting for WS event: ${type}`));
      }, timeout);
      const resolver = (event: any) => {
        clearTimeout(timer);
        resolve(event);
      };
      this.listeners.push({ type, resolve: resolver });
    });
  }

  getBufferedEvents(): any[] {
    return [...this.events];
  }

  clearBuffer(): void {
    this.events = [];
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
    this.events = [];
    this.listeners = [];
  }
}
