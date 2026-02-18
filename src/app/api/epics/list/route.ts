/**
 * GET /api/epics/list
 *
 * List all available epics for agents to choose from when creating tasks
 * Each epic must be assigned to a task at creation time
 *
 * Query params: agentId?, agentKey?
 * Response: { success, epics: [{ id, title, description, status, progress }] }
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { createLogger } from "@/lib/utils/logger";

const log = createLogger("api:epics:list");
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(request: Request): Promise<Response> {
  try {
    // Note: No authentication required for reading epics (public data)
    // If you want to restrict this later, add agentId/agentKey params

    // Query all epics
    const epics = await convex.query(api.epics.getAllEpics);

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
