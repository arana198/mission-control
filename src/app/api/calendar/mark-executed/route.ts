/**
 * POST /api/calendar/mark-executed
 *
 * Mark a scheduled calendar event as executed/completed
 * Records the timestamp of when the work was actually done
 *
 * Body: { eventId, agentId, agentKey, executedAt? }
 * Response: { success, message }
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { createLogger } from "@/lib/utils/logger";
import { verifyAgent } from "@/lib/agent-auth";

const log = createLogger("api:calendar:mark-executed");
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
    const { eventId, agentId, agentKey, executedAt } = body;

    // Validate inputs
    if (!eventId || !agentId || !agentKey) {
      return jsonResponse({ error: "Missing required fields: eventId, agentId, agentKey" }, 400);
    }

    // Use provided executedAt or current time
    const timestamp = executedAt || Date.now();

    if (typeof timestamp !== "number") {
      return jsonResponse({ error: "executedAt must be a number (epoch ms)" }, 400);
    }

    // Verify agent credentials
    const agent = await verifyAgent(agentId, agentKey);
    if (!agent) {
      return jsonResponse({ error: "Invalid agent credentials" }, 401);
    }

    // Mark the event as executed
    await convex.mutation(api.calendarEvents.markTaskExecuted, {
      eventId: eventId as any,
      executedAt: timestamp,
    });

    // Fire-and-forget activity logging
    try {
      await convex.mutation(api.activities.create, {
        type: "task_completed",
        agentId,
        agentName: (agent as any).name,
        agentRole: (agent as any).role,
        message: `${(agent as any).name} marked calendar event as executed at ${new Date(timestamp).toISOString()}`,
      });
    } catch (logErr) {
      log.warn("Activity logging failed (non-fatal)", { agentId });
    }

    log.info("Event marked as executed", {
      agentId,
      eventId,
      executedAt: new Date(timestamp).toISOString(),
    });

    return jsonResponse({
      success: true,
      message: `Event marked as executed at ${new Date(timestamp).toISOString()}`,
    });
  } catch (error) {
    log.error("Error marking event as executed", { error });
    return jsonResponse({ error: (error as any).message || "Internal server error" }, 500);
  }
}
