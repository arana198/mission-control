/**
 * PUT /api/calendar/events/{eventId}
 *
 * Mark a scheduled calendar event as executed/completed
 * Records the timestamp of when the work was actually done
 *
 * IDEMPOTENCY: NON-IDEMPOTENT (without idempotency support in Convex)
 * - Reason: Updates existing event record
 * - Safe to retry: NO (use Idempotency-Key header for deduplication in Phase 3)
 * - Side effects on repeat: Multiple execution timestamps could be recorded
 *
 * URL: /api/calendar/events/{eventId}
 * Body: { agentId, agentKey, executedAt? }
 * Response: { success: true, data: { message }, timestamp } [200 OK]
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { createLogger } from "@/lib/utils/logger";
import { verifyAgent } from "@/lib/agent-auth";
import {
  jsonResponse,
  successResponse,
  handleApiError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/utils/apiResponse";

const log = createLogger("api:calendar:events:update");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function PUT(
  request: Request,
  context: any
): Promise<Response> {
  const { eventId } = context.params;
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      throw new ValidationError("Invalid JSON");
    }

    const { agentId, agentKey, executedAt } = body;

    // Validate inputs
    if (!agentId || !agentKey) {
      throw new ValidationError("Missing required fields: agentId, agentKey");
    }

    if (!eventId) {
      throw new ValidationError("Missing required parameter: eventId");
    }

    // Use provided executedAt or current time
    const timestamp = executedAt || Date.now();

    if (typeof timestamp !== "number") {
      throw new ValidationError("executedAt must be a number (epoch ms)");
    }

    // Verify agent credentials
    const agent = await verifyAgent(agentId, agentKey);
    if (!agent) {
      throw new UnauthorizedError("Invalid agent credentials");
    }

    // Mark the event as executed
    await convex.mutation(api.calendarEvents.markTaskExecuted, {
      eventId: eventId as any,
      executedAt: timestamp,
    });

    // Note: Activity logging skipped for calendar events
    // (calendar events are globally shared, not tied to a specific workspaceId)

    log.info("Event marked as executed", {
      agentId,
      eventId,
      executedAt: new Date(timestamp).toISOString(),
    });

    return jsonResponse(
      successResponse({
        message: `Event marked as executed at ${new Date(timestamp).toISOString()}`,
      }),
      200
    );
  } catch (error) {
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}
