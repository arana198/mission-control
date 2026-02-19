"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ReactNode, useState } from "react";
import { AgentSquad } from "../AgentSquad";
import { AgentWorkload } from "../AgentWorkload";
import { ActivityFeed } from "../ActivityFeed";
import { ErrorBoundary } from "../ErrorBoundary";
import { Suspense, lazy } from "react";
import { CardGridSkeleton, LoadingSkeleton } from "../LoadingSkeletons";
import { BusinessFilter } from "../BusinessFilter";

const CalendarView = lazy(() => import("../CalendarView").then(m => ({ default: m.CalendarView })));
const BrainHub = lazy(() => import("../BrainHub").then(m => ({ default: m.BrainHub })));
const BottleneckVisualizer = lazy(() => import("../BottleneckVisualizer").then(m => ({ default: m.BottleneckVisualizer })));
const AnalyticsDashboard = lazy(() => import("../AnalyticsDashboard").then(m => ({ default: m.AnalyticsDashboard })));
const ApiDocsPanel = lazy(() => import("../ApiDocsPanel").then(m => ({ default: m.ApiDocsPanel })));

type GlobalTabType = "agents" | "workload" | "activity" | "calendar" | "brain" | "bottlenecks" | "analytics" | "api-docs";

interface GlobalDashboardProps {
  tab: GlobalTabType;
}

/**
 * Global Dashboard Component
 * Handles tabs that don't require specific businessId: agents, workload, activity, calendar, etc.
 */
export function GlobalDashboard({ tab }: GlobalDashboardProps) {
  const [selectedBusinessFilter, setSelectedBusinessFilter] = useState<string | null>(null);

  // Global data fetching
  const agents = useQuery(api.agents.getAllAgents);
  const activities = useQuery(api.activities.getRecent,
    selectedBusinessFilter ? { limit: 10, businessId: selectedBusinessFilter as any } : "skip"
  );

  // Filtered tasks for workload/activity views
  const firstAgentId = agents?.[0]?._id;
  const filteredTasks = useQuery(api.tasks.getFiltered,
    firstAgentId ? {
      businessId: (selectedBusinessFilter as any) || firstAgentId,
      agentId: firstAgentId
    } : "skip"
  );

  // Global epics
  const epics = useQuery(api.epics.getAllEpics,
    selectedBusinessFilter ? { businessId: selectedBusinessFilter as any } : "skip"
  );

  // Render content based on tab
  const renderContent = (): ReactNode => {
    switch (tab) {
      case "agents":
        return (
          <ErrorBoundary>
            <AgentSquad
              agents={agents || []}
              tasks={filteredTasks || []}
            />
          </ErrorBoundary>
        );

      case "workload":
        return (
          <ErrorBoundary>
            <AgentWorkload
              agents={agents || []}
              tasks={filteredTasks || []}
              epics={epics || []}
            />
          </ErrorBoundary>
        );

      case "activity":
        return (
          <ErrorBoundary>
            <ActivityFeed
              activities={activities || []}
            />
          </ErrorBoundary>
        );

      case "calendar":
        return (
          <ErrorBoundary>
            <Suspense fallback={<LoadingSkeleton />}>
              <CalendarView
                tasks={filteredTasks || []}
                agents={agents || []}
              />
            </Suspense>
          </ErrorBoundary>
        );

      case "brain":
        return (
          <ErrorBoundary>
            <Suspense fallback={<CardGridSkeleton />}>
              <BrainHub
                tasks={filteredTasks || []}
                activities={activities || []}
              />
            </Suspense>
          </ErrorBoundary>
        );

      case "bottlenecks":
        return (
          <ErrorBoundary>
            <Suspense fallback={<CardGridSkeleton />}>
              <BottleneckVisualizer />
            </Suspense>
          </ErrorBoundary>
        );

      case "analytics":
        return (
          <ErrorBoundary>
            <Suspense fallback={<LoadingSkeleton />}>
              <AnalyticsDashboard />
            </Suspense>
          </ErrorBoundary>
        );

      case "api-docs":
        return (
          <ErrorBoundary>
            <Suspense fallback={<LoadingSkeleton />}>
              <ApiDocsPanel />
            </Suspense>
          </ErrorBoundary>
        );

      default:
        return <div>Unknown tab</div>;
    }
  };

  const showBusinessFilter = ["workload", "activity", "analytics"].includes(tab);

  return (
    <div className="p-6">
      {showBusinessFilter && (
        <div className="mb-6 pb-4 border-b">
          <BusinessFilter onFilterChange={setSelectedBusinessFilter} />
        </div>
      )}
      {renderContent()}
    </div>
  );
}
