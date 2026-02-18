/**
 * GET /api/agents/list
 *
 * Get list of all agents for @ mentions in comments
 * Used to populate agent mention suggestions in task comments
 *
 * Request: { agentId, agentKey }
 * Response: { agents: [] } with basic info for each agent
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { verifyAgent } from "@/lib/agent-auth";
import {
  successResponse,
  handleApiError,
  jsonResponse,
  UnauthorizedError,
} from "@/lib/utils/apiResponse";
import { PollAgentSchema, validateAgentInput } from "@/lib/validators/agentValidators";
import { createLogger } from "@/lib/utils/logger";

const log = createLogger("api:agents:list");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(request: Request): Promise<Response> {
  try {
    // Parse query params
    const url = new URL(request.url);
    const agentId = url.searchParams.get("agentId");
    const agentKey = url.searchParams.get("agentKey");

    if (!agentId || !agentKey) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Missing agentId or agentKey",
          },
        },
        400
      );
    }

    // Validate credentials
    const agent = await verifyAgent(agentId, agentKey);
    if (!agent) {
      throw new UnauthorizedError("Invalid agent credentials");
    }

    // Get all agents
    const agents = await convex.query(api.agents.getAllAgents);

    // Return sanitized agent list for mentions
    const agentList = agents.map((a: any) => ({
      id: a._id,
      name: a.name,
      role: a.role,
      level: a.level,
      status: a.status,
    }));

    log.info("Agents list requested", { agentId: agentId, count: agentList.length });

    return jsonResponse(
      successResponse({
        agents: agentList,
      })
    );
  } catch (error) {
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}
