/**
 * PUT /api/agents/tasks/{taskId}/update (Phase 2)
 *
 * Update task metadata (title, description, priority, dueDate) — idempotent resource update
 *
 * Request: UpdateTaskMetadataInput (agentId, agentKey, taskId, title?, description?, priority?, dueDate?)
 * Response: { success: true, data: { success: true }, timestamp }
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
import { validateAgentTaskInput, UpdateTaskMetadataSchema } from "@/lib/validators/agentTaskValidators";
import { verifyAgent } from "@/lib/agent-auth";

const log = createLogger("api:agents:tasks:update");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

type Props = {
  params: {
    taskId: string;
  };
};

export async function PUT(request: Request, context: any): Promise<Response> {
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

    const input = validateAgentTaskInput(UpdateTaskMetadataSchema, { ...body, taskId });

    // Verify credentials
    const agent = await verifyAgent(input.agentId, input.agentKey);
    if (!agent) {
      throw new UnauthorizedError("Invalid agent credentials");
    }

    // Build update object with only provided fields
    const updates: any = {
      id: input.taskId as any,
    };
    if (input.title !== undefined) updates.title = input.title;
    if (input.description !== undefined) updates.description = input.description;
    if (input.priority !== undefined) updates.priority = input.priority;
    if (input.dueDate !== undefined) updates.dueDate = input.dueDate;

    // Update task metadata
    await convex.mutation(api.tasks.update, updates);

    log.info("Task metadata updated", {
      agentId: input.agentId,
      taskId: input.taskId,
      updatedFields: Object.keys(updates),
    });

    return jsonResponse(successResponse({ success: true }));
  } catch (error) {
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}
