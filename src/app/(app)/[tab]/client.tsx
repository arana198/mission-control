"use client";

import { ReactNode, lazy, Suspense, useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { TaskBoard } from "../../../components/TaskBoard";
import { AgentSquad } from "../../../components/AgentSquad";
import { AgentWorkload } from "../../../components/AgentWorkload";
import { ActivityFeed } from "../../../components/ActivityFeed";
import { CreateTaskModal } from "../../../components/CreateTaskModal";
import { NotificationPanel } from "../../../components/NotificationPanel";
import { DocumentPanel } from "../../../components/DocumentPanel";
import { LoadingSkeleton, CardGridSkeleton } from "../../../components/LoadingSkeletons";
import { ErrorBoundary } from "../../../components/ErrorBoundary";
import { CommandPalette } from "../../../components/CommandPalette";
import { SettingsPanel } from "../../../components/SettingsPanel";
import { log } from "../../../lib/logger";
import { metrics } from "../../../lib/monitoring";
import { useMutation } from "convex/react";

// Lazy load heavy components
const EpicBoard = lazy(() => import("../../../components/EpicBoard").then(m => ({ default: m.EpicBoard })));
const BrainHub = lazy(() => import("../../../components/BrainHub").then(m => ({ default: m.BrainHub })));
const CalendarView = lazy(() => import("../../../components/CalendarView").then(m => ({ default: m.CalendarView })));
const BottleneckVisualizer = lazy(() => import("../../../components/BottleneckVisualizer").then(m => ({ default: m.BottleneckVisualizer })));
const AnalyticsDashboard = lazy(() => import("../../../components/AnalyticsDashboard").then(m => ({ default: m.AnalyticsDashboard })));
const ApiDocsPanel = lazy(() => import("../../../components/ApiDocsPanel").then(m => ({ default: m.ApiDocsPanel })));

type TabType = "overview" | "board" | "epics" | "agents" | "workload" | "activity" | "documents" | "calendar" | "brain" | "bottlenecks" | "analytics" | "settings" | "api-docs";

/**
 * Dashboard Tab Content Component (Client)
 *
 * Renders the appropriate component based on the active tab.
 * Handles data fetching and component composition.
 */
export function DashboardTabClientContent({ tab }: { tab: TabType }) {
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);

  // Fetch all required data
  const agents = useQuery(api.agents.getAll);
  const tasks = useQuery(api.tasks.getAll);
  const epics = useQuery(api.epics.getAll);
  const activities = useQuery(api.activities.getRecent, { limit: 10 });
  const notifications = useQuery(api.notifications.getAll);
  const unreadCount = notifications?.filter(n => !n.read).length || 0;

  // Get mutations
  let autoAssignBacklog: any;
  try {
    autoAssignBacklog = useMutation(api.tasks.autoAssignBacklog);
  } catch (e) {
    // Mutations may not be available if backend is not connected
  }

  // Log page load
  useEffect(() => {
    console.log(`[Dashboard] Tab: ${tab}, Loading state:`, {
      agentsLoading: agents === undefined,
      tasksLoading: tasks === undefined,
      epicsLoading: epics === undefined,
      activitiesLoading: activities === undefined,
      agentsCount: agents?.length || 0,
      tasksCount: tasks?.length || 0,
      epicsCount: epics?.length || 0
    });

    if (agents && tasks) {
      log.info(`Dashboard tab loaded: ${tab}`, {
        agents: agents.length,
        tasks: tasks.length,
        epics: epics?.length || 0
      });
      metrics.recordPageLoad(performance.now());
    }
  }, [tab, agents, tasks, epics, activities]);


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
              {/* Stats Cards */}
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

              {/* Dashboard Grid */}
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

      case "agents":
        return (
          <ErrorBoundary>
            <AgentSquad
              agents={agents || []}
              tasks={tasks || []}
            />
          </ErrorBoundary>
        );

      case "workload":
        return (
          <ErrorBoundary>
            <AgentWorkload
              agents={agents || []}
              tasks={tasks || []}
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

      case "documents":
        return (
          <ErrorBoundary>
            <DocumentPanel />
          </ErrorBoundary>
        );

      case "calendar":
        return (
          <ErrorBoundary>
            <Suspense fallback={<LoadingSkeleton />}>
              <CalendarView
                tasks={tasks || []}
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
                tasks={tasks || []}
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

      case "settings":
        return (
          <ErrorBoundary>
            <SettingsPanel />
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

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-6">
        {renderContent()}
      </div>

      {/* Modals */}
      {isCreatingTask && (
        <CreateTaskModal
          onClose={() => setIsCreatingTask(false)}
          agents={agents || []}
          epics={epics || []}
        />
      )}

      {showNotifications && (
        <NotificationPanel />
      )}

      {showDocuments && (
        <DocumentPanel />
      )}

      {showSettings && (
        <SettingsPanel />
      )}

      {/* Command Palette */}
      <CommandPalette />
    </main>
  );
}
