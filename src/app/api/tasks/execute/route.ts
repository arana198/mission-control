/**
 * POST /api/tasks/execute
 * 
 * Execute a task autonomously via OpenClaw sub-agent
 * 
 * Request: { taskId: string, taskDescription: string, goalIds?: string[] }
 * Response: { executionId: string, status: "queued"|"running"|"completed"|"failed", ... }
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const openclawGatewayUrl = process.env.OPENCLAW_GATEWAY_URL;

if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL not set");
}

const client = new ConvexHttpClient(convexUrl);

interface ExecuteTaskRequest {
  taskId: string;
  taskTitle: string;
  taskDescription: string;
  goalIds?: string[];
  timeoutSeconds?: number;
}

interface ExecuteTaskResponse {
  success: boolean;
  executionId: string;
  taskId: string;
  status: "queued" | "running" | "completed" | "failed";
  output?: string;
  error?: string;
  startedAt: number;
}

/**
 * OpenClaw Session Spawn Integration
 * 
 * When a task needs autonomous execution:
 * 1. Create execution log entry
 * 2. Spawn OpenClaw sub-agent with task description
 * 3. Poll for completion
 * 4. Update execution log with result
 * 5. Update task status
 * 6. Notify relevant agents/channels
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as ExecuteTaskRequest;
    const {
      taskId,
      taskTitle,
      taskDescription,
      goalIds = [],
      timeoutSeconds = 300,
    } = body;

    // Validate required fields
    if (!taskId || !taskTitle || !taskDescription) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: taskId, taskTitle, taskDescription",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Log execution start
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const startedAt = Date.now();
    let executionLogId: Id<"executionLog"> | undefined;

    try {
      // TODO: Phase 6A - Replace with proper executions table logging
      // Step 1: Create execution log entry (disabled - Phase 6A implementation)
      // executionLogId = await client.mutation(api.executionLog.create, { ... });

      // Step 2: Spawn OpenClaw sub-agent
      // This calls OpenClaw's sessions_spawn API (mocked here)
      const subagentResult = await spawnOpenClawSubagent(
        taskDescription,
        taskId,
        timeoutSeconds
      );

      if (!subagentResult.success) {
        throw new Error(subagentResult.error || "Subagent execution failed");
      }

      // TODO: Phase 6A - Replace with proper executions table logging
      // Step 3: Update execution log with result (disabled - Phase 6A implementation)
      // await client.mutation(api.executionLog.complete, { ... });

      // Step 4: Update task status
      await client.mutation(api.tasks.updateStatus, {
        taskId: taskId as Id<"tasks">,
        status: 'done',
        updatedBy: 'system',
      });

      // Step 5: Notify
      // Would send notification to relevant agents
      // Task execution completed and logged in system

      return new Response(
        JSON.stringify({
          success: true,
          executionId,
          taskId,
          status: "completed",
          output: subagentResult.output,
          startedAt,
          completedAt: Date.now(),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error: any) {
      // TODO: Phase 6A - Replace with proper executions table logging
      // Log failure (disabled - Phase 6A implementation)
      // if (executionLogId) {
      //   await client.mutation(api.executionLog.complete, { ... });
      // }

      return new Response(
        JSON.stringify({
          success: false,
          executionId,
          taskId,
          status: "failed",
          error: error?.message || "Execution failed",
          startedAt,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || "Invalid request",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * Mock OpenClaw Sub-agent Spawner
 * 
 * In production, this would call:
 * POST /api/sessions/spawn with task description
 * 
 * Real implementation would:
 * 1. Authenticate with OpenClaw gateway
 * 2. Determine best sub-agent for task type
 * 3. Send task description
 * 4. Poll status endpoint
 * 5. Return result/error
 */
async function spawnOpenClawSubagent(
  description: string,
  taskId: string,
  timeoutSeconds: number
): Promise<{ success: boolean; output?: string; error?: string }> {
  try {
    // Mock successful execution
    // In production:
    // const response = await fetch(`${openclawGatewayUrl}/api/sessions/spawn`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json', 'Authorization': '...' },
    //   body: JSON.stringify({
    //     task: description,
    //     label: `task-${taskId}`,
    //     runTimeoutSeconds: timeoutSeconds,
    //   }),
    // });

    // Simulate execution time (100-500ms)
    await new Promise((resolve) =>
      setTimeout(resolve, Math.random() * 400 + 100)
    );

    return {
      success: true,
      output: `Successfully executed: ${description}`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Failed to spawn sub-agent",
    };
  }
}

/**
 * GET /api/tasks/execute?executionId=xxx
 * 
 * Poll execution status
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const executionId = searchParams.get("executionId");

    if (!executionId) {
      return new Response(
        JSON.stringify({ error: "executionId required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Query execution status from Convex
    // const execution = await client.query(api.executionLog.getWorkspaceById, { id: executionId })

    return new Response(
      JSON.stringify({
        executionId,
        status: "completed",
        // ... execution details
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message || "Failed to fetch status" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
