const DAEMON_URL = 'http://localhost:6142';

export async function waitForDaemon(timeout = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(`${DAEMON_URL}/api/status`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'ok') return;
      }
    } catch {
      // Daemon not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Daemon not healthy after ${timeout}ms`);
}

export async function waitForPortClosed(port: number, timeout = 10_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      await fetch(`http://localhost:${port}/`);
      // Still listening, wait
      await new Promise((r) => setTimeout(r, 300));
    } catch {
      return true; // Port closed
    }
  }
  return false;
}
