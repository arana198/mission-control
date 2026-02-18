/**
 * POST /api/calendar/schedule-task
 *
 * Schedule a task to the calendar with a specific start time and duration
 * Used by agents to book time blocks for assigned work
 *
 * Body: { taskId, agentId, agentKey, startTime, durationHours }
 * Response: { success, eventId, message }
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { createLogger } from "@/lib/utils/logger";
import { verifyAgent } from "@/lib/agent-auth";

const log = createLogger("api:calendar:schedule-task");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { taskId, agentId, agentKey, startTime, durationHours } = body;

    // Validate inputs
    if (!taskId || !agentId || !agentKey || !startTime || durationHours === undefined) {
      return jsonResponse({ error: "Missing required fields: taskId, agentId, agentKey, startTime, durationHours" }, 400);
    }

    if (typeof startTime !== "number" || typeof durationHours !== "number") {
      return jsonResponse({ error: "startTime and durationHours must be numbers" }, 400);
    }

    if (durationHours <= 0 || durationHours > 24) {
      return jsonResponse({ error: "durationHours must be between 0 and 24" }, 400);
    }

    // Verify agent credentials
    const agent = await verifyAgent(agentId, agentKey);
    if (!agent) {
      return jsonResponse({ error: "Invalid agent credentials" }, 401);
    }

    // Schedule the task to the calendar
    const eventId = await convex.mutation(api.calendarEvents.scheduleTaskEvent, {
      taskId: taskId as any,
      startTime,
      durationHours,
      generatedBy: agentId,
    });

    // Fire-and-forget activity logging
    try {
      await convex.mutation(api.activities.create, {
        type: "task_assigned",
        agentId,
        agentName: (agent as any).name,
        agentRole: (agent as any).role,
        taskId: taskId as any,
        message: `${(agent as any).name} scheduled task to calendar: ${new Date(startTime).toISOString()} for ${durationHours}h`,
      });
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

    return jsonResponse({
      success: true,
      eventId,
      message: `Task scheduled for ${durationHours} hour(s) starting ${new Date(startTime).toISOString()}`,
    });
  } catch (error) {
    log.error("Error scheduling task", { error });
    return jsonResponse({ error: (error as any).message || "Internal server error" }, 500);
  }
}
