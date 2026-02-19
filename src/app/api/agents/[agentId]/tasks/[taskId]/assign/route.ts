/**
 * POST /api/agents/{agentId}/tasks/{taskId}/assign
 *
 * Assign task to one or more agents (create/action endpoint)
 *
 * Request: { agentKey, assigneeIds }
 * Response: { success: true, timestamp }
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import {
  successResponse,
  handleApiError,
  jsonResponse,
  UnauthorizedError,
} from "@/lib/utils/apiResponse";
import { createLogger } from "@/lib/utils/logger";
import { validateAgentTaskInput, AssignTaskSchema } from "@/lib/validators/agentTaskValidators";
import { verifyAgent } from "@/lib/agent-auth";

const log = createLogger("api:agents:tasks:assign");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(
  request: Request,
  context: any
): Promise<Response> {
  const { agentId, taskId } = context.params;
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

    const input = validateAgentTaskInput(AssignTaskSchema, {
      agentId,
      agentKey: body.agentKey,
      taskId,
      assigneeIds: body.assigneeIds,
    });

    // Verify credentials
    const agent = await verifyAgent(input.agentId, input.agentKey);
    if (!agent) {
      throw new UnauthorizedError("Invalid agent credentials");
    }

    // Assign task to agents
    await convex.mutation(api.tasks.assign, {
      taskId: input.taskId as any,
      assigneeIds: input.assigneeIds as any,
      assignedBy: input.agentId as any,
    });

    log.info("Task assigned to agents", {
      agentId: input.agentId,
      taskId: input.taskId,
      assigneeIds: input.assigneeIds,
    });

    return jsonResponse(successResponse({ success: true }), 200);
  } catch (error) {
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}
