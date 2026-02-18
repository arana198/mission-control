/**
 * POST /api/agents/tasks/{taskId}/comment
 *
 * Add comment to task with optional @mentions
 *
 * Request: AddCommentInput (agentId, agentKey, taskId, content, mentions)
 * Response: { success, messageId }
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
import { validateAgentTaskInput, AddCommentSchema } from "@/lib/validators/agentTaskValidators";
import { verifyAgent } from "@/lib/agent-auth";

const log = createLogger("api:agents:tasks:comment");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(
  request: Request,
  context: any
): Promise<Response> {
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

    const input = validateAgentTaskInput(AddCommentSchema, { ...body, taskId });

    // Verify credentials
    const agent = await verifyAgent(input.agentId, input.agentKey);
    if (!agent) {
      throw new UnauthorizedError("Invalid agent credentials");
    }

    // Add comment via messages.create
    const messageId = await convex.mutation(api.messages.create, {
      taskId: input.taskId as any,
      content: input.content,
      senderId: input.agentId,
      senderName: agent.name,
      mentions: input.mentions as any,
    });

    log.info("Comment added to task", {
      agentId: input.agentId,
      taskId: input.taskId,
      messageId,
    });

    return jsonResponse(
      successResponse({
        messageId,
      })
    );
  } catch (error) {
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}
