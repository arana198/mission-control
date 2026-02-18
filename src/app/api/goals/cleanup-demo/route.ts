import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * POST /api/goals/cleanup-demo
 *
 * Archives demo goals created within the last hour
 * Safe cleanup that won't affect manually created goals
 */
export async function POST(request: Request) {
  try {
    const result = await client.mutation(api.goals.archiveDemoGoals);

    return Response.json(
      {
        success: true,
        message: `Archived ${result.archived} demo goal(s)`,
        data: result,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[cleanup-demo] Error:", error);
    return Response.json(
      {
        success: false,
        error: error?.message || "Failed to cleanup demo goals",
      },
      { status: 500 }
    );
  }
}
