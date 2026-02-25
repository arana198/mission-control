/**
 * Gateway API Endpoint
 * GET /api/gateway/[gatewayId]?action=sessions|history|status
 * POST /api/gateway/[gatewayId]?action=message|provision|sync|validate
 *
 * Handles:
 * - Fetching active sessions from a gateway
 * - Sending messages to gateway sessions
 * - Fetching message history
 * - Health checks
 * - Connection validation (WebSocket test)
 */

import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { call, ping } from '@/services/gatewayRpc';
import { gatewayPool } from '@/services/gatewayConnectionPool';
import WebSocket from 'ws';
import { provisionAgent, getSessionKey } from '@/services/agentProvisioning';

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error('NEXT_PUBLIC_CONVEX_URL not set');
}

const client = new ConvexHttpClient(convexUrl);

interface GatewaySession {
  key: string;
  label: string;
  lastActivity?: number;
  status?: 'active' | 'idle' | 'inactive';
}

interface HistoryEntry {
  type: 'sent' | 'received';
  content: string;
  timestamp: number;
}

/**
 * GET /api/gateway/[gatewayId]
 * Fetch sessions or history based on action parameter
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ gatewayId: string }> }
): Promise<Response> {
  try {
    const params = await context.params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const gatewayId = params.gatewayId;

    if (!gatewayId) {
      return new Response(
        JSON.stringify({ error: 'gatewayId required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'sessions') {
      return handleGetSessions(gatewayId);
    } else if (action === 'history') {
      const sessionKey = searchParams.get('sessionKey');
      if (!sessionKey) {
        return new Response(
          JSON.stringify({ error: 'sessionKey required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return handleGetHistory(gatewayId, sessionKey);
    } else if (action === 'status' || !action) {
      return handleGatewayStatus(gatewayId);
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Gateway API error:', error);
    return new Response(
      JSON.stringify({
        error: error?.message || 'Internal server error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * POST /api/gateway/[gatewayId]
 * Send messages or execute actions
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ gatewayId: string }> }
): Promise<Response> {
  try {
    const params = await context.params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const gatewayId = params.gatewayId;

    if (!gatewayId) {
      return new Response(
        JSON.stringify({ error: 'gatewayId required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();

    if (action === 'message') {
      return handleSendMessage(gatewayId, body);
    } else if (action === 'provision') {
      return handleProvision(gatewayId, body);
    } else if (action === 'sync') {
      return handleSync(gatewayId, body);
    } else if (action === 'validate') {
      return handleValidateConnection(gatewayId, body);
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Gateway API error:', error);
    return new Response(
      JSON.stringify({
        error: error?.message || 'Internal server error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Get active sessions for a gateway
 * Calls sessions.list RPC on the live gateway via WebSocket
 */
