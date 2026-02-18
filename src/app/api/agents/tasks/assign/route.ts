/**
 * POST /api/agents/tasks/{taskId}/assign (Phase 2)
 *
 * Assign task to one or more agents
 *
 * Request: AssignTaskInput (agentId, agentKey, taskId, assigneeIds)
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
import { validateAgentTaskInput, AssignTaskSchema } from "@/lib/validators/agentTaskValidators";
import { verifyAgent } from "@/lib/agent-auth";

const log = createLogger("api:agents:tasks:assign");
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

    const input = validateAgentTaskInput(AssignTaskSchema, { ...body, taskId });

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

    return jsonResponse(successResponse({ success: true }));
  } catch (error) {
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}
