/**
 * POST /api/state-engine/actions/reassign
 * Reassign a task to a different agent
 *
 * Body:
 * {
 *   businessId: string
 *   taskId: string
 *   toAgent: string (agent ID to assign to)
 *   reason: string
 *   decidedBy: string (usually "openclaw")
 * }
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, taskId, toAgent, reason, decidedBy } = body;

    if (!businessId || !taskId || !toAgent || !reason || !decidedBy) {
      return Response.json(
        { error: "Missing required fields: businessId, taskId, toAgent, reason, decidedBy" },
        { status: 400 }
      );
    }

    const result = await convex.mutation(api.actions.reassignTask, {
      taskId: taskId as any,
      toAgent,
      reason,
      decidedBy,
    });

    return Response.json({
      action: "reassigned",
      ...result,
    });
  } catch (error: any) {
    console.error("Error reassigning task:", error);
    return Response.json(
      { error: "Failed to reassign task", details: error.message },
      { status: 500 }
    );
  }
}
