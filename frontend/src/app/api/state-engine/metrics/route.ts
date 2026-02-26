/**
 * GET /api/state-engine/metrics
 * Get operational metrics snapshot for current business
 * Used by OpenClaw to understand current system state
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return Response.json(
        { error: "workspaceId parameter required" },
        { status: 400 }
      );
    }

    const metrics = await convex.query(api.opsMetrics.getSnapshot, {
      workspaceId: workspaceId as any,
    });

    return Response.json(metrics);
  } catch (error: any) {
    console.error("Error fetching metrics:", error);
    return Response.json(
      { error: "Failed to fetch metrics", details: error.message },
      { status: 500 }
    );
  }
}
