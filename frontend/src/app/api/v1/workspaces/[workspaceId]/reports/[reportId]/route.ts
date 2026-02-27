/**
 * GET/PUT/DELETE /api/v1/workspaces/{workspaceId}/reports/{reportId}
 *
 * Report detail endpoints — v1 REST API standardized format
 *
 * GET - Retrieve single report
 * PUT - Update report
 * DELETE - Delete report
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { createLogger } from "@/lib/utils/logger";
import {
  ValidationError,
  UnauthorizedError,
  NotFoundError,
} from "@/lib/api/errors";
import { generateRequestId } from "@/lib/api/responses";
import { extractAuth, isAuthRequired } from "@/lib/api/auth";

const log = createLogger("api:v1:workspaces:reports:detail");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * GET /api/v1/workspaces/{workspaceId}/reports/{reportId}
 * Retrieve single report
 *
 * Response: RFC 9457 compliant with report details
 */
export async function GET(
  request: NextRequest,
  context: { params: { workspaceId: string; reportId: string } }
): Promise<NextResponse> {
  const requestId = generateRequestId();
  const pathname = new URL(request.url).pathname;

  try {
    const { workspaceId, reportId } = context.params;

    if (!workspaceId) {
      throw new NotFoundError(
        "Workspace ID not found in request path",
        pathname
      );
    }

    if (!reportId) {
      throw new NotFoundError("Report ID not found in request path", pathname);
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

    // Query report from Convex
    const report = await convex.query(api.reports.getReport, {
      workspaceId,
      reportId,
    });

    if (!report) {
      return NextResponse.json(
        {
          type: "https://api.mission-control.dev/errors/not_found",
          title: "Not Found",
          detail: "Report not found",
          instance: pathname,
          status: 404,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 404, headers: { "X-Request-ID": requestId } }
      );
    }

    log.info("Report retrieved", {
      workspaceId,
      reportId,
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
          updatedAt: report._creationTime,
        },
        requestId,
        timestamp: new Date().toISOString(),
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
    log.error("Error retrieving report", { error, requestId });

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
 * PUT /api/v1/workspaces/{workspaceId}/reports/{reportId}
 * Update report
 *
 * Body:
 * {
 *   title: string (optional, 1-200 chars)
 *   type: string (optional - performance, summary, analysis)
 *   description: string (optional, max 5000 chars)
 * }
 *
 * Response: RFC 9457 compliant with updated report
 */
export async function PUT(
  request: NextRequest,
  context: { params: { workspaceId: string; reportId: string } }
): Promise<NextResponse> {
  const requestId = generateRequestId();
  const pathname = new URL(request.url).pathname;

  try {
    const { workspaceId, reportId } = context.params;

    if (!workspaceId) {
      throw new NotFoundError(
        "Workspace ID not found in request path",
        pathname
      );
    }

    if (!reportId) {
      throw new NotFoundError("Report ID not found in request path", pathname);
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

    // Validate at least one field is provided
    if (!body.title && !body.type && !body.description) {
      throw new ValidationError(
        "At least one field must be provided for update",
        pathname
      );
    }

    // Validate title if provided
    if (body.title !== undefined) {
      if (typeof body.title !== "string") {
        throw new ValidationError("Report title must be a string", pathname);
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
    }

    // Validate type if provided
    if (body.type !== undefined) {
      if (typeof body.type !== "string") {
        throw new ValidationError("Report type must be a string", pathname);
      }

      if (![
        "performance",
        "summary",
        "analysis",
      ].includes(body.type)) {
        throw new ValidationError("Invalid report type", pathname);
      }
    }

    // Validate description if provided
    if (body.description !== undefined && body.description !== null) {
      if (typeof body.description !== "string") {
        throw new ValidationError(
          "Report description must be a string",
          pathname
        );
      }

      if (body.description.length > 5000) {
        throw new ValidationError(
          "Report description cannot exceed 5000 characters",
          pathname
        );
      }
    }

    // Call Convex — update report
    const report = await convex.mutation(api.reports.updateReport, {
      workspaceId,
      reportId,
      title: body.title || undefined,
      type: body.type || undefined,
      description:
        body.description !== undefined ? body.description : undefined,
    });

    if (!report) {
      return NextResponse.json(
        {
          type: "https://api.mission-control.dev/errors/not_found",
          title: "Not Found",
          detail: "Report not found",
          instance: pathname,
          status: 404,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 404, headers: { "X-Request-ID": requestId } }
      );
    }

    log.info("Report updated", {
      workspaceId,
      reportId,
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
          updatedAt: report._creationTime,
        },
        requestId,
        timestamp: new Date().toISOString(),
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
    log.error("Error updating report", { error, requestId });

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

/**
 * DELETE /api/v1/workspaces/{workspaceId}/reports/{reportId}
 * Delete report
 *
 * Response: RFC 9457 compliant with deletion confirmation
 */
export async function DELETE(
  request: NextRequest,
  context: { params: { workspaceId: string; reportId: string } }
): Promise<NextResponse> {
  const requestId = generateRequestId();
  const pathname = new URL(request.url).pathname;

  try {
    const { workspaceId, reportId } = context.params;

    if (!workspaceId) {
      throw new NotFoundError(
        "Workspace ID not found in request path",
        pathname
      );
    }

    if (!reportId) {
      throw new NotFoundError("Report ID not found in request path", pathname);
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

    // Call Convex — delete report
    const deleted = await convex.mutation(api.reports.deleteReport, {
      workspaceId,
      reportId,
    });

    if (!deleted) {
      return NextResponse.json(
        {
          type: "https://api.mission-control.dev/errors/not_found",
          title: "Not Found",
          detail: "Report not found",
          instance: pathname,
          status: 404,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 404, headers: { "X-Request-ID": requestId } }
      );
    }

    log.info("Report deleted", {
      workspaceId,
      reportId,
      requestId,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          deleted: true,
          reportId,
        },
        requestId,
        timestamp: new Date().toISOString(),
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
    log.error("Error deleting report", { error, requestId });

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
