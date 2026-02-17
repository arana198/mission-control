/**
 * useSetState Hook
 *
 * Provides a clean API for managing Set state in React components.
 * Eliminates repeated Set manipulation logic.
 *
 * Usage:
 * ```tsx
 * const { set: selectedTasks, toggle, selectAll, clear, add, remove } = useSetState<string>();
 *
 * // In handlers:
 * toggle(taskId);           // Add or remove item
 * selectAll(allTaskIds);    // Replace set with new items
 * clear();                  // Empty the set
 * add(taskId);              // Add single item
 * remove(taskId);           // Remove single item
 * ```
 */

import { useCallback, useState } from 'react';

interface UseSetStateResult<T> {
  set: Set<T>;
  toggle: (item: T) => void;
  add: (item: T) => void;
  remove: (item: T) => void;
  clear: () => void;
  addAll: (items: T[]) => void;
  has: (item: T) => boolean;
  size: number;
}

/**
 * Hook for managing Set state with common operations
 * @param initial - Initial set of items (default: empty Set)
 * @returns Object with set and operation methods
 */
export function useSetState<T>(initial: Set<T> = new Set()): UseSetStateResult<T> {
  const [set, setSet] = useState<Set<T>>(initial);

  const toggle = useCallback((item: T) => {
    setSet((prevSet) => {
      const newSet = new Set(prevSet);
      if (newSet.has(item)) {
        newSet.delete(item);
      } else {
        newSet.add(item);
      }
      return newSet;
    });
  }, []);

  const add = useCallback((item: T) => {
    setSet((prevSet) => {
      const newSet = new Set(prevSet);
      newSet.add(item);
      return newSet;
    });
  }, []);

  const remove = useCallback((item: T) => {
    setSet((prevSet) => {
      const newSet = new Set(prevSet);
      newSet.delete(item);
      return newSet;
    });
  }, []);

  const clear = useCallback(() => {
    setSet(new Set());
  }, []);

  const addAll = useCallback((items: T[]) => {
    setSet(new Set(items));
  }, []);

  const has = useCallback((item: T) => {
    return set.has(item);
  }, [set]);

  return {
    set,
    toggle,
    add,
    remove,
    clear,
    addAll,
    has,
    size: set.size,
  };
}
