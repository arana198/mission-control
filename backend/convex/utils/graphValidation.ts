/**
 * Graph Validation Utilities
 *
 * Provides cycle detection for task dependency graphs using DFS.
 * Prevents circular dependencies that would create deadlocks.
 */

import { QueryCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Detect if adding a dependency would create a cycle
 *
 * Algorithm: DFS traversal from blockedByTaskId to see if it can reach taskId.
 * If blockedByTaskId depends on taskId (directly or transitively),
 * then adding taskId -> blockedByTaskId would create a cycle.
 *
 * OPTIMIZATION (Phase 4): Preload entire task graph before DFS to eliminate per-node DB calls.
 * Instead of N+1 queries (1 for each task in the path), this now does 1 query to preload
 * all tasks for the workspace, then performs DFS entirely in-memory.
 *
 * @param ctx - Convex query context
 * @param taskId - The task that would be blocked
 * @param blockedByTaskId - The task that would block it
 * @returns true if a cycle would be created
 */
export async function detectCycle(
  ctx: QueryCtx,
  taskId: Id<"tasks">,
  blockedByTaskId: Id<"tasks">
): Promise<boolean> {
  // Preload the source task to get workspace context
  const sourceTask = await ctx.db.get(blockedByTaskId);
  if (!sourceTask) return false;

  // Phase 4: Preload entire graph for this workspace in ONE query
  const allTasks = await ctx.db
    .query("tasks")
    .withIndex("by_workspace", (q: any) => q.eq("workspaceId", (sourceTask as any).workspaceId))
    .take(500); // Reasonable cap for single business

  // Build in-memory map of task ID -> blockedBy array
  const depMap = new Map<string, string[]>(
    allTasks.map((t: any) => [t._id as string, ((t as any).blockedBy || []) as string[]])
  );

  // Pure in-memory DFS - no further DB calls
  const visited = new Set<string>();
  const stack: string[] = [blockedByTaskId as string];

  while (stack.length > 0) {
    const currentId = stack.pop()!;

    // Found a path from blockedByTaskId back to taskId - cycle detected
    if (currentId === (taskId as string)) {
      return true;
    }

    // Skip if already visited
    if (visited.has(currentId)) {
      continue;
    }
    visited.add(currentId);

    // Get current task's dependencies from preloaded map (no DB call)
    const deps = depMap.get(currentId) || [];

    // Add all tasks that this task is blocked by to the stack
    for (const depId of deps) {
      stack.push(depId);
    }
  }

  // No path found - no cycle
  return false;
}

/**
 * Get all transitive dependencies (entire dependency tree)
 *
 * Returns all tasks that this task depends on, either directly or transitively.
 * Useful for displaying full dependency chain or analyzing impact of changes.
 *
 * OPTIMIZATION (Phase 4): Preload entire task graph before DFS to eliminate per-node DB calls.
 *
 * @param ctx - Convex query context
 * @param taskId - The task to get dependencies for
 * @returns Array of task IDs that this task depends on
 */
export async function getTransitiveDependencies(
  ctx: QueryCtx,
  taskId: Id<"tasks">
): Promise<Id<"tasks">[]> {
  // Preload source task to get workspace context
  const sourceTask = await ctx.db.get(taskId);
  if (!sourceTask) return [];

  // Phase 4: Preload entire graph for this business
  const allTasks = await ctx.db
    .query("tasks")
    .withIndex("by_workspace", (q: any) => q.eq("workspaceId", (sourceTask as any).workspaceId))
    .take(500);

  // Build in-memory map of task ID -> blockedBy array
  const depMap = new Map<string, string[]>(
    allTasks.map((t: any) => [t._id as string, ((t as any).blockedBy || []) as string[]])
  );

  // Pure in-memory DFS
  const visited = new Set<string>();
  const stack: string[] = [taskId as string];

  while (stack.length > 0) {
    const currentId = stack.pop()!;

    if (visited.has(currentId)) {
      continue;
    }
    visited.add(currentId);

    // Get dependencies from preloaded map (no DB call)
    const deps = depMap.get(currentId) || [];

    // Add all tasks that this task is blocked by
    for (const depId of deps) {
      stack.push(depId);
    }
  }

  // Remove the original task from results
  visited.delete(taskId as string);
  return Array.from(visited) as Id<"tasks">[];
}

/**
 * Get all tasks that depend on this task (dependents)
 *
 * Returns all tasks that would be affected if this task's status changes.
 * Useful for impact analysis.
 *
 * OPTIMIZATION (Phase 4): Preload entire task graph before DFS to eliminate per-node DB calls.
 *
 * @param ctx - Convex query context
 * @param taskId - The task to get dependents for
 * @returns Array of task IDs that depend on this task
 */
export async function getTransitiveDependents(
  ctx: QueryCtx,
  taskId: Id<"tasks">
): Promise<Id<"tasks">[]> {
  // Preload source task to get workspace context
  const sourceTask = await ctx.db.get(taskId);
  if (!sourceTask) return [];

  // Phase 4: Preload entire graph for this business
  const allTasks = await ctx.db
    .query("tasks")
    .withIndex("by_workspace", (q: any) => q.eq("workspaceId", (sourceTask as any).workspaceId))
    .take(500);

  // Build in-memory map of task ID -> blocks array
  const depMap = new Map<string, string[]>(
    allTasks.map((t: any) => [t._id as string, ((t as any).blocks || []) as string[]])
  );

  // Pure in-memory DFS
  const visited = new Set<string>();
  const stack: string[] = [taskId as string];

  while (stack.length > 0) {
    const currentId = stack.pop()!;

    if (visited.has(currentId)) {
      continue;
    }
    visited.add(currentId);

    // Get blocking relationships from preloaded map (no DB call)
    const blocks = depMap.get(currentId) || [];

    // Add all tasks that this task blocks
    for (const depId of blocks) {
      stack.push(depId);
    }
  }

  // Remove the original task from results
  visited.delete(taskId as string);
  return Array.from(visited) as Id<"tasks">[];
}

/**
 * Get critical path - longest dependency chain
 *
 * Finds the longest chain of dependencies from this task.
 * Useful for identifying blocking bottlenecks.
 *
 * OPTIMIZATION (Phase 4): Preload entire task graph before recursive traversal to eliminate per-node DB calls.
 *
 * @param ctx - Convex query context
 * @param taskId - The task to analyze
 * @returns Array representing the critical path (longest chain)
 */
export async function getCriticalPath(
  ctx: QueryCtx,
  taskId: Id<"tasks">
): Promise<Id<"tasks">[]> {
  // Preload source task to get workspace context
  const sourceTask = await ctx.db.get(taskId);
  if (!sourceTask) return [taskId];

  // Phase 4: Preload entire graph for this business
  const allTasks = await ctx.db
    .query("tasks")
    .withIndex("by_workspace", (q: any) => q.eq("workspaceId", (sourceTask as any).workspaceId))
    .take(500);

  // Build in-memory map of task ID -> blockedBy array
  const depMap = new Map<string, string[]>(
    allTasks.map((t: any) => [t._id as string, ((t as any).blockedBy || []) as string[]])
  );

  const memo = new Map<string, Id<"tasks">[]>();

  // Pure recursive function on preloaded graph (no DB calls)
  function getLongestPath(currentId: Id<"tasks">): Id<"tasks">[] {
    const currentKey = currentId as string;

    if (memo.has(currentKey)) {
      return memo.get(currentKey)!;
    }

    const deps = depMap.get(currentKey) || [];
    if (deps.length === 0) {
      return [currentId];
    }

    let longestDependency: Id<"tasks">[] = [];
    for (const depId of deps) {
      const path = getLongestPath(depId as Id<"tasks">);
      if (path.length > longestDependency.length) {
        longestDependency = path;
      }
    }

    const result = [currentId, ...longestDependency];
    memo.set(currentKey, result);
    return result;
  }

  return getLongestPath(taskId);
}
