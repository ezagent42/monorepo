import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '../client';

describe('ApiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('constructs with base URL', () => {
    const client = new ApiClient('http://localhost:6142');
    expect(client.baseUrl).toBe('http://localhost:6142');
  });

  it('GET request calls fetch correctly', async () => {
    const mockResponse = { rooms: [] };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 })
    );
    const client = new ApiClient('http://localhost:6142');
    const result = await client.get('/api/rooms');
    expect(result).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledWith('http://localhost:6142/api/rooms', expect.objectContaining({ method: 'GET' }));
  });

  it('POST request sends JSON body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ref_id: 'test' }), { status: 201 })
    );
    const client = new ApiClient('http://localhost:6142');
    await client.post('/api/rooms/123/messages', { body: 'Hello' });
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:6142/api/rooms/123/messages',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ body: 'Hello' }),
      })
    );
  });

  it('PUT request sends JSON body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const client = new ApiClient('http://localhost:6142');
    await client.put('/api/rooms/123', { name: 'Updated' });
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:6142/api/rooms/123',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated' }),
      })
    );
  });

  it('PATCH request sends JSON body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const client = new ApiClient('http://localhost:6142');
    await client.patch('/api/rooms/123', { name: 'Patched' });
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:6142/api/rooms/123',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ name: 'Patched' }),
      })
    );
  });

  it('DELETE request calls fetch correctly', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const client = new ApiClient('http://localhost:6142');
    await client.delete('/api/rooms/123/messages/456');
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:6142/api/rooms/123/messages/456',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('maps error responses to ApiError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'ROOM_NOT_FOUND', message: 'Not found' } }), { status: 404 })
    );
    const client = new ApiClient('http://localhost:6142');
    await expect(client.get('/api/rooms/bad')).rejects.toThrow('ROOM_NOT_FOUND');
  });

  it('ApiError includes status code', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }), { status: 401 })
    );
    const client = new ApiClient('http://localhost:6142');
    try {
      await client.get('/api/auth/session');
      expect.unreachable('Should have thrown');
    } catch (err: unknown) {
      const { ApiError } = await import('../client');
      expect(err).toBeInstanceOf(ApiError);
      expect((err as InstanceType<typeof ApiError>).status).toBe(401);
      expect((err as InstanceType<typeof ApiError>).code).toBe('UNAUTHORIZED');
    }
  });

  it('handles error response without error field gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Server error' }), { status: 500 })
    );
    const client = new ApiClient('http://localhost:6142');
    await expect(client.get('/api/status')).rejects.toThrow('UNKNOWN');
  });

  it('sets Content-Type header to application/json', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 })
    );
    const client = new ApiClient('http://localhost:6142');
    await client.get('/api/rooms');
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );
  });
});
