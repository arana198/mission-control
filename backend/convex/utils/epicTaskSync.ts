/**
 * Epic-Task Bidirectional Synchronization
 * DM-02: Centralized helper to maintain epic-task relationships
 */

import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Synchronize a task's epic relationship bidirectionally.
 * Moves a task from one epic to another while maintaining referential integrity.
 *
 * Safe to call with null/undefined for either epic ID.
 * Prevents duplicate entries in epic.taskIds array.
 */
export async function syncEpicTaskLink(
  ctx: MutationCtx,
  taskId: Id<"tasks">,
  oldEpicId: Id<"epics"> | undefined,
  newEpicId: Id<"epics"> | undefined
): Promise<void> {
  // Remove from old epic if it exists and is different from new epic
  if (oldEpicId && oldEpicId !== newEpicId) {
    const oldEpic = await ctx.db.get(oldEpicId);
    if (oldEpic) {
      await ctx.db.patch(oldEpicId, {
        taskIds: (oldEpic.taskIds || []).filter((id) => id !== taskId),
        updatedAt: Date.now(),
      });
    }
  }

  // Add to new epic if it exists (with deduplication)
  if (newEpicId) {
    const newEpic = await ctx.db.get(newEpicId);
    if (newEpic && !newEpic.taskIds.includes(taskId)) {
      await ctx.db.patch(newEpicId, {
        taskIds: [...newEpic.taskIds, taskId],
        updatedAt: Date.now(),
      });
    }
  }
}
