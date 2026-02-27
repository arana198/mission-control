/**
 * GET/POST /api/v1/workspaces/{workspaceId}/calendar/slots
 *
 * Calendar slots management endpoints — v1 REST API standardized format
 *
 * GET - List available calendar slots with pagination
 * POST - Create new calendar slot
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { createLogger } from "@/lib/utils/logger";
import {
  createListResponse,
  parsePaginationFromRequest,
} from "@/lib/api/routeHelpers";
import {
  ValidationError,
  UnauthorizedError,
  NotFoundError,
} from "@/lib/api/errors";
import { generateRequestId } from "@/lib/api/responses";
import { extractAuth, isAuthRequired } from "@/lib/api/auth";

const log = createLogger("api:v1:workspaces:calendar:slots");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * GET /api/v1/workspaces/{workspaceId}/calendar/slots
 * List calendar slots with pagination
 *
 * Query Parameters:
 * - limit: number (1-100, default 20)
 * - cursor: string (pagination cursor)
 * - date: string (optional - filter by date, YYYY-MM-DD format)
 *
 * Response: RFC 9457 compliant paginated slots list
 */
export async function GET(
  request: NextRequest,
  context: any
): Promise<NextResponse> {
  const requestId = generateRequestId();
  const pathname = new URL(request.url).pathname;

  try {
    const { workspaceId } = context.params;

    if (!workspaceId) {
      throw new NotFoundError(
        "Workspace ID not found in request path",
        pathname
      );
    }

    // Validate authentication
    const authHeader = request.headers.get("authorization");
    const headers = Object.fromEntries(request.headers.entries());

    if (isAuthRequired(pathname)) {
      try {
        extractAuth(authHeader || "", headers);
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          return NextResponse.json(
            {
              type: "https://api.mission-control.dev/errors/unauthorized",
              title: "Unauthorized",
              detail: error.message,
              instance: pathname,
              status: 401,
              requestId,
              timestamp: new Date().toISOString(),
            },
            { status: 401, headers: { "X-Request-ID": requestId } }
          );
        }
        throw error;
      }
    }

    // Get optional filters from query
    const url = new URL(request.url);

    // Parse pagination parameters
    const { limit, cursor } = parsePaginationFromRequest(url.searchParams);

    const date = url.searchParams.get("date");
    const taskId = url.searchParams.get("taskId");

    // Convert date to startTime and endTime if provided
    let startTime: number | undefined;
    let endTime: number | undefined;
    if (date) {
      const dateObj = new Date(date);
      startTime = dateObj.getTime();
      endTime = new Date(dateObj.getTime() + 24 * 60 * 60 * 1000).getTime();
    }

    // Query calendar slots from Convex
    const slots = await convex.query(api.calendarEvents.listSlots, {
      startTime,
      endTime,
      taskId: taskId ? (taskId as any) : undefined,
      limit,
    });

    log.info("Calendar slots listed", {
      workspaceId,
      count: slots.length || 0,
      requestId,
    });

    const response = createListResponse(slots || [], slots.length || 0, limit || 20, 0);

    return NextResponse.json(
      {
        ...response,
        requestId,
      },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": requestId,
        },
      }
    );
  } catch (error) {
    log.error("Error listing calendar slots", { error, requestId });

    if (error instanceof NotFoundError) {
      return NextResponse.json(
        {
          type: "https://api.mission-control.dev/errors/not_found",
          title: "Not Found",
          detail: error.message,
          instance: pathname,
          status: 404,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 404, headers: { "X-Request-ID": requestId } }
      );
    }

    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        {
          type: "https://api.mission-control.dev/errors/unauthorized",
          title: "Unauthorized",
          detail: error.message,
          instance: pathname,
          status: 401,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 401, headers: { "X-Request-ID": requestId } }
      );
    }

    return NextResponse.json(
      {
        type: "https://api.mission-control.dev/errors/internal_error",
        title: "Internal Server Error",
        detail: "An unexpected error occurred",
        instance: pathname,
        status: 500,
        requestId,
        timestamp: new Date().toISOString(),
      },
      { status: 500, headers: { "X-Request-ID": requestId } }
    );
  }
}

/**
 * POST /api/v1/workspaces/{workspaceId}/calendar/slots
 * Create new calendar slot
 *
 * Body:
 * {
 *   date: string (required, YYYY-MM-DD format)
 *   startTime: string (required, HH:MM format)
 *   endTime: string (required, HH:MM format)
 *   capacity: number (required, positive integer)
 *   type: string (optional - meeting, workshop, availability)
 * }
 *
 * Response: RFC 9457 compliant with created slot
 */
