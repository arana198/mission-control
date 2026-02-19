/**
 * PUT /api/agents/{agentId}
 *
 * Agent self-service endpoint to update their own details (idempotent).
 * Supports partial updates - only provided fields are updated.
 * Requires authentication via API key in Authorization header or body.
 *
 * Updateable fields:
 * - workspacePath: The agent's workspace directory
 * - model: The LLM model identifier
 * - personality: The agent's personality description
 * - capabilities: Array of capability strings
 *
 * Idempotency: Multiple identical requests produce the same result.
 * Safe to retry without side effects.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { jsonResponse, successResponse, handleApiError } from "@/lib/utils/apiResponse";
import { createLogger } from "@/lib/utils/logger";
import { UpdateAgentSchema, validateAgentInput } from "@/lib/validators/agentValidators";

const log = createLogger("api:agents:update");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function PUT(
  request: Request,
  context: any
): Promise<Response> {
  const { params } = context;
  try {
    const { agentId } = params;
    const body = await request.json().catch(() => ({}));

    // Extract apiKey from Authorization header or body
    let apiKey = body.apiKey;
    if (!apiKey) {
      const authHeader = request.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        apiKey = authHeader.slice(7);
      }
    }

    // Validate input - throws ZodError on failure
    const input = validateAgentInput(UpdateAgentSchema, {
      agentId,
      apiKey,
      workspacePath: body.workspacePath,
      model: body.model,
      personality: body.personality,
      capabilities: body.capabilities,
    });

    const { workspacePath, model, personality, capabilities } = input;

    log.info("Updating agent details", {
      agentId,
      fields: Object.keys({
        ...(workspacePath && { workspacePath }),
        ...(model && { model }),
        ...(personality && { personality }),
        ...(capabilities && { capabilities }),
      }),
    });

    // Call Convex mutation
    const result = await convex.mutation(api.agents.updateDetails, {
      agentId: agentId as any,
      apiKey,
      workspacePath,
      model,
      personality,
      capabilities,
    });

    if (!result.success || !result.agent) {
      log.error("Update failed", { agentId, error: result });
      return jsonResponse(
        {
          success: false,
          error: {
            code: "UPDATE_FAILED",
            message: "Failed to update agent details",
          },
        },
        500
      );
    }

    log.info("Agent details updated successfully", {
      agentId,
      updated: result.updated,
      updatedFields: result.updatedFields,
    });

    return jsonResponse(
      successResponse({
        agentId: result.agent._id,
        agentName: result.agent.name,
        updated: result.updated,
        updatedFields: result.updatedFields || [],
        agent: {
          name: result.agent.name,
          role: result.agent.role,
          level: result.agent.level,
          workspacePath: result.agent.workspacePath,
          model: result.agent.model,
          personality: result.agent.personality,
          capabilities: result.agent.capabilities,
          status: result.agent.status,
        },
      }),
      200
    );
  } catch (error) {
    // Handle specific agent-related errors
    if (error instanceof Error) {
      if (error.message.includes("Invalid credentials")) {
        log.warn("Authentication failed", { error: error.message });
        return jsonResponse(
          {
            success: false,
            error: {
              code: "AUTHENTICATION_ERROR",
              message: "Invalid API key or agent ID",
            },
          },
          401
        );
      }

      if (error.message.includes("Agent not found")) {
        log.warn("Agent not found", { error: error.message });
        return jsonResponse(
          {
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "Agent not found",
            },
          },
          404
        );
      }
    }

    // Use general API error handler for validation and other errors
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}
