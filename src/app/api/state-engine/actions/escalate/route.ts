/**
 * POST /api/state-engine/actions/escalate
 * Escalate a task to P0 (highest priority)
 *
 * Body:
 * {
 *   businessId: string (ID of business)
 *   taskId: string (ID of task)
 *   reason: string (why escalating)
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

    const result = await convex.mutation(api.actions.escalateTask, {
      taskId: taskId as any,
      reason,
      decidedBy,
    });

    return Response.json({
      action: "escalated",
      ...result,
    });
  } catch (error: any) {
    console.error("Error escalating task:", error);
    return Response.json(
      { error: "Failed to escalate task", details: error.message },
      { status: 500 }
    );
  }
}
