/**
 * GET /api/agents/{agentId}/tasks/{taskId}
 *
 * Get full details for a specific task
 *
 * Query params: agentKey (required)
 * Response: { task }
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import {
  successResponse,
  handleApiError,
  jsonResponse,
  UnauthorizedError,
  NotFoundError,
} from "@/lib/utils/apiResponse";
import { createLogger } from "@/lib/utils/logger";
import { validateAgentTaskInput, GetTaskDetailsSchema } from "@/lib/validators/agentTaskValidators";
import { verifyAgent } from "@/lib/agent-auth";

const log = createLogger("api:agents:tasks:details");

export async function GET(
  request: Request,
  context: any
): Promise<Response> {
  const { agentId, taskId } = context.params;
  try {
    // Parse query params
    const url = new URL(request.url);
    const agentKey = url.searchParams.get("agentKey");

    if (!agentKey) {
      return jsonResponse(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "agentKey query param is required" },
        },
        400
      );
    }

    const input = validateAgentTaskInput(GetTaskDetailsSchema, {
      agentId,
      agentKey,
      taskId,
    });

    // Verify credentials
    const agent = await verifyAgent(input.agentId, input.agentKey);
    if (!agent) {
      throw new UnauthorizedError("Invalid agent credentials");
    }

    // Initialize Convex client (lazy-loaded for testability)
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

    // Get task details
    const task = await convex.query(api.tasks.getWithDetails, {
      taskId: input.taskId as any,
    });

    if (!task) {
      throw new NotFoundError("Task not found");
    }

    log.info("Task details retrieved", {
      agentId: input.agentId,
      taskId: input.taskId,
    });

    return jsonResponse(
      successResponse({
        task,
      })
    );
  } catch (error) {
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}