export async function POST(
  request: NextRequest,
  context: any
): Promise<NextResponse> {
  const requestId = generateRequestId();
  const pathname = new URL(request.url).pathname;

  try {
    const { workspaceId } = context.params;

    if (!workspaceId) {
      throw new NotFoundError(
        "Workspace ID not found in request path",
        pathname
      );
    }

    // Validate authentication
    const authHeader = request.headers.get("authorization");
    const headers = Object.fromEntries(request.headers.entries());

    if (isAuthRequired(pathname)) {
      try {
        extractAuth(authHeader || "", headers);
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          return NextResponse.json(
            {
              type: "https://api.mission-control.dev/errors/unauthorized",
              title: "Unauthorized",
              detail: error.message,
              instance: pathname,
              status: 401,
              requestId,
              timestamp: new Date().toISOString(),
            },
            { status: 401, headers: { "X-Request-ID": requestId } }
          );
        }
        throw error;
      }
    }

    // Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError("Invalid JSON body", pathname);
    }

    if (!body) {
      throw new ValidationError("Request body is required", pathname);
    }

    if (!body.date || typeof body.date !== "string") {
      throw new ValidationError("Slot date is required (YYYY-MM-DD format)", pathname);
    }

    if (!body.startTime || typeof body.startTime !== "string") {
      throw new ValidationError("Slot start time is required (HH:MM format)", pathname);
    }

    if (!body.endTime || typeof body.endTime !== "string") {
      throw new ValidationError("Slot end time is required (HH:MM format)", pathname);
    }

    if (!body.capacity || typeof body.capacity !== "number" || body.capacity <= 0) {
      throw new ValidationError("Slot capacity must be a positive number", pathname);
    }

    // Validate optional type field
    if (body.type && typeof body.type !== "string") {
      throw new ValidationError("Slot type must be a string", pathname);
    }

    if (body.type && ![
      "meeting",
      "workshop",
      "availability",
    ].includes(body.type)) {
      throw new ValidationError("Invalid slot type", pathname);
    }

    // Convert date and time strings to timestamps
    const [startHour, startMinute] = body.startTime.split(":").map(Number);
    const [endHour, endMinute] = body.endTime.split(":").map(Number);
    const dateObj = new Date(body.date);
    const startTimestamp = new Date(
      dateObj.getFullYear(),
      dateObj.getMonth(),
      dateObj.getDate(),
      startHour,
      startMinute
    ).getTime();
    const endTimestamp = new Date(
      dateObj.getFullYear(),
      dateObj.getMonth(),
      dateObj.getDate(),
      endHour,
      endMinute
    ).getTime();

    // Call Convex — create slot
    const slot = await convex.mutation(api.calendarEvents.createSlot, {
      title: `Calendar Slot - ${body.type || "availability"}`,
      startTime: startTimestamp,
      endTime: endTimestamp,
      workspaceId: workspaceId as any,
      description: body.description || undefined,
    });

    if (!slot) {
      return NextResponse.json(
        {
          type: "https://api.mission-control.dev/errors/not_found",
          title: "Not Found",
          detail: "Failed to create calendar slot",
          instance: pathname,
          status: 404,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 404, headers: { "X-Request-ID": requestId } }
      );
    }

    log.info("Calendar slot created", {
      workspaceId,
      slotId: slot._id,
      requestId,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: slot._id,
          title: slot.title,
          startTime: slot.startTime,
          endTime: slot.endTime,
          timezone: slot.timezone,
          description: slot.description,
          createdAt: new Date(slot.createdAt).toISOString(),
        },
        requestId,
        timestamp: new Date().toISOString(),
      },
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": requestId,
        },
      }
    );
  } catch (error) {
    log.error("Error creating calendar slot", { error, requestId });

    if (error instanceof ValidationError) {
      return NextResponse.json(
        {
          type: "https://api.mission-control.dev/errors/validation_error",
          title: "Validation Error",
          detail: error.message,
          instance: pathname,
          status: 400,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 400, headers: { "X-Request-ID": requestId } }
      );
    }

    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        {
          type: "https://api.mission-control.dev/errors/unauthorized",
          title: "Unauthorized",
          detail: error.message,
          instance: pathname,
          status: 401,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 401, headers: { "X-Request-ID": requestId } }
      );
    }

    if (error instanceof NotFoundError) {
      return NextResponse.json(
        {
          type: "https://api.mission-control.dev/errors/not_found",
          title: "Not Found",
          detail: error.message,
          instance: pathname,
          status: 404,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 404, headers: { "X-Request-ID": requestId } }
      );
    }

    return NextResponse.json(
      {
        type: "https://api.mission-control.dev/errors/internal_error",
        title: "Internal Server Error",
        detail: "An unexpected error occurred",
        instance: pathname,
        status: 500,
        requestId,
        timestamp: new Date().toISOString(),
      },
      { status: 500, headers: { "X-Request-ID": requestId } }
    );
  }
}
