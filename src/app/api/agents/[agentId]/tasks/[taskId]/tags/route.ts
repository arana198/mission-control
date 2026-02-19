/**
 * PATCH /api/agents/{agentId}/tasks/{taskId}/tags
 *
 * Add or remove tags from task
 *
 * Request: { agentKey, tags, action }
 * Response: { success, tags }
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
import { validateAgentTaskInput, TagTaskSchema } from "@/lib/validators/agentTaskValidators";
import { verifyAgent } from "@/lib/agent-auth";

const log = createLogger("api:agents:tasks:tags");

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

    const input = validateAgentTaskInput(TagTaskSchema, {
      agentId,
      agentKey: body.agentKey,
      taskId,
      tags: body.tags,
      action: body.action,
    });

    // Verify credentials
    const agent = await verifyAgent(input.agentId, input.agentKey);
    if (!agent) {
      throw new UnauthorizedError("Invalid agent credentials");
    }

    // Initialize Convex client (lazy-loaded for testability)
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

    // Add or remove tags
    const result = await convex.mutation(api.tasks.addTags, {
      taskId: input.taskId as any,
      tags: input.tags,
      action: input.action,
      updatedBy: input.agentId,
    });

    log.info("Tags updated on task", {
      agentId: input.agentId,
      taskId: input.taskId,
      action: input.action,
      tags: input.tags,
    });

    return jsonResponse(
      successResponse({
        success: true,
        tags: (result as any).tags,
      })
    );
  } catch (error) {
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}
