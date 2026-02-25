/**
 * @jest-environment node
 *
 * Gateway Sessions, History, and Message API Tests
 * Tests real WebSocket-backed handlers for sessions, history, and messaging
 */

// --- Mocks must be at top, before any imports ---
jest.mock('convex/browser');
jest.mock('@/services/gatewayRpc', () => ({
  connect: jest.fn(),
  call: jest.fn(),
  ping: jest.fn(),
}));
jest.mock('@/convex/_generated/api', () => ({
  api: {
    gateways: {
      getById: 'gateways:getById',
    },
  },
}));

import { ConvexHttpClient } from 'convex/browser';
import { connect, call } from '@/services/gatewayRpc';

const mockConnect = connect as jest.Mock;
const mockCall = call as jest.Mock;
const MockConvexHttpClient = ConvexHttpClient as jest.MockedClass<typeof ConvexHttpClient>;
const mockQuery = jest.fn();
const mockWs = { close: jest.fn() };

const GATEWAY_CONFIG = {
  _id: 'gateway_123',
  name: 'Test Gateway',
  url: 'wss://test.gateway.example.com',
  token: 'tok_abc',
  disableDevicePairing: true,
  allowInsecureTls: false,
  workspaceRoot: '/workspace',
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_CONVEX_URL = 'https://test.convex.cloud';
  MockConvexHttpClient.mockImplementation(() => ({
    query: mockQuery,
    mutation: jest.fn(),
  }) as any);
  mockConnect.mockResolvedValue(mockWs);
  mockQuery.mockResolvedValue(GATEWAY_CONFIG);
});

