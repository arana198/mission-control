/**
 * POST /api/calendar/create-event
 *
 * Create a custom calendar event (workflow, automation, cron job)
 * Used by agents to log their automated work and scheduled tasks
 *
 * Body: { agentId, agentKey, title, description?, startTime, endTime, type, recurring?, color? }
 * Response: { success, eventId, message }
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { createLogger } from "@/lib/utils/logger";
import { verifyAgent } from "@/lib/agent-auth";

const log = createLogger("api:calendar:create-event");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Valid event types agents can create
const VALID_AGENT_TYPES = ["ai_workflow", "bot_generated"];

function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { agentId, agentKey, title, description, startTime, endTime, type, recurring, color } = body;

    // Validate inputs
    if (!agentId || !agentKey || !title || !startTime || !endTime || !type) {
      return jsonResponse({ error: "Missing required fields: agentId, agentKey, title, startTime, endTime, type" }, 400);
    }

    if (!VALID_AGENT_TYPES.includes(type)) {
      return jsonResponse({ error: `Invalid event type. Agents can only create: ${VALID_AGENT_TYPES.join(", ")}` }, 400);
    }

    if (typeof startTime !== "number" || typeof endTime !== "number") {
      return jsonResponse({ error: "startTime and endTime must be numbers" }, 400);
    }

    if (startTime >= endTime) {
      return jsonResponse({ error: "startTime must be before endTime" }, 400);
    }

    if (typeof title !== "string" || title.length === 0) {
      return jsonResponse({ error: "title must be a non-empty string" }, 400);
    }

    // Verify agent credentials
    const agent = await verifyAgent(agentId, agentKey);
    if (!agent) {
      return jsonResponse({ error: "Invalid agent credentials" }, 401);
    }

    // Create the calendar event
    const eventId = await convex.mutation(api.calendarEvents.createHumanEvent, {
      title,
      description: description || undefined,
      startTime,
      endTime,
      timezone: "UTC",
      color: color || (type === "ai_workflow" ? "#f97316" : "#22c55e"),
    });

    // Fire-and-forget activity logging (use task_created for now)
    try {
      await convex.mutation(api.activities.create, {
        type: "task_created",
        agentId,
        agentName: (agent as any).name,
        agentRole: (agent as any).role,
        message: `${(agent as any).name} created ${type} calendar event: "${title}"`,
      });
    } catch (logErr) {
      log.warn("Activity logging failed (non-fatal)", { agentId });
    }

    log.info("Calendar event created", {
      agentId,
      eventId,
      type,
      title,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
    });

    return jsonResponse({
      success: true,
      eventId,
      message: `${type} event created: "${title}"`,
    });
  } catch (error) {
    log.error("Error creating event", { error });
    return jsonResponse({ error: (error as any).message || "Internal server error" }, 500);
  }
}
