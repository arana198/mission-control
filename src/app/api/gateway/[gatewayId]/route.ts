import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { connect, call } from "@/services/gatewayRpc";
import { provisionAgent } from "@/services/agentProvisioning";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "";
if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL not set");
}

const client = new ConvexHttpClient(convexUrl);

/**
 * Gateway API Bridge
 * Handles short-lived WebSocket connections to gateway daemons
 *
 * Endpoints:
 * GET  ?action=status          → { connected, sessions }
 * GET  ?action=sessions        → list sessions
 * GET  ?action=history&session=X → chat history
 * POST { action: "message", sessionKey, content }
 * POST { action: "provision", agentData }
 * POST { action: "sync" }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gatewayId: string }> }
) {
  try {
    const { gatewayId } = await params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    // Get gateway config by calling the function directly
    const gateway = await client.query("gateways:getById" as any, { gatewayId });
    if (!gateway) {
      return NextResponse.json({ error: "Gateway not found" }, { status: 404 });
    }

    // Connect to gateway
    const ws = await connect({
      url: gateway.url,
      token: gateway.token,
      disableDevicePairing: gateway.disableDevicePairing,
      allowInsecureTls: gateway.allowInsecureTls,
    });

    try {
      if (action === "status") {
        const health = await call(ws, "health");
        return NextResponse.json({
          connected: true,
          health,
        });
      }

      if (action === "sessions") {
        const sessions = await call(ws, "sessions.list");
        return NextResponse.json({
          sessions,
        });
      }

      if (action === "history") {
        const sessionKey = searchParams.get("session");
        if (!sessionKey) {
          return NextResponse.json({ error: "Missing session parameter" }, { status: 400 });
        }

        const history = await call(ws, "chat.history", {
          sessionKey,
          limit: 50,
        });

        return NextResponse.json({
          sessionKey,
          messages: history,
        });
      }

      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    } finally {
      ws.close();
    }
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * POST handler for mutations (message, provision, sync)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gatewayId: string }> }
) {
  try {
    const { gatewayId } = await params;
    const body = await request.json();
    const { action } = body;

    // Get gateway config by calling the function directly
    const gateway = await client.query("gateways:getById" as any, { gatewayId });
    if (!gateway) {
      return NextResponse.json({ error: "Gateway not found" }, { status: 404 });
    }

    // Connect to gateway
    const ws = await connect({
      url: gateway.url,
      token: gateway.token,
      disableDevicePairing: gateway.disableDevicePairing,
      allowInsecureTls: gateway.allowInsecureTls,
    });

    try {
      if (action === "message") {
        const { sessionKey, content } = body;
        if (!sessionKey || !content) {
          return NextResponse.json(
            { error: "Missing sessionKey or content" },
            { status: 400 }
          );
        }

        const result = await call(ws, "chat.send", {
          sessionKey,
          message: content,
        });

        return NextResponse.json({
          ok: true,
          messageId: result?.id,
        });
      }

      if (action === "provision") {
        const { agent, business, otherAgents, baseUrl, authToken } = body;
        if (!agent || !business) {
          return NextResponse.json(
            { error: "Missing agent or business" },
            { status: 400 }
          );
        }

        await provisionAgent(ws, {
          gatewayId: gatewayId as any,
          agent,
          business,
          otherAgents: otherAgents || [],
          baseUrl: baseUrl || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          authToken: authToken || "",
        });

        return NextResponse.json({
          ok: true,
          message: `Agent ${agent.name} provisioned`,
        });
      }

      if (action === "sync") {
        // Sync all agent templates
        // In production, this would fetch all agents and re-provision
        return NextResponse.json({
          ok: true,
          message: "Sync initiated",
        });
      }

      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    } finally {
      ws.close();
    }
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
