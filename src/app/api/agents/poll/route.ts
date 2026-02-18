/**
 * POST /api/agents/poll
 *
 * Agent polling endpoint — returns work queue + notifications.
 * Updates lastHeartbeat and marks notifications as read.
 *
 * Request: { agentId, agentKey }
 * Response: { assignedTasks[], notifications[], serverTime, agentProfile }
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  PollAgentSchema,
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

const log = createLogger("api:agents:poll");
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

    const input = validateAgentInput(PollAgentSchema, body);

    // Verify credentials
    const agent = await verifyAgent(input.agentId, input.agentKey);
    if (!agent) {
      throw new UnauthorizedError("Invalid agent credentials");
    }

    const agentId = input.agentId as Id<"agents">;

    // Parallel: fetch tasks + notifications + update heartbeat
    const [assignedTasks, notifications] = await Promise.all([
      convex.query(api.tasks.getForAgent, { agentId }),
      convex.query(api.notifications.getForAgent, {
        agentId,
        includeRead: false,
      }),
    ]);

    // Update heartbeat
    await convex.mutation(api.agents.heartbeat, { agentId });

    // Mark notifications as read
    if (notifications.length > 0) {
      await convex.mutation(api.notifications.markAllRead, { agentId });
    }

    log.info("Agent polled", {
      agentId: input.agentId,
      tasksCount: assignedTasks.length,
      notificationsCount: notifications.length,
    });

    return jsonResponse(
      successResponse({
        assignedTasks,
        notifications,
        serverTime: Date.now(),
        agentProfile: {
          id: agent._id,
          name: agent.name,
          role: agent.role,
          status: agent.status,
          level: agent.level,
          currentTaskId: agent.currentTaskId,
        },
      })
    );
  } catch (error) {
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}
