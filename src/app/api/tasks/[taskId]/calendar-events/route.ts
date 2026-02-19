/**
 * POST /api/tasks/{taskId}/calendar-events
 *
 * Schedule a task to the calendar with a specific start time and duration.
 * Returns 201 Created when event is successfully scheduled.
 * Used by agents to book time blocks for assigned work.
 *
 * IDEMPOTENCY: NON-IDEMPOTENT
 * - Reason: Creates a new calendar event record on each call
 * - Safe to retry: NO (use Idempotency-Key header to enable retries)
 * - Side effects on repeat: Duplicate calendar event bookings created
 *
 * URL: /api/tasks/{taskId}/calendar-events
 * Body: { agentId, agentKey, startTime, durationHours }
 * Response: { success: true, data: { eventId, idempotencyKey, message }, timestamp } [201 Created]
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { createLogger } from "@/lib/utils/logger";
import { verifyAgent } from "@/lib/agent-auth";
import {
  jsonResponse,
  successResponse,
  handleApiError,
  extractIdempotencyKey,
  UnauthorizedError,
  ValidationError,
} from "@/lib/utils/apiResponse";

const log = createLogger("api:tasks:calendar-events");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(
  request: Request,
  context: any
): Promise<Response> {
  const { taskId } = context.params;
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      throw new ValidationError("Invalid JSON");
    }

    const { agentId, agentKey, startTime, durationHours } = body;

    // Validate inputs
    if (!agentId || !agentKey || !startTime || durationHours === undefined) {
      throw new ValidationError("Missing required fields: agentId, agentKey, startTime, durationHours");
    }

    if (!taskId) {
      throw new ValidationError("Missing required parameter: taskId");
    }

    if (typeof startTime !== "number" || typeof durationHours !== "number") {
      throw new ValidationError("startTime and durationHours must be numbers");
    }

    if (durationHours <= 0 || durationHours > 24) {
      throw new ValidationError("durationHours must be between 0 and 24");
    }

    // Verify agent credentials
    const agent = await verifyAgent(agentId, agentKey);
    if (!agent) {
      throw new UnauthorizedError("Invalid agent credentials");
    }

    // Extract Idempotency-Key header for retry support
    const idempotencyKey = extractIdempotencyKey(request);

    // Schedule the task to the calendar
    const eventId = await convex.mutation(api.calendarEvents.scheduleTaskEvent, {
      taskId: taskId as any,
      startTime,
      durationHours,
      generatedBy: agentId,
    });

    // Fire-and-forget activity logging (get businessId from task)
    try {
      const task = await convex.query(api.tasks.getTaskById, {
        taskId: taskId as any,
      });

      if (task) {
        await convex.mutation(api.activities.create, {
          businessId: task.businessId as any,
          type: "task_assigned",
          agentId,
          agentName: (agent as any).name,
          agentRole: (agent as any).role,
          taskId: taskId as any,
          message: `${(agent as any).name} scheduled task to calendar: ${new Date(startTime).toISOString()} for ${durationHours}h`,
        });
      }
    } catch (logErr) {
      log.warn("Activity logging failed (non-fatal)", { agentId });
    }

    log.info("Task scheduled to calendar", {
      agentId,
      taskId,
      startTime: new Date(startTime).toISOString(),
      durationHours,
      eventId,
    });

    return jsonResponse(
      successResponse({
        eventId,
        idempotencyKey, // Echo back for client confirmation
        message: `Task scheduled for ${durationHours} hour(s) starting ${new Date(startTime).toISOString()}`,
      }),
      201
    );
  } catch (error) {
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}
