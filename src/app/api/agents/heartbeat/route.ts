/**
 * POST /api/agents/heartbeat
 *
 * Lightweight heartbeat endpoint.
 * Updates lastHeartbeat + optional status.
 *
 * Request: HeartbeatInput
 * Response: { success, serverTime }
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  HeartbeatSchema,
  validateAgentInput,
} from "@/lib/validators/agentValidators";
import { verifyAgent } from "@/lib/agent-auth";
import {
  successResponse,
  handleApiError,
  jsonResponse,
  UnauthorizedError,
} from "@/lib/utils/apiResponse";
import { createLogger } from "@/lib/utils/logger";

const log = createLogger("api:agents:heartbeat");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return jsonResponse(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid JSON" },
        },
        400
      );
    }

    const input = validateAgentInput(HeartbeatSchema, body);

    // Verify credentials
    const agent = await verifyAgent(input.agentId, input.agentKey);
    if (!agent) {
      throw new UnauthorizedError("Invalid agent credentials");
    }

    const agentId = input.agentId as Id<"agents">;

    // Update heartbeat
    await convex.mutation(api.agents.heartbeat, {
      agentId,
      currentTaskId: input.currentTaskId as Id<"tasks"> | undefined,
    });

    // Optionally update status
    if (input.status) {
      await convex.mutation(api.agents.updateStatus, {
        id: agentId,
        status: input.status,
        currentTaskId: input.currentTaskId as Id<"tasks"> | undefined,
      });
    }

    log.info("Agent heartbeat received", {
      agentId: input.agentId,
      agentName: agent.name,
      status: input.status,
    });

    return jsonResponse(
      successResponse({
        success: true,
        serverTime: Date.now(),
      })
    );
  } catch (error) {
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}
