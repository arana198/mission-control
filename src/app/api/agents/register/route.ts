/**
 * POST /api/agents/register
 *
 * Agent self-registration endpoint.
 * Creates a new agent or returns existing agent with API key.
 *
 * Request: RegisterAgentInput
 * Response: { agentId, apiKey, isNew }
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import {
  RegisterAgentSchema,
  validateAgentInput,
} from "@/lib/validators/agentValidators";
import {
  successResponse,
  handleApiError,
  jsonResponse,
} from "@/lib/utils/apiResponse";
import { createLogger } from "@/lib/utils/logger";

const log = createLogger("api:agents:register");

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

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

    // Generate apiKey in the route layer (crypto available in Next.js)
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
