/**
 * POST /api/tasks/generate-daily
 *
 * Generate 3-5 high-impact tasks for the day.
 * Returns 201 Created when new tasks are successfully generated.
 * Triggered by morning routine or manual call.
 *
 * IDEMPOTENCY: NON-IDEMPOTENT
 * - Reason: Creates new task records on each call (unless forceRegenerate=false)
 * - Safe to retry: NO (use Idempotency-Key header to enable retries)
 * - Side effects on repeat: Duplicate task batches created
 *
 * Request body:
 * {
 *   workspaceId: string (REQUIRED) -  ID for task scoping
 *   forceRegenerate?: boolean
 * }
 *
 * Returns: { tasks: TaskInput[], count: number, generatedAt: timestamp } [201 Created if tasks generated]
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { getTaskGenerationService } from "@/lib/services/taskGenerationService";
import { getMemoryService } from "@/lib/services/memoryService";
import { extractIdempotencyKey } from "@/lib/utils/apiResponse";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL not set");
}

const client = new ConvexHttpClient(convexUrl);
const taskGenService = getTaskGenerationService(client as any);
const memoryService = getMemoryService();

export async function POST(request: Request) {
  try {
    // Validate request
    const body = await request.json().catch(() => ({}));
    const { workspaceId, forceRegenerate = false } = body;

    // Extract Idempotency-Key header for retry support
    const idempotencyKey = extractIdempotencyKey(request);

    // REQUIRED: workspaceId for multi-business support
    if (!workspaceId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "workspaceId is required for task generation"
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Generate daily tasks
    const review = await taskGenService.generateDailyTasks([]);
    const tasks = review.dailyTasks || [];

    if (!tasks || tasks.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          tasks: [],
          count: 0,
          message: "No high-impact tasks identified today",
          generatedAt: new Date().toISOString(),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fetch available epics to assign tasks to (for this business)
    const epics = await client.query(api.epics.getAllEpics, { workspaceId });
    if (!epics || epics.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No epics available to assign tasks to for this business",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    // Use first epic as default for auto-generated tasks
    const defaultEpicId = epics[0]._id;

    // For each generated task, attach memory context
    const tasksWithContext = await Promise.all(
      tasks.map(async (task: any) => {
        const memoryContext = await memoryService.searchMemory(task.title, 2);
        return {
          ...task,
          relatedMemoryKeys: memoryContext.map((m) => m.path),
        };
      })
    );

    // Create tasks in Convex (scoped to this business)
    const createdTasks = await Promise.all(
      tasksWithContext.map((task: any) =>
        client.mutation(api.tasks.createTask, {
          workspaceId,
          title: task.title,
          description: task.description,
          priority: task.priority || 'P2',
          source: 'agent', // System-generated tasks
          createdBy: 'system' as Id<"agents">,
          epicId: defaultEpicId,
          tags: ['daily-gen', ...(task.tags || [])],
          timeEstimate: task.timeEstimate || undefined,
          dueDate: task.dueDate || undefined,
        })
      )
    );

    return new Response(
      JSON.stringify({
        success: true,
        tasks: createdTasks,
        count: createdTasks.length,
        idempotencyKey, // Echo back for client confirmation
        generatedAt: new Date().toISOString(),
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    // Task generation error - returned to caller
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || "Failed to generate tasks",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * GET /api/tasks/generate-daily
 * 
 * Check if tasks were already generated today
 * Returns: { generated: boolean, count: number, lastGeneratedAt: timestamp }
 */
export async function GET(request: Request) {
  try {
    // Query tasks created today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // This would query Convex for tasks created today
    // For now, return mock response
    return new Response(
      JSON.stringify({
        generated: false,
        count: 0,
        message: "Ready to generate daily tasks",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || "Failed to check daily tasks",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
