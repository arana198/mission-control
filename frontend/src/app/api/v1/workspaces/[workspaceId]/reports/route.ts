/**
 * GET/POST /api/v1/workspaces/{workspaceId}/reports
 *
 * Report management endpoints — v1 REST API standardized format
 *
 * GET - List reports with pagination
 * POST - Create new report
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

const log = createLogger("api:v1:workspaces:reports");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * GET /api/v1/workspaces/{workspaceId}/reports
 * List reports with pagination
 *
 * Query Parameters:
 * - limit: number (1-100, default 20)
 * - cursor: string (pagination cursor)
 * - type: string (optional - filter by report type)
 *
 * Response: RFC 9457 compliant paginated report list
 */
export async function GET(
  request: NextRequest,
  context: { params: { workspaceId: string } }
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

    // Parse pagination parameters
    const { limit, cursor } = parsePaginationFromRequest(request);

    // Get optional type filter from query
    const url = new URL(request.url);
    const type = url.searchParams.get("type") || undefined;

    // Query reports from Convex
    const reports = await convex.query(api.reports.listReports, {
      workspaceId,
      limit,
      cursor,
      type,
    });

    log.info("Workspace reports listed", {
      workspaceId,
      count: reports.items?.length || 0,
      requestId,
    });

    const response = createListResponse(reports.items || [], {
      total: reports.total || 0,
      cursor: reports.nextCursor,
      hasMore: !!reports.nextCursor,
    });

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
    log.error("Error listing workspace reports", { error, requestId });

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
 * POST /api/v1/workspaces/{workspaceId}/reports
 * Create new report
 *
 * Body:
 * {
 *   title: string (required, 1-200 chars)
 *   type: string (required - performance, summary, analysis)
 *   description: string (optional, max 5000 chars)
 * }
 *
 * Response: RFC 9457 compliant with created report
 */
export async function POST(
  request: NextRequest,
  context: { params: { workspaceId: string } }
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

    if (!body.title || typeof body.title !== "string") {
      throw new ValidationError("Report title is required", pathname);
    }

    if (body.title.trim().length === 0) {
      throw new ValidationError("Report title cannot be empty", pathname);
    }

    if (body.title.length > 200) {
      throw new ValidationError(
        "Report title cannot exceed 200 characters",
        pathname
      );
    }

    if (!body.type || typeof body.type !== "string") {
      throw new ValidationError("Report type is required", pathname);
    }

    if (!["performance", "summary", "analysis"].includes(body.type)) {
      throw new ValidationError("Invalid report type", pathname);
    }

    // Validate optional fields
    if (body.description && typeof body.description !== "string") {
      throw new ValidationError("Report description must be a string", pathname);
    }

    if (body.description && body.description.length > 5000) {
      throw new ValidationError(
        "Report description cannot exceed 5000 characters",
        pathname
      );
    }

    // Call Convex — create report
    const report = await convex.mutation(api.reports.createReport, {
      workspaceId,
      title: body.title,
      type: body.type,
      description: body.description || null,
    });

    if (!report) {
      return NextResponse.json(
        {
          type: "https://api.mission-control.dev/errors/not_found",
          title: "Not Found",
          detail: "Failed to create report",
          instance: pathname,
          status: 404,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 404, headers: { "X-Request-ID": requestId } }
      );
    }

    log.info("Report created", {
      workspaceId,
      reportId: report._id,
      requestId,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: report._id,
          title: report.title,
          type: report.type,
          description: report.description,
          createdAt: report._creationTime,
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
    log.error("Error creating report", { error, requestId });

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
