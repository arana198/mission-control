/**
 * GET /api/epics
 *
 * List all available epics for agents to choose from when creating tasks
 * Each epic must be assigned to a task at creation time
 *
 * Query params: businessId (required)
 * Response: { success, epics: [{ id, title, description, status, progress }] }
 *
 * Replaces: GET /api/epics/list
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { createLogger } from "@/lib/utils/logger";

const log = createLogger("api:epics");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");

    if (!businessId) {
      return jsonResponse(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "businessId is required" },
        },
        400
      );
    }

    // Query epics for this business
    const epics = await convex.query(api.epics.getAllEpics, { businessId: businessId as any });

    // Format response
    const formatted = (epics || []).map((epic: any) => ({
      id: epic._id,
      title: epic.title,
      description: epic.description,
      status: epic.status,
      progress: epic.progress,
      taskCount: epic.taskIds?.length || 0,
    }));

    log.info("Epics queried", {
      count: formatted.length,
    });

    return jsonResponse({
      success: true,
      epics: formatted,
      message: `Found ${formatted.length} epic(s)`,
    });
  } catch (error) {
    log.error("Error listing epics", { error });
    return jsonResponse({ error: (error as any).message || "Internal server error" }, 500);
  }
}
