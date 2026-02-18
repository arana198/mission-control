/**
 * POST /api/agents/tasks/complete
 *
 * Mark a task as complete from an agent's perspective.
 * Atomically updates task status, agent status, and logs activity.
 *
 * Request: CompleteTaskInput
 * Response: { success, taskId, completedAt }
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  CompleteTaskSchema,
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

const log = createLogger("api:agents:tasks:complete");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: Request): Promise<Response> {
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

    const input = validateAgentInput(CompleteTaskSchema, body);

    // Verify credentials
    const agent = await verifyAgent(input.agentId, input.agentKey);
    if (!agent) {
      throw new UnauthorizedError("Invalid agent credentials");
    }

    const taskId = input.taskId as Id<"tasks">;
    const agentId = input.agentId as Id<"agents">;

    const completedAt = Date.now();

    // Call atomic mutation to complete task
    const result = await convex.mutation(api.tasks.completeByAgent, {
      taskId,
      agentId,
      completionNotes: input.completionNotes,
      timeTracked: input.timeSpent,
      status: (input.status as "done" | "review") || "done",
    });

    // Create execution log entry
    await convex.mutation(api.executionLog.create, {
      taskId,
      agentId: input.agentId,
      status: "success",
      output: input.completionNotes,
      timeSpent: input.timeSpent || 0,
      attemptNumber: 1,
    });

    log.info("Task completed by agent", {
      agentId: input.agentId,
      agentName: agent.name,
      taskId: input.taskId,
    });

    return jsonResponse(
      successResponse({
        success: true,
        taskId: input.taskId,
        completedAt,
      })
    );
  } catch (error) {
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}
