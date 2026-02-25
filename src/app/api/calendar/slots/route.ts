/**
 * GET /api/calendar/slots
 *
 * Find available time slots in the calendar for scheduling work
 * Returns up to 5 best slots based on workspace hours preference and agent preferences
 *
 * IDEMPOTENCY: IDEMPOTENT
 * - Reason: Query operation (read-only, no side effects)
 * - Safe to retry: YES
 * - Side effects on repeat: None
 *
 * Query parameters:
 * - agentId (required): Agent ID
 * - agentKey (required): Agent authentication key
 * - startDate (required): Start date (epoch ms)
 * - endDate (required): End date (epoch ms)
 * - durationMinutes (required): Required duration in minutes
 * - preferBefore (optional): Prefer slots before this time (epoch ms)
 * - preferAfter (optional): Prefer slots after this time (epoch ms)
 *
 * Response: { success: true, data: { slots: [{ start, end, score }], message }, timestamp } [200 OK]
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

const log = createLogger("api:calendar:slots");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(request: Request): Promise<Response> {
  try {
    // Parse query parameters
    const url = new URL(request.url);
    const agentId = url.searchParams.get("agentId");
    const agentKey = url.searchParams.get("agentKey");
    const startDateParam = url.searchParams.get("startDate");
    const endDateParam = url.searchParams.get("endDate");
    const durationMinutesParam = url.searchParams.get("durationMinutes");
    const preferBeforeParam = url.searchParams.get("preferBefore");
    const preferAfterParam = url.searchParams.get("preferAfter");

    // Validate required fields
    if (!agentId || !agentKey || !startDateParam || !endDateParam || !durationMinutesParam) {
      throw new ValidationError(
        "Missing required query parameters: agentId, agentKey, startDate, endDate, durationMinutes"
      );
    }

    // Parse numeric parameters
    const startDate = parseInt(startDateParam, 10);
    const endDate = parseInt(endDateParam, 10);
    const durationMinutes = parseInt(durationMinutesParam, 10);

    if (isNaN(startDate) || isNaN(endDate) || isNaN(durationMinutes)) {
      throw new ValidationError("startDate, endDate, and durationMinutes must be valid numbers");
    }

    if (durationMinutes <= 0 || durationMinutes > 1440) {
      throw new ValidationError("durationMinutes must be between 0 and 1440 (24 hours)");
    }

    if (startDate >= endDate) {
      throw new ValidationError("startDate must be before endDate");
    }

    // Parse optional parameters
    const preferBefore = preferBeforeParam ? parseInt(preferBeforeParam, 10) : undefined;
    const preferAfter = preferAfterParam ? parseInt(preferAfterParam, 10) : undefined;

    // Verify agent credentials
    const agent = await verifyAgent(agentId, agentKey);
    if (!agent) {
      throw new UnauthorizedError("Invalid agent credentials");
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

    return jsonResponse(
      successResponse({
        slots: slots || [],
        message: `Found ${slots?.length || 0} available slot(s)`,
      }),
      200
    );
  } catch (error) {
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}
