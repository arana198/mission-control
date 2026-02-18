/**
 * POST /api/calendar/find-slots
 *
 * Find available time slots in the calendar for scheduling work
 * Returns up to 5 best slots based on business hours preference and agent preferences
 *
 * Body: { agentId, agentKey, startDate, endDate, durationMinutes, preferBefore?, preferAfter? }
 * Response: { success, slots: [{ start, end, score }] }
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { createLogger } from "@/lib/utils/logger";
import { verifyAgent } from "@/lib/agent-auth";

const log = createLogger("api:calendar:find-slots");
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
    const { agentId, agentKey, startDate, endDate, durationMinutes, preferBefore, preferAfter } = body;

    // Validate inputs
    if (!agentId || !agentKey || !startDate || !endDate || durationMinutes === undefined) {
      return jsonResponse({ error: "Missing required fields: agentId, agentKey, startDate, endDate, durationMinutes" }, 400);
    }

    if (typeof startDate !== "number" || typeof endDate !== "number" || typeof durationMinutes !== "number") {
      return jsonResponse({ error: "startDate, endDate, and durationMinutes must be numbers" }, 400);
    }

    if (durationMinutes <= 0 || durationMinutes > 1440) {
      return jsonResponse({ error: "durationMinutes must be between 0 and 1440 (24 hours)" }, 400);
    }

    if (startDate >= endDate) {
      return jsonResponse({ error: "startDate must be before endDate" }, 400);
    }

    // Verify agent credentials
    const agent = await verifyAgent(agentId, agentKey);
    if (!agent) {
      return jsonResponse({ error: "Invalid agent credentials" }, 401);
    }

    // Find available slots
    const slots = await convex.query(api.calendarEvents.findFreeSlots, {
      startDate,
      endDate,
      durationMinutes,
      preferBefore,
      preferAfter,
    });

    // No activity logging for queries (read-only operation)

    log.info("Free slots found", {
      agentId,
      durationMinutes,
      slotsFound: slots?.length || 0,
    });

    return jsonResponse({
      success: true,
      slots: slots || [],
      message: `Found ${slots?.length || 0} available slot(s)`,
    });
  } catch (error) {
    log.error("Error finding slots", { error });
    return jsonResponse({ error: (error as any).message || "Internal server error" }, 500);
  }
}
