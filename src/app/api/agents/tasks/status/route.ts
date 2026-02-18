/**
 * POST /api/agents/tasks/{taskId}/status
 *
 * Update task status
 *
 * Request: UpdateTaskStatusInput (agentId, agentKey, taskId, status)
 * Response: { success }
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

type Props = {
  params: {
    taskId: string;
  };
};

export async function POST(request: Request, context: any): Promise<Response> {
  const { taskId } = context.params;
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

    const input = validateAgentTaskInput(UpdateTaskStatusSchema, { ...body, taskId });

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

    return jsonResponse(successResponse({ success: true }));
  } catch (error) {
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}
