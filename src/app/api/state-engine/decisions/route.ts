/**
 * GET /api/state-engine/decisions
 * Get decision audit trail for pattern analysis
 *
 * Query params:
 * - workspaceId: required
 * - since: optional (timestamp in ms)
 * - action: optional (escalated, reassigned, unblocked, marked_executed, deprioritized)
 * - limit: optional (default: 50)
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    const since = searchParams.get("since");
    const action = searchParams.get("action");
    const limit = searchParams.get("limit");

    if (!workspaceId) {
      return Response.json(
        { error: "workspaceId parameter required" },
        { status: 400 }
      );
    }

    const decisions = await convex.query(api.decisions.getBy, {
      workspaceId: workspaceId as any,
      since: since ? parseInt(since) : undefined,
      action: action || undefined,
      limit: limit ? parseInt(limit) : 50,
    });

    // Also get pattern analysis
    const patterns = await convex.query(api.decisions.analyzePatterns, {
      workspaceId: workspaceId as any,
      since: since ? parseInt(since) : undefined,
    });

    return Response.json({
      workspaceId,
      decisions,
      patterns,
      count: decisions.length,
    });
  } catch (error: any) {
    console.error("Error fetching decisions:", error);
    return Response.json(
      { error: "Failed to fetch decisions", details: error.message },
      { status: 500 }
    );
  }
}
