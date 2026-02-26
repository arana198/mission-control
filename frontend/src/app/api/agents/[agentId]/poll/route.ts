/**
 * POST /api/agents/{agentId}/poll
 *
 * Agent polling endpoint — returns work queue + notifications.
 * Updates lastHeartbeat and marks notifications as read.
 *
 * Request body:
 * {
 *   agentKey: string (REQUIRED) - Agent authentication key
 *   workspaceId: string (REQUIRED) -  ID for task scoping
 * }
 *
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

    const input = validateAgentInput(PollAgentSchema, {
      agentId,
      agentKey: body.agentKey,
      workspaceId: body.workspaceId,
    });

    // Extract workspaceId (REQUIRED for multi-business support)
    const { workspaceId } = body;
    if (!workspaceId) {
      return jsonResponse(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "workspaceId is required" },
        },
        400
      );
    }

    // Verify credentials
    const agent = await verifyAgent(input.agentId, input.agentKey);
    if (!agent) {
      throw new UnauthorizedError("Invalid agent credentials");
    }

    const resolvedAgentId = input.agentId as Id<"agents">;

    // Parallel: fetch tasks + notifications + update heartbeat
    // Tasks scoped to the workspace this agent is polling for
    const [assignedTasks, notifications] = await Promise.all([
      convex.query(api.tasks.getForAgent, { workspaceId, agentId: resolvedAgentId }),
      convex.query(api.notifications.getForAgent, {
        agentId: resolvedAgentId,
        includeRead: false,
      }),
    ]);

    // Update heartbeat
    await convex.mutation(api.agents.heartbeat, { agentId: resolvedAgentId });

    // Mark notifications as read
    if (notifications.length > 0) {
      await convex.mutation(api.notifications.markAllRead, { agentId: resolvedAgentId });
    }

    log.info("Agent polled", {
      agentId: input.agentId,
      workspaceId,
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
