"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AgentSquad } from "../AgentSquad";
import { AgentWorkload } from "../AgentWorkload";
import { ActivityFeed } from "../ActivityFeed";
import { ErrorBoundary } from "../ErrorBoundary";
import { Suspense, lazy } from "react";
import { CardGridSkeleton, LoadingSkeleton } from "../LoadingSkeletons";
import { WorkspaceFilter } from "../WorkspaceFilter";

const CalendarView = lazy(() => import("../CalendarView").then(m => ({ default: m.CalendarView })));
const BrainHub = lazy(() => import("../BrainHub").then(m => ({ default: m.BrainHub })));
const BottleneckVisualizer = lazy(() => import("../BottleneckVisualizer").then(m => ({ default: m.BottleneckVisualizer })));
const AnalyticsDashboard = lazy(() => import("../AnalyticsDashboard").then(m => ({ default: m.AnalyticsDashboard })));
const ApiDocsPanel = lazy(() => import("../ApiDocsPanel").then(m => ({ default: m.ApiDocsPanel })));
const AgentInbox = lazy(() => import("../AgentInbox").then(m => ({ default: m.AgentInbox })));

type GlobalTabType = "agents" | "workload" | "activity" | "calendar" | "brain" | "bottlenecks" | "analytics" | "api-docs" | "inbox";

interface GlobalDashboardProps {
  tab: GlobalTabType;
}

/**
 * Global Dashboard Component
 * Handles tabs that don't require specific workspaceId: agents, workload, activity, calendar, etc.
 */
export function GlobalDashboard({ tab }: GlobalDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedWorkspaceFilter = searchParams?.get("workspaceId");

  // Handle filter changes and persist to URL
  const handleFilterChange = (workspaceId: string | null) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (workspaceId) {
      params.set("workspaceId", workspaceId);
    } else {
      params.delete("workspaceId");
    }
    router.push(`?${params.toString()}`);
  };

  // Global data fetching
  const agents = useQuery(api.agents.getAllAgents);
  const activities = useQuery(api.activities.getRecent,
    selectedWorkspaceFilter ? { limit: 10, workspaceId: selectedWorkspaceFilter as any } : "skip"
  );

  // Filtered tasks for workload/activity views
  const firstAgentId = agents?.[0]?._id;
  const filteredTasks = useQuery(api.tasks.getFiltered,
    selectedWorkspaceFilter && firstAgentId ? {
      workspaceId: selectedWorkspaceFilter as any,
      agentId: firstAgentId
    } : "skip"
  );

  // Global epics
  const epics = useQuery(api.epics.getAllEpics,
    selectedWorkspaceFilter ? { workspaceId: selectedWorkspaceFilter as any } : "skip"
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

      case "inbox":
        return (
          <ErrorBoundary>
            <Suspense fallback={<LoadingSkeleton />}>
              <AgentInbox
                agents={agents || []}
                workspaceId={selectedWorkspaceFilter || ""}
              />
            </Suspense>
          </ErrorBoundary>
        );

      default:
        return <div>Unknown tab</div>;
    }
  };

  const showWorkspaceFilter = ["workload", "activity", "analytics", "inbox"].includes(tab);

  return (
    <div className="p-6 border-l-4 border-l-muted-foreground/20">
      {/* Global workspace indicator */}
      <div className="mb-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        🌐 Workspace View
      </div>

      {showWorkspaceFilter && (
        <div className="mb-6 pb-4 border-b">
          <WorkspaceFilter onFilterChange={handleFilterChange} />
        </div>
      )}
      {renderContent()}
    </div>
  );
}
