/**
 * GET /api/state-engine/alerts
 * Get current operational alerts for OpenClaw
 *
 * Query params:
 * - workspaceId: required
 * - unreadOnly: optional (default: true)
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    const unreadOnly = searchParams.get("unreadOnly") !== "false";

    if (!workspaceId) {
      return Response.json(
        { error: "workspaceId parameter required" },
        { status: 400 }
      );
    }

    // Get all alerts for business
    const allAlerts = await convex.query(api.alertRules.getBy, {
      workspaceId: workspaceId as any,
      enabledOnly: true,
    });

    return Response.json({
      workspaceId,
      rules: allAlerts,
      count: allAlerts.length,
    });
  } catch (error: any) {
    console.error("Error fetching alerts:", error);
    return Response.json(
      { error: "Failed to fetch alerts", details: error.message },
      { status: 500 }
    );
  }
}