async function handleGetSessions(
  gatewayId: string
): Promise<Response> {
  let ws: WebSocket | undefined;
  let cacheKey: string | undefined;
  let lastError: Error | undefined;
  try {
    const gateway = await client.query(api.gateways.getWorkspaceById, {
      gatewayId: gatewayId as Id<'gateways'>,
    });

    if (!gateway) {
      return new Response(
        JSON.stringify({ error: 'Gateway not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const connectConfig = {
      url: gateway.url,
      token: gateway.token,
      disableDevicePairing: gateway.disableDevicePairing,
      allowInsecureTls: gateway.allowInsecureTls,
    };
    cacheKey = gatewayPool.buildCacheKey(gatewayId, connectConfig);
    ws = await gatewayPool.acquire(gatewayId, connectConfig);

    const result = await call(ws, 'sessions.list', {});

    // Map gateway RPC response to GatewaySession[]
    // Gateway may return { sessions: [...] } or a bare array
    const rawSessions: any[] = Array.isArray(result)
      ? result
      : (result?.sessions ?? []);

    const sessions: GatewaySession[] = rawSessions.map((s: any) => {
      // Derive status from lastActivity or use gateway-provided status
      let status: 'active' | 'idle' | 'inactive';
      if (s.status) {
        status = s.status;
      } else if (s.lastActivity) {
        const age = Date.now() - s.lastActivity;
        status = age < 5 * 60 * 1000 ? 'active' : age < 30 * 60 * 1000 ? 'idle' : 'inactive';
      } else {
        status = 'inactive';
      }

      return {
        key: s.key,
        label: s.label ?? s.name ?? s.key,
        ...(s.lastActivity !== undefined && { lastActivity: s.lastActivity }),
        status,
      };
    });

    return new Response(
      JSON.stringify({ sessions }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    lastError = error;
    return new Response(
      JSON.stringify({ error: error?.message || 'Failed to fetch sessions' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    if (ws && cacheKey) {
      // Force-evict socket if RPC timed out (call() leaves it open but degraded)
      if (lastError?.message?.includes('RPC call timeout')) {
        try { ws.terminate(); } catch { /* ignore terminate errors */ }
      }
      gatewayPool.release(ws, cacheKey);
    }
  }
}

/**
 * Get message history for a session
 * Calls chat.history RPC on the live gateway via WebSocket
 */
async function handleGetHistory(
  gatewayId: string,
  sessionKey: string
): Promise<Response> {
  let ws: WebSocket | undefined;
  let cacheKey: string | undefined;
  let lastError: Error | undefined;
  try {
    const gateway = await client.query(api.gateways.getWorkspaceById, {
      gatewayId: gatewayId as Id<'gateways'>,
    });

    if (!gateway) {
      return new Response(
        JSON.stringify({ error: 'Gateway not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const connectConfig = {
      url: gateway.url,
      token: gateway.token,
      disableDevicePairing: gateway.disableDevicePairing,
      allowInsecureTls: gateway.allowInsecureTls,
    };
    cacheKey = gatewayPool.buildCacheKey(gatewayId, connectConfig);
    ws = await gatewayPool.acquire(gatewayId, connectConfig);

    const result = await call(ws, 'chat.history', { sessionKey });

    // Normalize: gateway may return { history: [...] } or a bare array
    const rawHistory: any[] = Array.isArray(result)
      ? result
      : (result?.history ?? []);

    const history: HistoryEntry[] = rawHistory.map((h: any) => ({
      type: h.type === 'sent' ? 'sent' : 'received',
      content: h.content ?? h.message ?? '',
      timestamp: h.timestamp ?? Date.now(),
    }));

    return new Response(
      JSON.stringify({ history }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    lastError = error;
    return new Response(
      JSON.stringify({ error: error?.message || 'Failed to fetch history' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    if (ws && cacheKey) {
      // Force-evict socket if RPC timed out
      if (lastError?.message?.includes('RPC call timeout')) {
        try { ws.terminate(); } catch { /* ignore terminate errors */ }
      }
      gatewayPool.release(ws, cacheKey);
    }
  }
}

/**
 * Send a message to a gateway session
 * Calls chat.send RPC on the live gateway via WebSocket
 */
async function handleSendMessage(
  gatewayId: string,
  body: any
): Promise<Response> {
  const { sessionKey, content } = body;

  if (!sessionKey || !content) {
    return new Response(
      JSON.stringify({
        error: 'sessionKey and content required',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let ws: WebSocket | undefined;
  let cacheKey: string | undefined;
  let lastError: Error | undefined;
  try {
    const gateway = await client.query(api.gateways.getWorkspaceById, {
      gatewayId: gatewayId as Id<'gateways'>,
    });

    if (!gateway) {
      return new Response(
        JSON.stringify({ error: 'Gateway not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const connectConfig = {
      url: gateway.url,
      token: gateway.token,
      disableDevicePairing: gateway.disableDevicePairing,
      allowInsecureTls: gateway.allowInsecureTls,
    };
    cacheKey = gatewayPool.buildCacheKey(gatewayId, connectConfig);
    ws = await gatewayPool.acquire(gatewayId, connectConfig);

    // chat.send expects { sessionKey, message } per agentProvisioning.ts
    await call(ws, 'chat.send', { sessionKey, message: content });

    return new Response(
      JSON.stringify({
        ok: true,
        sessionKey,
        sentAt: Date.now(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    lastError = error;
    return new Response(
      JSON.stringify({ error: error?.message || 'Failed to send message' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    if (ws && cacheKey) {
      // Force-evict socket if RPC timed out
      if (lastError?.message?.includes('RPC call timeout')) {
        try { ws.terminate(); } catch { /* ignore terminate errors */ }
      }
      gatewayPool.release(ws, cacheKey);
    }
  }
}

/**
 * Get gateway status / health
 * Pings the gateway and writes health status back to database
 */
async function handleGatewayStatus(gatewayId: string): Promise<Response> {
  try {
    // 1. Load gateway from Convex
    const gateway = await client.query(api.gateways.getWorkspaceById, {
      gatewayId: gatewayId as Id<'gateways'>,
    });

    if (!gateway) {
      return new Response(
        JSON.stringify({ error: 'Gateway not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Ping the gateway to check connectivity
    const pingResult = await ping(
      gateway.url,
      gateway.token,
      gateway.allowInsecureTls,
      5000
    );

    // 3. Write result back to database
    await client.mutation(api.gateways.updateHealthStatus, {
      gatewayId: gatewayId as Id<'gateways'>,
      isHealthy: pingResult.success,
    });

    // 4. Return comprehensive status response
    const response: any = {
      gatewayId,
      name: gateway.name,
      url: gateway.url,
      isHealthy: pingResult.success,
      latencyMs: pingResult.latencyMs,
      lastChecked: Date.now(),
    };

    // Include error message if ping failed
    if (!pingResult.success && pingResult.error) {
      response.error = pingResult.error;
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: error?.message || 'Failed to check gateway status',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Provision (setup) an agent on a gateway session
 * Calls provisionAgent() which executes a 7-step RPC sequence
 */
async function handleProvision(
  gatewayId: string,
  body: any
): Promise<Response> {
  const { agent, workspace, otherAgents, baseUrl, authToken } = body;

  // Validate required fields
  if (!agent || !agent._id || !agent.name || !agent.role) {
    return new Response(
      JSON.stringify({ error: 'agent with _id, name, and role is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (!workspace || !workspace._id || !workspace.name || !workspace.slug) {
    return new Response(
      JSON.stringify({ error: 'workspace with _id, name, and slug is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (!baseUrl) {
    return new Response(
      JSON.stringify({ error: 'baseUrl is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let ws: WebSocket | undefined;
  let cacheKey: string | undefined;
  let lastError: Error | undefined;
  try {
    const gateway = await client.query(api.gateways.getWorkspaceById, {
      gatewayId: gatewayId as Id<'gateways'>,
    });

    if (!gateway) {
      return new Response(
        JSON.stringify({ error: 'Gateway not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const connectConfig = {
      url: gateway.url,
      token: gateway.token,
      disableDevicePairing: gateway.disableDevicePairing,
      allowInsecureTls: gateway.allowInsecureTls,
    };
    cacheKey = gatewayPool.buildCacheKey(gatewayId, connectConfig);
    ws = await gatewayPool.acquire(gatewayId, connectConfig);

    await provisionAgent(ws, {
      gatewayId,
      agent,
      workspace,
      otherAgents: otherAgents ?? [],
      baseUrl,
      authToken: authToken ?? '',
    });

    // Derive the session key so the caller can address this agent's session
    const sessionKey = getSessionKey(agent, workspace._id, gatewayId);

    return new Response(
      JSON.stringify({
        ok: true,
        sessionKey,
        provisioned: true,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    lastError = error;
    return new Response(
      JSON.stringify({ error: error?.message || 'Failed to provision agent' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    if (ws && cacheKey) {
      // Force-evict socket if RPC timed out (provisionAgent can run longer but may timeout internally)
      if (lastError?.message?.includes('RPC call timeout')) {
        try { ws.terminate(); } catch { /* ignore terminate errors */ }
      }
      gatewayPool.release(ws, cacheKey);
    }
  }
}

/**
 * Sync gateway data
 */
async function handleSync(
  gatewayId: string,
  body: any
): Promise<Response> {
  try {
    const gateway = await client.query(api.gateways.getWorkspaceById, {
      gatewayId: gatewayId as Id<'gateways'>,
    });

    if (!gateway) {
      return new Response(
        JSON.stringify({ error: 'Gateway not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        synced: true,
        timestamp: Date.now(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message || 'Failed to sync' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Validate WebSocket connection
 * Uses real ping() to test connectivity to gateway
 */
async function handleValidateConnection(
  gatewayId: string,
  body: any
): Promise<Response> {
  try {
    const { url, token, allowInsecureTls } = body;

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'WebSocket URL required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate URL format
    if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid WebSocket URL: must start with ws:// or wss://',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Use real ping to test connectivity
    const result = await ping(url, token, allowInsecureTls, 5000);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Failed to validate connection',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
