/**
 * @jest-environment node
 *
 * Gateway Provision API Tests
 * Tests real agent provisioning via WebSocket
 */

jest.mock('convex/browser');
jest.mock('@/services/gatewayRpc', () => ({
  connect: jest.fn(),
  call: jest.fn(),
  ping: jest.fn(),
}));
jest.mock('@/services/agentProvisioning', () => ({
  provisionAgent: jest.fn(),
  getSessionKey: jest.fn(),
  getAgentKey: jest.fn(),
}));
jest.mock('@/convex/_generated/api', () => ({
  api: {
    gateways: {
      getById: 'gateways:getById',
    },
  },
}));

import { ConvexHttpClient } from 'convex/browser';
import { connect } from '@/services/gatewayRpc';
import { provisionAgent, getSessionKey } from '@/services/agentProvisioning';

const mockConnect = connect as jest.Mock;
const mockProvisionAgent = provisionAgent as jest.Mock;
const mockGetSessionKey = getSessionKey as jest.Mock;
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

const VALID_PROVISION_BODY = {
  agent: {
    _id: 'agent_abc',
    name: 'Jarvis',
    role: 'Engineer',
    level: 2,
    isBoardLead: false,
    isGatewayMain: false,
  },
  business: {
    _id: 'biz_xyz',
    name: 'Acme Corp',
    slug: 'acme-corp',
  },
  otherAgents: [
    { _id: 'agent_def', name: 'Atlas', role: 'Planner' },
  ],
  baseUrl: 'https://mission-control.example.com',
  authToken: 'auth_token_123',
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
  mockProvisionAgent.mockResolvedValue(undefined);
  mockGetSessionKey.mockReturnValue('board-agent-agent_abc');
});