describe('GET ?action=sessions', () => {
  function makeSessionsRequest(gatewayId: string): Request {
    return new Request(
      `http://localhost/api/gateway/${gatewayId}?action=sessions`
    );
  }

  it('calls connect() with gateway url, token, disableDevicePairing, allowInsecureTls', async () => {
    const { GET } = await import('../route');
    mockCall.mockResolvedValue({ sessions: [] });

    await GET(makeSessionsRequest('gateway_123'), {
      params: Promise.resolve({ gatewayId: 'gateway_123' }),
    });

    expect(mockConnect).toHaveBeenCalledWith({
      url: GATEWAY_CONFIG.url,
      token: GATEWAY_CONFIG.token,
      disableDevicePairing: GATEWAY_CONFIG.disableDevicePairing,
      allowInsecureTls: GATEWAY_CONFIG.allowInsecureTls,
    });
  });

  it('calls call(ws, "sessions.list", {})', async () => {
    const { GET } = await import('../route');
    mockCall.mockResolvedValue({ sessions: [] });

    await GET(makeSessionsRequest('gateway_123'), {
      params: Promise.resolve({ gatewayId: 'gateway_123' }),
    });

    expect(mockCall).toHaveBeenCalledWith(mockWs, 'sessions.list', {});
  });

  it('maps gateway response to { sessions: [{ key, label, lastActivity? }] }', async () => {
    const { GET } = await import('../route');
    mockCall.mockResolvedValue({
      sessions: [
        { key: 's1', label: 'Main', lastActivity: 1700000000000 },
        { key: 's2', label: 'Backup' },
      ],
    });

    const res = await GET(makeSessionsRequest('gateway_123'), {
      params: Promise.resolve({ gatewayId: 'gateway_123' }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.sessions).toHaveLength(2);
    expect(data.sessions[0]).toEqual({
      key: 's1',
      label: 'Main',
      lastActivity: 1700000000000,
    });
    expect(data.sessions[1]).toMatchObject({ key: 's2', label: 'Backup' });
  });

  it('closes ws after successful call', async () => {
    const { GET } = await import('../route');
    mockCall.mockResolvedValue({ sessions: [] });

    await GET(makeSessionsRequest('gateway_123'), {
      params: Promise.resolve({ gatewayId: 'gateway_123' }),
    });

    expect(mockWs.close).toHaveBeenCalledTimes(1);
  });

  it('closes ws even when call() throws', async () => {
    const { GET } = await import('../route');
    mockCall.mockRejectedValue(new Error('RPC call timeout: sessions.list'));

    const res = await GET(makeSessionsRequest('gateway_123'), {
      params: Promise.resolve({ gatewayId: 'gateway_123' }),
    });

    expect(res.status).toBe(500);
    expect(mockWs.close).toHaveBeenCalledTimes(1);
  });

  it('returns 404 when gateway not found in Convex', async () => {
    const { GET } = await import('../route');
    mockQuery.mockResolvedValue(null);

    const res = await GET(makeSessionsRequest('gateway_123'), {
      params: Promise.resolve({ gatewayId: 'gateway_123' }),
    });

    expect(res.status).toBe(404);
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('returns 500 when connect() throws (gateway offline)', async () => {
    const { GET } = await import('../route');
    mockConnect.mockRejectedValue(new Error('Gateway connection timeout'));

    const res = await GET(makeSessionsRequest('gateway_123'), {
      params: Promise.resolve({ gatewayId: 'gateway_123' }),
    });

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain('Gateway connection timeout');
    // ws was never opened so close should not be called
    expect(mockWs.close).not.toHaveBeenCalled();
  });

  it('returns 500 when call() throws (RPC error)', async () => {
    const { GET } = await import('../route');
    mockCall.mockRejectedValue(new Error('Method not found: sessions.list'));

    const res = await GET(makeSessionsRequest('gateway_123'), {
      params: Promise.resolve({ gatewayId: 'gateway_123' }),
    });

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it('handles empty sessions list from gateway', async () => {
    const { GET } = await import('../route');
    mockCall.mockResolvedValue({ sessions: [] });

    const res = await GET(makeSessionsRequest('gateway_123'), {
      params: Promise.resolve({ gatewayId: 'gateway_123' }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.sessions).toEqual([]);
  });
});

describe('GET ?action=history', () => {
  function makeHistoryRequest(gatewayId: string, sessionKey: string): Request {
    return new Request(
      `http://localhost/api/gateway/${gatewayId}?action=history&sessionKey=${sessionKey}`
    );
  }

  it('calls call(ws, "chat.history", { sessionKey })', async () => {
    const { GET } = await import('../route');
    mockCall.mockResolvedValue({ history: [] });

    await GET(makeHistoryRequest('gateway_123', 'session-main'), {
      params: Promise.resolve({ gatewayId: 'gateway_123' }),
    });

    expect(mockCall).toHaveBeenCalledWith(
      mockWs,
      'chat.history',
      { sessionKey: 'session-main' }
    );
  });

  it('maps gateway history response to HistoryEntry[]', async () => {
    const { GET } = await import('../route');
    mockCall.mockResolvedValue({
      history: [
        { type: 'received', content: 'Hello', timestamp: 1700000000000 },
        { type: 'sent', content: 'Hi', timestamp: 1700000001000 },
      ],
    });

    const res = await GET(makeHistoryRequest('gateway_123', 'session-main'), {
      params: Promise.resolve({ gatewayId: 'gateway_123' }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.history).toHaveLength(2);
    expect(data.history[0]).toEqual({
      type: 'received',
      content: 'Hello',
      timestamp: 1700000000000,
    });
  });

  it('closes ws after call', async () => {
    const { GET } = await import('../route');
    mockCall.mockResolvedValue({ history: [] });

    await GET(makeHistoryRequest('gateway_123', 'session-main'), {
      params: Promise.resolve({ gatewayId: 'gateway_123' }),
    });

    expect(mockWs.close).toHaveBeenCalledTimes(1);
  });

  it('returns 400 when sessionKey is missing', async () => {
    const { GET } = await import('../route');

    const res = await GET(
      new Request('http://localhost/api/gateway/gateway_123?action=history'),
      { params: Promise.resolve({ gatewayId: 'gateway_123' }) }
    );

    expect(res.status).toBe(400);
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('returns 500 when connect() throws', async () => {
    const { GET } = await import('../route');
    mockConnect.mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await GET(makeHistoryRequest('gateway_123', 'session-main'), {
      params: Promise.resolve({ gatewayId: 'gateway_123' }),
    });

    expect(res.status).toBe(500);
  });
});

describe('POST ?action=message', () => {
  function makeMessageRequest(
    gatewayId: string,
    body: object
  ): Request {
    return new Request(
      `http://localhost/api/gateway/${gatewayId}?action=message`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
  }

  it('calls call(ws, "chat.send", { sessionKey, message: content })', async () => {
    const { POST } = await import('../route');
    mockCall.mockResolvedValue({ ok: true });

    await POST(
      makeMessageRequest('gateway_123', {
        sessionKey: 'session-main',
        content: 'Deploy to production',
      }),
      { params: Promise.resolve({ gatewayId: 'gateway_123' }) }
    );

    expect(mockCall).toHaveBeenCalledWith(mockWs, 'chat.send', {
      sessionKey: 'session-main',
      message: 'Deploy to production',
    });
  });

  it('returns { ok: true } on success', async () => {
    const { POST } = await import('../route');
    mockCall.mockResolvedValue({ ok: true });

    const res = await POST(
      makeMessageRequest('gateway_123', {
        sessionKey: 'session-main',
        content: 'Hello',
      }),
      { params: Promise.resolve({ gatewayId: 'gateway_123' }) }
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it('closes ws after successful send', async () => {
    const { POST } = await import('../route');
    mockCall.mockResolvedValue({ ok: true });

    await POST(
      makeMessageRequest('gateway_123', {
        sessionKey: 'session-main',
        content: 'Hello',
      }),
      { params: Promise.resolve({ gatewayId: 'gateway_123' }) }
    );

    expect(mockWs.close).toHaveBeenCalledTimes(1);
  });

  it('closes ws even when call() throws', async () => {
    const { POST } = await import('../route');
    mockCall.mockRejectedValue(new Error('RPC call timeout: chat.send'));

    const res = await POST(
      makeMessageRequest('gateway_123', {
        sessionKey: 'session-main',
        content: 'Hello',
      }),
      { params: Promise.resolve({ gatewayId: 'gateway_123' }) }
    );

    expect(res.status).toBe(500);
    expect(mockWs.close).toHaveBeenCalledTimes(1);
  });

  it('returns 400 when sessionKey is missing', async () => {
    const { POST } = await import('../route');

    const res = await POST(
      makeMessageRequest('gateway_123', { content: 'Hello' }),
      { params: Promise.resolve({ gatewayId: 'gateway_123' }) }
    );

    expect(res.status).toBe(400);
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('returns 400 when content is missing', async () => {
    const { POST } = await import('../route');

    const res = await POST(
      makeMessageRequest('gateway_123', { sessionKey: 'session-main' }),
      { params: Promise.resolve({ gatewayId: 'gateway_123' }) }
    );

    expect(res.status).toBe(400);
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('returns 404 when gateway not found', async () => {
    const { POST } = await import('../route');
    mockQuery.mockResolvedValue(null);

    const res = await POST(
      makeMessageRequest('gateway_123', {
        sessionKey: 'session-main',
        content: 'Hello',
      }),
      { params: Promise.resolve({ gatewayId: 'gateway_123' }) }
    );

    expect(res.status).toBe(404);
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('returns 500 when connect() throws (gateway offline)', async () => {
    const { POST } = await import('../route');
    mockConnect.mockRejectedValue(new Error('Gateway connection timeout'));

    const res = await POST(
      makeMessageRequest('gateway_123', {
        sessionKey: 'session-main',
        content: 'Hello',
      }),
      { params: Promise.resolve({ gatewayId: 'gateway_123' }) }
    );

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain('Gateway connection timeout');
  });
});
