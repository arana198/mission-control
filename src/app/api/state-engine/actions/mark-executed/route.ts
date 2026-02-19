/**
 * POST /api/state-engine/actions/mark-executed
 * Mark a task as completed/executed
 *
 * Body:
 * {
 *   businessId: string
 *   taskId: string
 *   outcome: string (description of what was accomplished)
 *   decidedBy: string (usually "openclaw")
 * }
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, taskId, outcome, decidedBy } = body;

    if (!businessId || !taskId || !outcome || !decidedBy) {
      return Response.json(
        { error: "Missing required fields: businessId, taskId, outcome, decidedBy" },
        { status: 400 }
      );
    }

    const result = await convex.mutation(api.actions.markExecuted, {
      taskId: taskId as any,
      outcome,
      decidedBy,
    });

    return Response.json({
      action: "marked_executed",
      ...result,
    });
  } catch (error: any) {
    console.error("Error marking task executed:", error);
    return Response.json(
      { error: "Failed to mark task executed", details: error.message },
      { status: 500 }
    );
  }
}