function makeProvisionRequest(gatewayId: string, body: object): Request {
  return new Request(
    `http://localhost/api/gateway/${gatewayId}?action=provision`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
}

describe('POST ?action=provision', () => {
  it('calls connect() with gateway config', async () => {
    const { POST } = await import('../route');

    await POST(
      makeProvisionRequest('gateway_123', VALID_PROVISION_BODY),
      { params: Promise.resolve({ gatewayId: 'gateway_123' }) }
    );

    expect(mockConnect).toHaveBeenCalledWith({
      url: GATEWAY_CONFIG.url,
      token: GATEWAY_CONFIG.token,
      disableDevicePairing: GATEWAY_CONFIG.disableDevicePairing,
      allowInsecureTls: GATEWAY_CONFIG.allowInsecureTls,
    });
  });

  it('calls provisionAgent(ws, { gatewayId, agent, business, otherAgents, baseUrl, authToken })', async () => {
    const { POST } = await import('../route');

    await POST(
      makeProvisionRequest('gateway_123', VALID_PROVISION_BODY),
      { params: Promise.resolve({ gatewayId: 'gateway_123' }) }
    );

    expect(mockProvisionAgent).toHaveBeenCalledWith(mockWs, {
      gatewayId: 'gateway_123',
      agent: VALID_PROVISION_BODY.agent,
      business: VALID_PROVISION_BODY.business,
      otherAgents: VALID_PROVISION_BODY.otherAgents,
      baseUrl: VALID_PROVISION_BODY.baseUrl,
      authToken: VALID_PROVISION_BODY.authToken,
    });
  });

  it('returns 200 with sessionKey on success', async () => {
    const { POST } = await import('../route');
    mockGetSessionKey.mockReturnValue('board-agent-agent_abc');

    const res = await POST(
      makeProvisionRequest('gateway_123', VALID_PROVISION_BODY),
      { params: Promise.resolve({ gatewayId: 'gateway_123' }) }
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.sessionKey).toBeDefined();
    expect(typeof data.sessionKey).toBe('string');
  });

  it('closes ws after successful provision', async () => {
    const { POST } = await import('../route');

    await POST(
      makeProvisionRequest('gateway_123', VALID_PROVISION_BODY),
      { params: Promise.resolve({ gatewayId: 'gateway_123' }) }
    );

    expect(mockWs.close).toHaveBeenCalledTimes(1);
  });

  it('closes ws even when provisionAgent() throws', async () => {
    const { POST } = await import('../route');
    mockProvisionAgent.mockRejectedValue(
      new Error('Failed to provision agent jarvis-agent_abc: RPC error')
    );

    const res = await POST(
      makeProvisionRequest('gateway_123', VALID_PROVISION_BODY),
      { params: Promise.resolve({ gatewayId: 'gateway_123' }) }
    );

    expect(res.status).toBe(500);
    expect(mockWs.close).toHaveBeenCalledTimes(1);
  });

  it('returns 400 when agent is missing from body', async () => {
    const { POST } = await import('../route');
    const { agent, ...bodyWithoutAgent } = VALID_PROVISION_BODY;

    const res = await POST(
      makeProvisionRequest('gateway_123', bodyWithoutAgent),
      { params: Promise.resolve({ gatewayId: 'gateway_123' }) }
    );

    expect(res.status).toBe(400);
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('returns 400 when agent._id is missing', async () => {
    const { POST } = await import('../route');
    const body = { ...VALID_PROVISION_BODY, agent: { ...VALID_PROVISION_BODY.agent, _id: undefined } };

    const res = await POST(
      makeProvisionRequest('gateway_123', body),
      { params: Promise.resolve({ gatewayId: 'gateway_123' }) }
    );

    expect(res.status).toBe(400);
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('returns 400 when agent.name is missing', async () => {
    const { POST } = await import('../route');
    const body = { ...VALID_PROVISION_BODY, agent: { ...VALID_PROVISION_BODY.agent, name: undefined } };

    const res = await POST(
      makeProvisionRequest('gateway_123', body),
      { params: Promise.resolve({ gatewayId: 'gateway_123' }) }
    );

    expect(res.status).toBe(400);
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('returns 400 when agent.role is missing', async () => {
    const { POST } = await import('../route');
    const body = { ...VALID_PROVISION_BODY, agent: { ...VALID_PROVISION_BODY.agent, role: undefined } };

    const res = await POST(
      makeProvisionRequest('gateway_123', body),
      { params: Promise.resolve({ gatewayId: 'gateway_123' }) }
    );

    expect(res.status).toBe(400);
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('returns 400 when business is missing from body', async () => {
    const { POST } = await import('../route');
    const { business, ...bodyWithoutBusiness } = VALID_PROVISION_BODY;

    const res = await POST(
      makeProvisionRequest('gateway_123', bodyWithoutBusiness),
      { params: Promise.resolve({ gatewayId: 'gateway_123' }) }
    );

    expect(res.status).toBe(400);
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('returns 400 when business._id is missing', async () => {
    const { POST } = await import('../route');
    const body = { ...VALID_PROVISION_BODY, business: { ...VALID_PROVISION_BODY.business, _id: undefined } };

    const res = await POST(
      makeProvisionRequest('gateway_123', body),
      { params: Promise.resolve({ gatewayId: 'gateway_123' }) }
    );

    expect(res.status).toBe(400);
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('returns 400 when business.name is missing', async () => {
    const { POST } = await import('../route');
    const body = { ...VALID_PROVISION_BODY, business: { ...VALID_PROVISION_BODY.business, name: undefined } };

    const res = await POST(
      makeProvisionRequest('gateway_123', body),
      { params: Promise.resolve({ gatewayId: 'gateway_123' }) }
    );

    expect(res.status).toBe(400);
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('returns 400 when business.slug is missing', async () => {
    const { POST } = await import('../route');
    const body = { ...VALID_PROVISION_BODY, business: { ...VALID_PROVISION_BODY.business, slug: undefined } };

    const res = await POST(
      makeProvisionRequest('gateway_123', body),
      { params: Promise.resolve({ gatewayId: 'gateway_123' }) }
    );

    expect(res.status).toBe(400);
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('returns 400 when baseUrl is missing from body', async () => {
    const { POST } = await import('../route');
    const { baseUrl, ...bodyWithoutBaseUrl } = VALID_PROVISION_BODY;

    const res = await POST(
      makeProvisionRequest('gateway_123', bodyWithoutBaseUrl),
      { params: Promise.resolve({ gatewayId: 'gateway_123' }) }
    );

    expect(res.status).toBe(400);
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('returns 404 when gateway not found in Convex', async () => {
    const { POST } = await import('../route');
    mockQuery.mockResolvedValue(null);

    const res = await POST(
      makeProvisionRequest('gateway_123', VALID_PROVISION_BODY),
      { params: Promise.resolve({ gatewayId: 'gateway_123' }) }
    );

    expect(res.status).toBe(404);
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('returns 500 when connect() throws (gateway offline)', async () => {
    const { POST } = await import('../route');
    mockConnect.mockRejectedValue(new Error('Gateway connection timeout'));

    const res = await POST(
      makeProvisionRequest('gateway_123', VALID_PROVISION_BODY),
      { params: Promise.resolve({ gatewayId: 'gateway_123' }) }
    );

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain('Gateway connection timeout');
    expect(mockWs.close).not.toHaveBeenCalled();
  });

  it('returns 500 on provisioning failure with error message', async () => {
    const { POST } = await import('../route');
    mockProvisionAgent.mockRejectedValue(
      new Error('Failed to provision agent jarvis-abc123: Method not found')
    );

    const res = await POST(
      makeProvisionRequest('gateway_123', VALID_PROVISION_BODY),
      { params: Promise.resolve({ gatewayId: 'gateway_123' }) }
    );

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it('handles missing otherAgents by defaulting to empty array', async () => {
    const { POST } = await import('../route');
    const { otherAgents, ...bodyWithoutOthers } = VALID_PROVISION_BODY;

    await POST(
      makeProvisionRequest('gateway_123', bodyWithoutOthers),
      { params: Promise.resolve({ gatewayId: 'gateway_123' }) }
    );

    expect(mockProvisionAgent).toHaveBeenCalledWith(
      mockWs,
      expect.objectContaining({ otherAgents: [] })
    );
  });

  it('handles missing authToken by defaulting to empty string', async () => {
    const { POST } = await import('../route');
    const { authToken, ...bodyWithoutAuthToken } = VALID_PROVISION_BODY;

    await POST(
      makeProvisionRequest('gateway_123', bodyWithoutAuthToken),
      { params: Promise.resolve({ gatewayId: 'gateway_123' }) }
    );

    expect(mockProvisionAgent).toHaveBeenCalledWith(
      mockWs,
      expect.objectContaining({ authToken: '' })
    );
  });
});
