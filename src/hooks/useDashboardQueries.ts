/**
 * Optimized Dashboard Queries Hook
 *
 * Provides deduplicated and cached queries for dashboard data.
 * Prevents N+1 queries and multiple requests for same data.
 */

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useMemo } from "react";

/**
 * Custom hook for dashboard core queries with deduplication
 * All components can use this instead of calling useQuery directly
 * to avoid duplicate requests for agents, tasks, epics, etc.
 */
export function useDashboardQueries() {
  // Core queries - only called once per component mount
  const agents = useQuery(api.agents.getAll);
  const tasks = useQuery(api.tasks.getAll);
  const epics = useQuery(api.epics.getAll);
  const activities = useQuery(api.activities.getRecent, { limit: 10 });
  const notifications = useQuery(api.notifications.getAll);

  // Memoize results to prevent recalculations
  return useMemo(
    () => ({
      agents: agents || [],
      tasks: tasks || [],
      epics: epics || [],
      activities: activities || [],
      notifications: notifications || [],
      isLoading: agents === undefined || tasks === undefined,
    }),
    [agents, tasks, epics, activities, notifications]
  );
}

/**
 * Optimized hook for memory queries with caching
 * Reduces multiple memory API calls in BrainHub
 */
export function useDashboardMemoryQueries() {
  const memoryLinks = useQuery(api.memoryIndex.getAll);
  const memoryPaths = useQuery(api.memoryIndex.getMemoryPaths);

  return useMemo(
    () => ({
      memoryLinks: memoryLinks || [],
      memoryPaths: memoryPaths || [],
      isLoading: memoryLinks === undefined || memoryPaths === undefined,
    }),
    [memoryLinks, memoryPaths]
  );
}

/**
 * Optimized hook for goal queries with deduplication
 * Prevents BottleneckVisualizer from making duplicate requests
 */
export function useDashboardGoalQueries() {
  const goals = useQuery(api.goals.getByProgress);

  return useMemo(
    () => ({
      goals: goals || [],
      isLoading: goals === undefined,
    }),
    [goals]
  );
}
