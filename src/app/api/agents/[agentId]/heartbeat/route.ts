/**
 * POST /api/agents/{agentId}/heartbeat
 *
 * Lightweight heartbeat endpoint.
 * Updates lastHeartbeat + optional status.
 *
 * IDEMPOTENCY: IDEMPOTENT
 * - Reason: Only updates timestamp; multiple calls with same params produce same result
 * - Safe to retry: YES
 * - Side effects on repeat: None (idempotent operation)
 *
 * Request: HeartbeatInput (agentKey, currentTaskId?, status?)
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

export async function POST(
  request: Request,
  context: any
): Promise<Response> {
  const { agentId } = context.params;
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

    const input = validateAgentInput(HeartbeatSchema, {
      agentId,
      agentKey: body.agentKey,
      currentTaskId: body.currentTaskId,
      status: body.status,
    });

    // Verify credentials
    const agent = await verifyAgent(input.agentId, input.agentKey);
    if (!agent) {
      throw new UnauthorizedError("Invalid agent credentials");
    }

    const resolvedAgentId = input.agentId as Id<"agents">;

    // Update heartbeat
    await convex.mutation(api.agents.heartbeat, {
      agentId: resolvedAgentId,
      currentTaskId: input.currentTaskId as Id<"tasks"> | undefined,
    });

    // Optionally update status
    if (input.status && input.currentTaskId) {
      // Get businessId from current task (agents are shared across businesses)
      const task = await convex.query(api.tasks.getTaskById, {
        taskId: input.currentTaskId as Id<"tasks">,
      });

      if (task) {
        await convex.mutation(api.agents.updateStatus, {
          businessId: task.businessId,
          agentId: resolvedAgentId,
          status: input.status,
          currentTaskId: input.currentTaskId as Id<"tasks">,
        });
      }
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
