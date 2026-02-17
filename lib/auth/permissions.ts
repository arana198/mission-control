/**
 * Authorization and Permissions
 * SEC-01: Centralized access control for mutations
 */

/**
 * System actors that are allowed to perform privileged operations.
 * These must be validated server-side, never trusted from client.
 */
export const SYSTEM_ACTOR_IDS = new Set(["user", "system", "jarvis", "system:auto-claim"]);

/**
 * Check if an actor ID is authorized to perform system operations.
 */
export function isAuthorizedActor(actorId: string): boolean {
  return SYSTEM_ACTOR_IDS.has(actorId);
}

/**
 * Check if an actor can delete a task.
 * Only the task creator or authorized system actors can delete.
 */
export function canDeleteTask(task: { createdBy: string }, deletedBy: string): boolean {
  return task.createdBy === deletedBy || SYSTEM_ACTOR_IDS.has(deletedBy);
}
