"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ReactNode } from "react";
import { TaskBoard } from "../TaskBoard";
import { ErrorBoundary } from "../ErrorBoundary";
import { Suspense, lazy } from "react";
import { CardGridSkeleton, LoadingSkeleton } from "../LoadingSkeletons";
import { DocumentPanel } from "../DocumentPanel";
import { SettingsPanel } from "../SettingsPanel";
import { BusinessSettingsPanel } from "../BusinessSettingsPanel";

const EpicBoard = lazy(() => import("../EpicBoard").then(m => ({ default: m.EpicBoard })));

type BusinessTabType = "overview" | "board" | "epics" | "documents" | "settings";

interface BusinessDashboardProps {
  tab: BusinessTabType;
  businessId: string;
  isCreatingTask: boolean;
  setIsCreatingTask: (v: boolean) => void;
  autoAssigning: boolean;
  setAutoAssigning: (v: boolean) => void;
}

/**
 * Business-scoped Dashboard Component
 * Handles tabs that require businessId: overview, board, epics, documents, settings
 */
export function BusinessDashboard({
  tab,
  businessId,
  isCreatingTask,
  setIsCreatingTask,
  autoAssigning,
  setAutoAssigning,
}: BusinessDashboardProps) {
  // Business-specific data fetching
  const agents = useQuery(api.agents.getAllAgents);
  const tasks = useQuery(api.tasks.getAllTasks, { businessId: businessId as any });
  const epics = useQuery(api.epics.getAllEpics, { businessId: businessId as any });
  const business = useQuery(api.businesses.getById, { businessId: businessId as any });
  const autoAssignBacklog = useMutation(api.tasks.autoAssignBacklog);

  // Render content based on tab
  const renderContent = (): ReactNode => {
    switch (tab) {
      case "overview":
        const agentCount = agents?.filter((a: any) => a.status === "active").length || 0;
        const taskCount = tasks?.length || 0;
        const inProgressCount = tasks?.filter((t: any) => t.status === "in_progress").length || 0;
        const completedCount = tasks?.filter((t: any) => t.status === "done").length || 0;

        return (
          <ErrorBoundary>
            <div className="space-y-6">
              {business?.missionStatement && (
                <div className="card p-6 border-l-4" style={{ borderLeftColor: (business as any).color || '#6366f1' }}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Mission Statement</p>
                  <p className="text-lg font-medium text-foreground">{business.missionStatement}</p>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card p-4">
                  <p className="text-sm text-muted-foreground mb-2">Active Agents</p>
                  <p className="text-3xl font-bold">{agentCount}</p>
                </div>
                <div className="card p-4">
                  <p className="text-sm text-muted-foreground mb-2">Total Tasks</p>
                  <p className="text-3xl font-bold">{taskCount}</p>
                </div>
                <div className="card p-4">
                  <p className="text-sm text-muted-foreground mb-2">In Progress</p>
                  <p className="text-3xl font-bold">{inProgressCount}</p>
                </div>
                <div className="card p-4">
                  <p className="text-sm text-muted-foreground mb-2">Completed</p>
                  <p className="text-3xl font-bold">{completedCount}</p>
                </div>
              </div>
              {taskCount > 0 && <CardGridSkeleton />}
            </div>
          </ErrorBoundary>
        );

      case "board":
        return (
          <ErrorBoundary>
            <TaskBoard
              tasks={tasks || []}
              agents={agents || []}
              epics={epics || []}
            />
          </ErrorBoundary>
        );

      case "epics":
        return (
          <ErrorBoundary>
            <Suspense fallback={<CardGridSkeleton />}>
              <EpicBoard
                tasks={tasks || []}
                agents={agents || []}
                epics={epics || []}
              />
            </Suspense>
          </ErrorBoundary>
        );

      case "documents":
        return (
          <ErrorBoundary>
            <DocumentPanel />
          </ErrorBoundary>
        );

      case "settings":
        return (
          <ErrorBoundary>
            <BusinessSettingsPanel businessId={businessId} />
          </ErrorBoundary>
        );

      default:
        return <div>Unknown tab</div>;
    }
  };

  return (
    <div
      className="border-l-4 transition-colors"
      style={{ borderLeftColor: (business as any)?.color || '#6366f1' }}
    >
      {renderContent()}
    </div>
  );
}
