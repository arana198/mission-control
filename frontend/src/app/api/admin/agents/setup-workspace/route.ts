/**
 * POST /api/admin/agents/setup-workspace
 *
 * Setup workspace paths for agents
 * Updates agent by name with workspace path
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { jsonResponse } from "@/lib/utils/apiResponse";
import { createLogger } from "@/lib/utils/logger";

const log = createLogger("api:admin:agents:setup-workspace");

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({}));
    const { agentName, workspacePath } = body;

    if (!agentName || !workspacePath) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "agentName and workspacePath are required",
          },
        },
        400
      );
    }

    log.info("Setting up workspace for agent", { agentName, workspacePath });

    // Get all agents and find the one to update
    const agents = await convex.query(api.agents.getAllAgents);
    const agent = agents.find(
      (a) => a.name.toLowerCase() === agentName.toLowerCase()
    );

    if (!agent) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: `Agent not found: ${agentName}`,
          },
        },
        404
      );
    }

    // Update agent with workspace path
    // We'll need to use updateName mutation as a workaround since there's no direct update
    // Actually, let's just call the register mutation which can update existing agents
    const result = await convex.mutation(api.agents.register, {
      name: agentName,
      role: agent.role,
      level: agent.level,
      sessionKey: agent.sessionKey,
      capabilities: agent.capabilities,
      model: agent.model,
      personality: agent.personality,
      workspacePath, // This is what we're setting
      generatedApiKey: agent.apiKey || crypto.randomUUID(),
    });

    log.info("Workspace setup complete", {
      agentId: result.agentId,
      agentName,
      workspacePath,
    });

    return jsonResponse(
      {
        success: true,
        data: {
          agentId: result.agentId,
          agentName,
          workspacePath,
          message: `Successfully configured workspace for ${agentName}`,
        },
      },
      200
    );
  } catch (error) {
    log.error("Workspace setup failed", { error });
    return jsonResponse(
      {
        success: false,
        error: {
          code: "SETUP_ERROR",
          message: error instanceof Error ? error.message : "Setup failed",
        },
      },
      500
    );
  }
}
