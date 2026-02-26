/**
 * Range Selection Utility
 *
 * Calculates inclusive range between two items in an ordered list.
 * Used for shift+click multi-select in Kanban board.
 */

/**
 * Given an ordered list of task IDs and two anchor IDs,
 * returns all IDs in the inclusive range between them.
 *
 * @param orderedIds - The complete ordered list of IDs (e.g., tasks in a column)
 * @param fromId - The first anchor ID (e.g., previously clicked task)
 * @param toId - The second anchor ID (e.g., shift+clicked task)
 * @returns An array of IDs in the range (inclusive), or [toId] if either ID is not found
 *
 * @example
 * const ids = ["a", "b", "c", "d", "e"];
 * getTaskIdRange(ids, "b", "d"); // ["b", "c", "d"]
 * getTaskIdRange(ids, "d", "b"); // ["b", "c", "d"] (order doesn't matter)
 * getTaskIdRange(ids, "b", "b"); // ["b"]
 * getTaskIdRange(ids, "x", "d"); // ["d"] (x not found)
 */
export function getTaskIdRange(
  orderedIds: string[],
  fromId: string,
  toId: string
): string[] {
  const fromIdx = orderedIds.indexOf(fromId);
  const toIdx = orderedIds.indexOf(toId);

  // If either ID is not found, return just the toId
  if (fromIdx === -1 || toIdx === -1) {
    return [toId];
  }

  // Get the range in correct order (low to high index)
  const [start, end] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
  return orderedIds.slice(start, end + 1);
}
