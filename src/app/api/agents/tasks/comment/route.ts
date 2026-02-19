/**
 * POST /api/agents/tasks/{taskId}/comment
 *
 * Add comment to task with optional @mentions.
 * Returns 201 Created when comment is successfully added.
 *
 * IDEMPOTENCY: NON-IDEMPOTENT
 * - Reason: Creates a new message record on each call
 * - Safe to retry: NO (use Idempotency-Key header to enable retries)
 * - Side effects on repeat: Duplicate comments created
 *
 * Request: AddCommentInput (agentId, agentKey, taskId, content, mentions)
 * Response: { success, messageId } [201 Created]
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import {
  successResponse,
  handleApiError,
  jsonResponse,
  UnauthorizedError,
  extractIdempotencyKey,
} from "@/lib/utils/apiResponse";
import { createLogger } from "@/lib/utils/logger";
import { validateAgentTaskInput, AddCommentSchema } from "@/lib/validators/agentTaskValidators";
import { verifyAgent } from "@/lib/agent-auth";
import { HTTP_HEADERS } from "@/lib/constants/business";

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

    // Extract Idempotency-Key header for retry support (Phase 3 will implement deduplication)
    const idempotencyKey = extractIdempotencyKey(request);

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
      idempotencyKey: idempotencyKey ? "[present]" : "[absent]",
    });

    return jsonResponse(
      successResponse({
        messageId,
        idempotencyKey, // Echo back for client confirmation
      }),
      201
    );
  } catch (error) {
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}
