import { describe, it, expect } from 'vitest';
import {
  getDaemonCommand,
  getHealthCheckUrl,
  calculateBackoff,
  DAEMON_PORT,
  MAX_BACKOFF_MS,
  BASE_BACKOFF_MS,
} from '../daemon-config';

describe('getDaemonCommand', () => {
  it('returns "ezagent" as the command', () => {
    const { command } = getDaemonCommand();
    expect(command).toBe('ezagent');
  });

  it('returns ["serve"] as the args', () => {
    const { args } = getDaemonCommand();
    expect(args).toEqual(['serve']);
  });

  it('returns the correct shape', () => {
    const result = getDaemonCommand();
    expect(result).toHaveProperty('command');
    expect(result).toHaveProperty('args');
    expect(typeof result.command).toBe('string');
    expect(Array.isArray(result.args)).toBe(true);
  });
});

describe('getHealthCheckUrl', () => {
  it('returns a URL pointing to localhost on the daemon port', () => {
    const url = getHealthCheckUrl();
    expect(url).toBe(`http://localhost:${DAEMON_PORT}/api/status`);
  });

  it('uses port 6142 by default', () => {
    const url = getHealthCheckUrl();
    expect(url).toContain(':6142');
  });

  it('targets the /api/status endpoint', () => {
    const url = getHealthCheckUrl();
    expect(url).toMatch(/\/api\/status$/);
  });
});

describe('calculateBackoff', () => {
  it('returns BASE_BACKOFF_MS (1000ms) for attempt 0', () => {
    expect(calculateBackoff(0)).toBe(BASE_BACKOFF_MS);
    expect(calculateBackoff(0)).toBe(1000);
  });

  it('returns 2000ms for attempt 1', () => {
    expect(calculateBackoff(1)).toBe(2000);
  });

  it('returns 4000ms for attempt 2', () => {
    expect(calculateBackoff(2)).toBe(4000);
  });

  it('returns 8000ms for attempt 3', () => {
    expect(calculateBackoff(3)).toBe(8000);
  });

  it('returns 16000ms for attempt 4', () => {
    expect(calculateBackoff(4)).toBe(16000);
  });

  it('caps at MAX_BACKOFF_MS (30000ms) for high attempts', () => {
    expect(calculateBackoff(5)).toBe(MAX_BACKOFF_MS); // 32000 -> capped to 30000
    expect(calculateBackoff(5)).toBe(30000);
  });

  it('remains capped for very high attempt numbers', () => {
    expect(calculateBackoff(10)).toBe(MAX_BACKOFF_MS);
    expect(calculateBackoff(100)).toBe(MAX_BACKOFF_MS);
  });

  it('follows exponential progression: 1000 * 2^attempt', () => {
    const expected = [1000, 2000, 4000, 8000, 16000, 30000];
    for (let i = 0; i < expected.length; i++) {
      expect(calculateBackoff(i)).toBe(expected[i]);
    }
  });
});
