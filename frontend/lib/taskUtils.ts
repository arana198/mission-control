/**
 * Task utility functions
 *
 * Date-related helpers for task due dates, used across components.
 */

/**
 * Check if a task is overdue (more than 1 day past due date)
 * @param dueDate - timestamp in milliseconds
 * @returns true if dueDate is more than 24 hours in the past
 */
export function isOverdue(dueDate?: number): boolean {
  if (!dueDate) return false;
  const ONE_DAY_IN_MS = 86400000; // 24 hours in milliseconds
  return Date.now() > dueDate && Date.now() - dueDate >= ONE_DAY_IN_MS;
}

/**
 * Check if a task is due soon (within 48 hours from now)
 * @param dueDate - timestamp in milliseconds
 * @returns true if dueDate is in the future but within 48 hours
 */
export function isDueSoon(dueDate?: number): boolean {
  if (!dueDate) return false;
  const TWO_DAYS_IN_MS = 86400000 * 2; // 48 hours in milliseconds
  const diff = dueDate - Date.now();
  return diff > 0 && diff <= TWO_DAYS_IN_MS;
}
