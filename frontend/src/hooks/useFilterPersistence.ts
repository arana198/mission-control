import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Persist filter state to localStorage
 *
 * Saves filter values to localStorage on mount (if available) and on every change (debounced).
 * Falls back to defaults if localStorage is unavailable or JSON is corrupt.
 *
 * @param key - localStorage key prefix (e.g., "kanban-filters")
 * @param defaults - Default values for all filters
 * @returns [filterState, setterFunctions]
 */
export interface FilterState {
  searchQuery: string;
  filterPriority: string;
  filterAssignee: string;
  filterEpic: string;
  filterStatus: string;
  showBlockedOnly: boolean;
}

export function useFilterPersistence(
  key: string,
  defaults: FilterState
): [FilterState, {
  setSearchQuery: (value: string) => void;
  setFilterPriority: (value: string) => void;
  setFilterAssignee: (value: string) => void;
  setFilterEpic: (value: string) => void;
  setFilterStatus: (value: string) => void;
  setShowBlockedOnly: (value: boolean) => void;
  clearAll: () => void;
}] {
  // Initialize state from localStorage or defaults
  const [filters, setFilters] = useState<FilterState>(defaults);
  const [hasLoaded, setHasLoaded] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate that parsed object has expected structure
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          "searchQuery" in parsed &&
          "filterPriority" in parsed &&
          "filterAssignee" in parsed &&
          "filterEpic" in parsed &&
          "filterStatus" in parsed &&
          "showBlockedOnly" in parsed
        ) {
          setFilters(parsed as FilterState);
        }
      }
    } catch (err) {
      // localStorage not available or JSON corrupt - use defaults silently
    }
    setHasLoaded(true);
  }, [key]);

  // Save to localStorage (debounced)
  useEffect(() => {
    if (!hasLoaded) return;

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(filters));
      } catch (err) {
        // localStorage not available - fail silently
      }
    }, 500); // debounce 500ms

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [filters, key, hasLoaded]);

  const setSearchQuery = useCallback((value: string) => {
    setFilters(prev => ({ ...prev, searchQuery: value }));
  }, []);

  const setFilterPriority = useCallback((value: string) => {
    setFilters(prev => ({ ...prev, filterPriority: value }));
  }, []);

  const setFilterAssignee = useCallback((value: string) => {
    setFilters(prev => ({ ...prev, filterAssignee: value }));
  }, []);

  const setFilterEpic = useCallback((value: string) => {
    setFilters(prev => ({ ...prev, filterEpic: value }));
  }, []);

  const setFilterStatus = useCallback((value: string) => {
    setFilters(prev => ({ ...prev, filterStatus: value }));
  }, []);

  const setShowBlockedOnly = useCallback((value: boolean) => {
    setFilters(prev => ({ ...prev, showBlockedOnly: value }));
  }, []);

  const clearAll = useCallback(() => {
    setFilters(defaults);
  }, [defaults]);

  return [
    filters,
    {
      setSearchQuery,
      setFilterPriority,
      setFilterAssignee,
      setFilterEpic,
      setFilterStatus,
      setShowBlockedOnly,
      clearAll,
    },
  ];
}
