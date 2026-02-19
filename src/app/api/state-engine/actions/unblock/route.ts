/**
 * POST /api/state-engine/actions/unblock
 * Unblock a blocked task
 *
 * Body:
 * {
 *   businessId: string
 *   taskId: string
 *   reason: string (why unblocking)
 *   decidedBy: string (usually "openclaw")
 * }
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, taskId, reason, decidedBy } = body;

    if (!businessId || !taskId || !reason || !decidedBy) {
      return Response.json(
        { error: "Missing required fields: businessId, taskId, reason, decidedBy" },
        { status: 400 }
      );
    }

    const result = await convex.mutation(api.actions.unblockTask, {
      taskId: taskId as any,
      reason,
      decidedBy,
    });

    return Response.json({
      action: "unblocked",
      ...result,
    });
  } catch (error: any) {
    console.error("Error unblocking task:", error);
    return Response.json(
      { error: "Failed to unblock task", details: error.message },
      { status: 500 }
    );
  }
}
