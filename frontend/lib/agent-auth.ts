/**
 * Agent Authentication Utility
 * Verifies agentId + apiKey against Convex
 * Used by all /api/agents/* route handlers
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { createLogger } from "@/lib/utils/logger";

const log = createLogger("agent-auth");

// Convex client singleton — reused across requests in same process
let _convex: ConvexHttpClient | null = null;

function getConvex(): ConvexHttpClient {
  if (!_convex) {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      throw new Error("NEXT_PUBLIC_CONVEX_URL not set");
    }
    _convex = new ConvexHttpClient(url);
  }
  return _convex;
}

export interface VerifiedAgent {
  _id: string;
  name: string;
  role: string;
  status: "idle" | "active" | "blocked";
  level: "lead" | "specialist" | "intern";
  currentTaskId?: string;
  sessionKey: string;
  apiKey: string;
  lastHeartbeat: number;
  workspacePath: string;
  capabilities?: string[];
  model?: string;
  personality?: string;
}

/**
 * Verify agentId + apiKey pair against Convex.
 * Supports both current key and grace-period keys during rotation.
 * Returns the agent document on success, null on failure.
 * Logs auth failures for audit purposes.
 */
export async function verifyAgent(
  agentId: string,
  apiKey: string
): Promise<VerifiedAgent | null> {
  try {
    const convex = getConvex();

    // Use grace-period aware verification
    const agent = await convex.query((api as any).agents.verifyKeyWithGrace, {
      agentId: agentId as Id<"agents">,
      apiKey,
    });

    if (!agent) {
      log.warn("Agent auth failed", { agentId, reason: "invalid_credentials" });
      return null;
    }

    return agent as VerifiedAgent;
  } catch (err) {
    log.error("Agent auth error", err, { agentId });
    return null;
  }
}
