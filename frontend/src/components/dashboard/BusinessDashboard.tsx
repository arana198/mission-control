"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ReactNode } from "react";
import { TaskBoard } from "../TaskBoard";
import { ErrorBoundary } from "../ErrorBoundary";
import { Suspense, lazy } from "react";
import { CardGridSkeleton, LoadingSkeleton, KanbanSkeleton } from "../LoadingSkeletons";
import { DocumentPanel } from "../DocumentPanel";
import { SettingsPanel } from "../BusinessSettingsPanel";
import { AutomationsPanel } from "../AutomationsPanel";
import { Task } from "@/types/task";
import { Agent } from "@/types/agent";
import { Epic } from "@/types/epic";

const EpicBoard = lazy(() => import("../EpicBoard").then(m => ({ default: m.EpicBoard })));
const WikiDocs = lazy(() => import("../wiki/WikiDocs").then(m => ({ default: m.WikiDocs })));
const AnalyticsDashboard = lazy(() => import("../analytics/BusinessAnalyticsDashboard").then(m => ({ default: m.AnalyticsDashboard })));

type TabType = "overview" | "board" | "epics" | "wiki" | "analytics" | "settings";

interface WorkspaceDashboardProps {
  tab: TabType;
  workspaceId: string;
  isCreatingTask: boolean;
  setIsCreatingTask: (v: boolean) => void;
  autoAssigning: boolean;
  setAutoAssigning: (v: boolean) => void;
}

/**
 * -scoped Dashboard Component
 * Handles tabs that require workspaceId: overview, board, epics, wiki, settings
 */
export function Dashboard({
  tab,
  workspaceId,
  isCreatingTask,
  setIsCreatingTask,
  autoAssigning,
  setAutoAssigning,
}: WorkspaceDashboardProps) {
  // -specific data fetching
  const agents = useQuery(api.agents.getAllAgents);
  const tasks = useQuery(api.tasks.getAllTasks, { workspaceId: workspaceId as any });
  const epics = useQuery(api.epics.getAllEpics, { workspaceId: workspaceId as any });
  const workspace = useQuery(api.workspaces.getWorkspaceById, { workspaceId: workspaceId as any });
  const autoAssignBacklog = useMutation(api.tasks.autoAssignBacklog);

  // Render content based on tab
  const renderContent = (): ReactNode => {
    switch (tab) {
      case "overview":
        if (!agents || !tasks || !workspace) {
          return (
            <ErrorBoundary>
              <LoadingSkeleton />
            </ErrorBoundary>
          );
        }

        const agentCount = agents?.filter((a: any) => a.status === "active").length || 0;
        const taskCount = tasks?.length || 0;
        const inProgressCount = tasks?.filter((t: any) => t.status === "in_progress").length || 0;
        const completedCount = tasks?.filter((t: any) => t.status === "done").length || 0;

        return (
          <ErrorBoundary>
            <div className="space-y-6">
              {workspace?.missionStatement && (
                <div className="card p-6 border-l-4" style={{ borderLeftColor: (workspace as any).color || '#6366f1' }}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Mission Statement</p>
                  <p className="text-lg font-medium text-foreground">{ workspace.missionStatement}</p>
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
            </div>
          </ErrorBoundary>
        );

      case "board":
        if (tasks === undefined || agents === undefined) {
          return <KanbanSkeleton />;
        }
        return (
          <ErrorBoundary>
            <Suspense fallback={<KanbanSkeleton />}>
              <TaskBoard
                tasks={tasks as Task[]}
                agents={agents as unknown as Agent[]}
                epics={(epics || []) as unknown as Epic[]}
                workspaceId={workspaceId}
              />
            </Suspense>
          </ErrorBoundary>
        );

      case "epics":
        if (tasks === undefined || agents === undefined || epics === undefined) {
          return <CardGridSkeleton />;
        }
        return (
          <ErrorBoundary>
            <Suspense fallback={<CardGridSkeleton />}>
              <EpicBoard
                tasks={tasks}
                agents={agents}
                epics={epics}
              />
            </Suspense>
          </ErrorBoundary>
        );

      case "wiki":
        return (
          <ErrorBoundary>
            <Suspense fallback={<LoadingSkeleton />}>
              <WikiDocs workspaceId={workspaceId} />
            </Suspense>
          </ErrorBoundary>
        );

      case "analytics":
        return (
          <ErrorBoundary>
            <Suspense fallback={<LoadingSkeleton />}>
              <AnalyticsDashboard workspaceId={workspaceId as any} />
            </Suspense>
          </ErrorBoundary>
        );

      case "settings":
        return (
          <ErrorBoundary>
            <div className="space-y-6 p-6">
              <SettingsPanel workspaceId={workspaceId} />
              <div className="border-t pt-6">
                <AutomationsPanel workspaceId={workspaceId as any} />
              </div>
            </div>
          </ErrorBoundary>
        );

      default:
        return <div>Unknown tab</div>;
    }
  };

  return (
    <div
      className="border-l-4 transition-colors"
      style={{ borderLeftColor: (workspace as any)?.color || '#6366f1' }}
    >
      {renderContent()}
    </div>
  );
}
