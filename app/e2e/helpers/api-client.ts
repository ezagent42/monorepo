const BASE_URL = 'http://localhost:6142';

export class ApiClient {
  async getStatus(): Promise<{ status: string; identity_initialized: boolean; registered_datatypes: string[] }> {
    const res = await fetch(`${BASE_URL}/api/status`);
    return res.json();
  }

  async getSession(): Promise<any> {
    const res = await fetch(`${BASE_URL}/api/auth/session`);
    if (!res.ok) return null;
    return res.json();
  }

  async testInit(): Promise<any> {
    const res = await fetch(`${BASE_URL}/api/auth/test-init`, { method: 'POST' });
    if (!res.ok) throw new Error(`test-init failed: ${res.status} ${await res.text()}`);
    return res.json();
  }

  async logout(): Promise<void> {
    await fetch(`${BASE_URL}/api/auth/logout`, { method: 'POST' });
  }

  async createRoom(name: string, description?: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    if (!res.ok) throw new Error(`createRoom failed: ${res.status} ${await res.text()}`);
    return res.json();
  }

  async listRooms(): Promise<any[]> {
    const res = await fetch(`${BASE_URL}/api/rooms`);
    return res.json();
  }

  async getRoom(roomId: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/api/rooms/${roomId}`);
    return res.json();
  }

  async joinRoom(roomId: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/api/rooms/${roomId}/join`, { method: 'POST' });
    return res.json();
  }

  async leaveRoom(roomId: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/api/rooms/${roomId}/leave`, { method: 'POST' });
    return res.json();
  }

  async getMembers(roomId: string): Promise<any[]> {
    const res = await fetch(`${BASE_URL}/api/rooms/${roomId}/members`);
    return res.json();
  }

  async sendMessage(roomId: string, body: string, opts?: { format?: string; content_type?: string }): Promise<any> {
    const res = await fetch(`${BASE_URL}/api/rooms/${roomId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, ...opts }),
    });
    if (!res.ok) throw new Error(`sendMessage failed: ${res.status} ${await res.text()}`);
    return res.json();
  }

  async getMessages(roomId: string, limit?: number): Promise<any[]> {
    const url = limit
      ? `${BASE_URL}/api/rooms/${roomId}/messages?limit=${limit}`
      : `${BASE_URL}/api/rooms/${roomId}/messages`;
    const res = await fetch(url);
    return res.json();
  }

  async getMessage(roomId: string, refId: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/api/rooms/${roomId}/messages/${refId}`);
    return res.json();
  }

  async editMessage(roomId: string, refId: string, body: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/api/rooms/${roomId}/messages/${refId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    return res.json();
  }

  async deleteMessage(roomId: string, refId: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/api/rooms/${roomId}/messages/${refId}`, {
      method: 'DELETE',
    });
    return res.json();
  }

  async addReaction(roomId: string, refId: string, emoji: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/api/rooms/${roomId}/messages/${refId}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji }),
    });
    return res.json();
  }

  async addAnnotation(roomId: string, refId: string, key: string, value: any): Promise<any> {
    const res = await fetch(`${BASE_URL}/api/rooms/${roomId}/messages/${refId}/annotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
    return res.json();
  }

  async typing(roomId: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/api/rooms/${roomId}/typing`, { method: 'POST' });
    return res.json();
  }

  async getPresence(roomId: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/api/rooms/${roomId}/presence`);
    return res.json();
  }

  async getRenderers(): Promise<any> {
    const res = await fetch(`${BASE_URL}/api/renderers`);
    return res.json();
  }

  async getRoomRenderers(roomId: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/api/rooms/${roomId}/renderers`);
    return res.json();
  }

  async getRoomViews(roomId: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/api/rooms/${roomId}/views`);
    return res.json();
  }
}

export const api = new ApiClient();
