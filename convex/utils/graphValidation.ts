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
  const visited = new Set<string>();
  const stack: Id<"tasks">[] = [blockedByTaskId];

  while (stack.length > 0) {
    const currentId = stack.pop()!;

    // Found a path from blockedByTaskId back to taskId - cycle detected
    if (currentId === taskId) {
      return true;
    }

    // Skip if already visited
    if (visited.has(currentId as string)) {
      continue;
    }
    visited.add(currentId as string);

    // Get current task's dependencies
    const currentTask = await ctx.db.get(currentId);
    if (!currentTask) {
      continue;
    }

    // Add all tasks that blockedByTaskId is blocked by to the stack
    // (traverse upward in dependency graph)
    if (currentTask.blockedBy && currentTask.blockedBy.length > 0) {
      for (const depId of currentTask.blockedBy) {
        stack.push(depId);
      }
    }
  }

  // No path found from blockedByTaskId to taskId - no cycle
  return false;
}

/**
 * Get all transitive dependencies (entire dependency tree)
 *
 * Returns all tasks that this task depends on, either directly or transitively.
 * Useful for displaying full dependency chain or analyzing impact of changes.
 *
 * @param ctx - Convex query context
 * @param taskId - The task to get dependencies for
 * @returns Array of task IDs that this task depends on
 */
export async function getTransitiveDependencies(
  ctx: QueryCtx,
  taskId: Id<"tasks">
): Promise<Id<"tasks">[]> {
  const visited = new Set<string>();
  const stack: Id<"tasks">[] = [taskId];

  while (stack.length > 0) {
    const currentId = stack.pop()!;

    if (visited.has(currentId as string)) {
      continue;
    }
    visited.add(currentId as string);

    const task = await ctx.db.get(currentId);
    if (!task) {
      continue;
    }

    // Add all tasks that this task is blocked by
    if (task.blockedBy && task.blockedBy.length > 0) {
      for (const depId of task.blockedBy) {
        stack.push(depId);
      }
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
 * @param ctx - Convex query context
 * @param taskId - The task to get dependents for
 * @returns Array of task IDs that depend on this task
 */
export async function getTransitiveDependents(
  ctx: QueryCtx,
  taskId: Id<"tasks">
): Promise<Id<"tasks">[]> {
  const visited = new Set<string>();
  const stack: Id<"tasks">[] = [taskId];

  while (stack.length > 0) {
    const currentId = stack.pop()!;

    if (visited.has(currentId as string)) {
      continue;
    }
    visited.add(currentId as string);

    const task = await ctx.db.get(currentId);
    if (!task) {
      continue;
    }

    // Add all tasks that this task blocks
    if (task.blocks && task.blocks.length > 0) {
      for (const depId of task.blocks) {
        stack.push(depId);
      }
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
 * @param ctx - Convex query context
 * @param taskId - The task to analyze
 * @returns Array representing the critical path (longest chain)
 */
export async function getCriticalPath(
  ctx: QueryCtx,
  taskId: Id<"tasks">
): Promise<Id<"tasks">[]> {
  const memo = new Map<string, Id<"tasks">[]>();

  async function getLongestPath(
    currentId: Id<"tasks">
  ): Promise<Id<"tasks">[]> {
    const currentKey = currentId as string;

    if (memo.has(currentKey)) {
      return memo.get(currentKey)!;
    }

    const task = await ctx.db.get(currentId);
    if (!task || !task.blockedBy || task.blockedBy.length === 0) {
      return [currentId];
    }

    let longestDependency: Id<"tasks">[] = [];
    for (const depId of task.blockedBy) {
      const path = await getLongestPath(depId);
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
