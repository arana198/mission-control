/**
 * POST /api/admin/workspaces
 * Create a new workspace (system admin only).
 *
 * Admin endpoints do NOT go through workspace-scoped middleware.
 * System admin check happens in Convex (workspaces.create checks systemAdmins table).
 *
 * Request body:
 * {
 *   name: string (required) - Workspace name
 *   slug: string (required) - URL-friendly workspace identifier
 *   missionStatement: string (required) - Workspace mission
 *   color?: string - Workspace color (hex)
 *   emoji?: string - Workspace emoji
 *   description?: string - Workspace description
 * }
 *
 * Response: 201 Created
 * {
 *   success: true,
 *   data: { _id, name, slug, missionStatement, ... }
 * }
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { createErrorResponseObject } from "@/lib/api/routeHelpers";
import { generateRequestId } from "@/lib/api/responses";

/**
 * POST handler for workspace creation (system admin only)
 */
export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const pathname = request.nextUrl.pathname;

  try {
    // Extract API key from headers (set by middleware)
    const callerId = request.headers.get("x-api-key-id");
    if (!callerId) {
      return NextResponse.json(
        createErrorResponseObject(401, "unauthorized", "Unauthorized", "API key required", pathname, requestId),
        { status: 401 }
      );
    }

    // Parse request body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponseObject(400, "invalid_request", "Bad Request", "Invalid JSON body", pathname, requestId),
        { status: 400 }
      );
    }

    // Validate required fields
    const { name, slug, missionStatement, color, emoji, description } = body;
    if (!name || !slug || !missionStatement) {
      return NextResponse.json(
        createErrorResponseObject(
          400,
          "validation_error",
          "Missing Required Fields",
          "name, slug, and missionStatement are required",
          pathname,
          requestId
        ),
        { status: 400 }
      );
    }

    // Call Convex to create workspace
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    try {
      const workspace = await convex.mutation(api.workspaces.create, {
        name,
        slug,
        missionStatement,
        color,
        emoji,
        description,
        callerId,
      });

      return NextResponse.json(
        {
          success: true,
          data: workspace,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 201 }
      );
    } catch (err: any) {
      // Convex errors: unauthorized access, validation, etc.
      const errorMsg = err?.message || String(err);

      // System admin check failed
      if (errorMsg.includes("NOT_FOUND") || errorMsg.includes("Unauthorized")) {
        return NextResponse.json(
          createErrorResponseObject(403, "forbidden", "Forbidden", "Insufficient permissions to create workspace", pathname, requestId),
          { status: 403 }
        );
      }

      // Slug already exists or other validation error
      if (errorMsg.includes("duplicate") || errorMsg.includes("UNIQUE")) {
        return NextResponse.json(
          createErrorResponseObject(409, "conflict", "Conflict", "Workspace slug already exists", pathname, requestId),
          { status: 409 }
        );
      }

      // Generic server error
      console.error("[/api/admin/workspaces POST] Convex error:", err);
      return NextResponse.json(
        createErrorResponseObject(500, "internal_server_error", "Internal Server Error", "Failed to create workspace", pathname, requestId),
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error("[/api/admin/workspaces POST] Unexpected error:", err);
    return NextResponse.json(
      createErrorResponseObject(500, "internal_server_error", "Internal Server Error", "An unexpected error occurred", pathname, requestId),
      { status: 500 }
    );
  }
}
