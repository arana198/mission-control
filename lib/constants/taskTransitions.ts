/**
 * Task state transition rules.
 * Defines which status transitions are allowed in the task lifecycle.
 */
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  backlog: ["ready", "blocked"],
  ready: ["in_progress", "backlog", "blocked"],
  in_progress: ["review", "blocked", "done", "ready"],
  review: ["done", "in_progress", "blocked"],
  blocked: ["ready", "backlog"],
  done: [], // Terminal state — no transitions allowed
};

/**
 * Check if a transition from one status to another is allowed.
 */
export function isTransitionAllowed(from: string, to: string): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
