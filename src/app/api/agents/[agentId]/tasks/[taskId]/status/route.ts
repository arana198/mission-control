/**
 * PATCH /api/agents/{agentId}/tasks/{taskId}/status
 *
 * Update task status (idempotent resource update)
 *
 * Request: { agentKey, status }
 * Response: { success: true }
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
import { validateAgentTaskInput, UpdateTaskStatusSchema } from "@/lib/validators/agentTaskValidators";
import { verifyAgent } from "@/lib/agent-auth";

const log = createLogger("api:agents:tasks:status");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function PATCH(
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

    const input = validateAgentTaskInput(UpdateTaskStatusSchema, {
      agentId,
      agentKey: body.agentKey,
      taskId,
      status: body.status,
    });

    // Verify credentials
    const agent = await verifyAgent(input.agentId, input.agentKey);
    if (!agent) {
      throw new UnauthorizedError("Invalid agent credentials");
    }

    // Update task status
    await convex.mutation(api.tasks.updateStatus, {
      taskId: input.taskId as any,
      status: input.status,
      updatedBy: input.agentId,
    });

    log.info("Task status updated", {
      agentId: input.agentId,
      taskId: input.taskId,
      status: input.status,
    });

    return jsonResponse(successResponse({ success: true }), 200);
  } catch (error) {
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}
