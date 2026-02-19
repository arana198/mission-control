/**
 * POST /api/calendar/events
 *
 * Create a custom calendar event (workflow, automation, cron job).
 * Returns 201 Created when event is successfully created.
 * Used by agents to log their automated work and scheduled tasks.
 *
 * IDEMPOTENCY: NON-IDEMPOTENT
 * - Reason: Creates a new calendar event record on each call
 * - Safe to retry: NO (use Idempotency-Key header to enable retries)
 * - Side effects on repeat: Duplicate calendar events created
 *
 * Body: { agentId, agentKey, title, description?, startTime, endTime, type, recurring?, color? }
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

const log = createLogger("api:calendar:events");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Valid event types agents can create
const VALID_AGENT_TYPES = ["ai_workflow", "bot_generated"];

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      throw new ValidationError("Invalid JSON");
    }

    const { agentId, agentKey, title, description, startTime, endTime, type, recurring, color } = body;

    // Validate required fields
    if (!agentId || !agentKey || !title || !startTime || !endTime || !type) {
      throw new ValidationError("Missing required fields: agentId, agentKey, title, startTime, endTime, type");
    }

    // Validate event type
    if (!VALID_AGENT_TYPES.includes(type)) {
      throw new ValidationError(`Invalid event type. Agents can only create: ${VALID_AGENT_TYPES.join(", ")}`);
    }

    // Validate times
    if (typeof startTime !== "number" || typeof endTime !== "number") {
      throw new ValidationError("startTime and endTime must be numbers");
    }

    if (startTime >= endTime) {
      throw new ValidationError("startTime must be before endTime");
    }

    // Validate title
    if (typeof title !== "string" || title.length === 0) {
      throw new ValidationError("title must be a non-empty string");
    }

    // Verify agent credentials
    const agent = await verifyAgent(agentId, agentKey);
    if (!agent) {
      throw new UnauthorizedError("Invalid agent credentials");
    }

    // Extract Idempotency-Key header for retry support
    const idempotencyKey = extractIdempotencyKey(request);

    // Create the calendar event
    const eventId = await convex.mutation(api.calendarEvents.createHumanEvent, {
      title,
      description: description || undefined,
      startTime,
      endTime,
      timezone: "UTC",
      color: color || (type === "ai_workflow" ? "#f97316" : "#22c55e"),
    });

    log.info("Calendar event created", {
      agentId,
      eventId,
      type,
      title,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
    });

    return jsonResponse(
      successResponse({
        eventId,
        idempotencyKey,
        message: `${type} event created: "${title}"`,
      }),
      201
    );
  } catch (error) {
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}
