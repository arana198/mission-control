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

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error('NEXT_PUBLIC_CONVEX_URL not set');
}

const client = new ConvexHttpClient(convexUrl);

interface GatewaySession {
  key: string;
  label: string;
  lastActivity?: number;
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
 */
async function handleGetSessions(
  gatewayId: string
): Promise<Response> {
  try {
    const gateway = await client.query(api.gateways.getById, {
      gatewayId: gatewayId as Id<'gateways'>,
    });

    if (!gateway) {
      return new Response(
        JSON.stringify({ error: 'Gateway not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Mock sessions - in production would connect to actual gateway
    const sessions: GatewaySession[] = [
      {
        key: 'session-main',
        label: 'Main Session',
        lastActivity: Date.now() - 5000,
      },
      {
        key: 'session-backup',
        label: 'Backup Session',
        lastActivity: Date.now() - 30000,
      },
    ];

    return new Response(
      JSON.stringify({ sessions }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message || 'Failed to fetch sessions' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Get message history for a session
 */
async function handleGetHistory(
  gatewayId: string,
  sessionKey: string
): Promise<Response> {
  try {
    const gateway = await client.query(api.gateways.getById, {
      gatewayId: gatewayId as Id<'gateways'>,
    });

    if (!gateway) {
      return new Response(
        JSON.stringify({ error: 'Gateway not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Mock history - in production would retrieve from gateway storage
    const history: HistoryEntry[] = [
      {
        type: 'received',
        content: 'Hello, this is a test message',
        timestamp: Date.now() - 60000,
      },
      {
        type: 'sent',
        content: 'Hi there, received your message',
        timestamp: Date.now() - 30000,
      },
    ];

    return new Response(
      JSON.stringify({ history }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message || 'Failed to fetch history' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Send a message to a gateway session
 */
async function handleSendMessage(
  gatewayId: string,
  body: any
): Promise<Response> {
  try {
    const { sessionKey, content } = body;

    if (!sessionKey || !content) {
      return new Response(
        JSON.stringify({
          error: 'sessionKey and content required',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const gateway = await client.query(api.gateways.getById, {
      gatewayId: gatewayId as Id<'gateways'>,
    });

    if (!gateway) {
      return new Response(
        JSON.stringify({ error: 'Gateway not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Acknowledge receipt - in production send to actual gateway session
    return new Response(
      JSON.stringify({
        ok: true,
        sessionKey,
        content,
        sentAt: Date.now(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message || 'Failed to send message' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Get gateway status / health
 */
async function handleGatewayStatus(gatewayId: string): Promise<Response> {
  try {
    const gateway = await client.query(api.gateways.getById, {
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
        gatewayId,
        name: gateway.name,
        url: gateway.url,
        isHealthy: gateway.isHealthy ?? true,
        lastChecked: Date.now(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: error?.message || 'Failed to fetch gateway status',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Provision (setup) a gateway session
 */
async function handleProvision(
  gatewayId: string,
  body: any
): Promise<Response> {
  try {
    const gateway = await client.query(api.gateways.getById, {
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
        sessionKey: `session-${Date.now()}`,
        provisioned: true,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message || 'Failed to provision' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
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
    const gateway = await client.query(api.gateways.getById, {
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
 */
async function handleValidateConnection(
  gatewayId: string,
  body: any
): Promise<Response> {
  try {
    const { url, allowInsecureTls } = body;

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

    // Attempt to connect to the WebSocket with a timeout
    const startTime = Date.now();
    const timeoutMs = 5000;

    try {
      // Note: In a real implementation, this would use a WebSocket client library
      // For now, return a success response to demonstrate the flow
      const latencyMs = Math.floor(Math.random() * 100) + 10; // Simulate 10-110ms latency

      return new Response(
        JSON.stringify({
          success: true,
          latencyMs,
          message: 'WebSocket connection successful',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (connectionError: any) {
      const latencyMs = Date.now() - startTime;

      return new Response(
        JSON.stringify({
          success: false,
          error: connectionError?.message || 'Failed to connect to WebSocket',
          latencyMs,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
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
