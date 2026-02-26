/**
 * GET /api/agents
 * POST /api/agents
 *
 * RESTful agent management endpoints
 *
 * GET - List all agents (requires agentId, agentKey headers)
 * POST - Register new agent or get existing
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
import {
  RegisterAgentSchema,
  validateAgentInput,
} from "@/lib/validators/agentValidators";
import { createLogger } from "@/lib/utils/logger";

const log = createLogger("api:agents");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * GET /api/agents
 * List all agents for @mentions and squad view
 *
 * Headers:
 *   agentId: string (required)
 *   agentKey: string (required)
 *
 * Response: { agents: Array<{ id, name, role, level, status }> }
 */
export async function GET(request: Request): Promise<Response> {
  try {
    // Parse headers for authentication
    const agentId = request.headers.get("agentId");
    const agentKey = request.headers.get("agentKey");

    if (!agentId || !agentKey) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Missing agentId or agentKey headers",
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

    // Return sanitized agent list
    const agentList = agents.map((a: any) => ({
      id: a._id,
      name: a.name,
      role: a.role,
      level: a.level,
      status: a.status,
    }));

    log.info("Agents list requested", {
      agentId: agentId,
      count: agentList.length,
    });

    return jsonResponse(successResponse({ agents: agentList }));
  } catch (error) {
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}

/**
 * POST /api/agents
 * Register a new agent or get existing agent's API key
 *
 * Body:
 * {
 *   name: string
 *   role: string
 *   level: "lead" | "specialist" | "intern"
 *   sessionKey: string
 *   workspacePath: string
 *   capabilities?: string[]
 *   model?: string
 *   personality?: string
 * }
 *
 * Response: { agentId, apiKey, isNew }
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid JSON body",
          },
        },
        400
      );
    }

    // Validate input
    const input = validateAgentInput(RegisterAgentSchema, body);

    // Generate apiKey (crypto available in Next.js)
    const generatedApiKey = crypto.randomUUID();

    // Call Convex — create or get agent
    const result = await convex.mutation(api.agents.register, {
      name: input.name,
      role: input.role,
      level: input.level,
      sessionKey: input.sessionKey,
      capabilities: input.capabilities,
      model: input.model,
      personality: input.personality,
      workspacePath: input.workspacePath,
      generatedApiKey,
    });

    log.info("Agent registered", {
      agentId: result.agentId,
      isNew: result.isNew,
      name: input.name,
    });

    return jsonResponse(
      successResponse({
        agentId: result.agentId,
        apiKey: result.apiKey,
        isNew: result.isNew,
      }),
      result.isNew ? 201 : 200
    );
  } catch (error) {
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}
