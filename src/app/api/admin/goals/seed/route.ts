import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * POST /api/admin/goals/seed
 *
 * Creates demo goals linked to existing tasks
 * For testing and demo purposes only
 *
 * Replaces: POST /api/goals/seed-demo
 */
export async function POST(request: Request) {
  try {
    const result = await client.mutation(api.goals.seedDemoGoals);

    return Response.json(
      {
        success: true,
        message: "Demo goals created successfully",
        data: result,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[admin:goals:seed] Error:", error);
    return Response.json(
      {
        success: false,
        error: error?.message || "Failed to seed demo goals",
      },
      { status: 500 }
    );
  }
}
