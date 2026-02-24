/**
 * useDebounce Hook
 *
 * Debounces a value and returns the debounced version.
 * Useful for search inputs, filter fields, etc. to avoid excessive re-renders.
 *
 * Example:
 *   const debouncedSearchQuery = useDebounce(searchQuery, 300);
 *   useEffect(() => {
 *     // This effect runs with debouncedSearchQuery, not searchQuery
 *   }, [debouncedSearchQuery]);
 */

import { useState, useEffect } from "react";

export function useDebounce<T>(value: T, delayMs: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
