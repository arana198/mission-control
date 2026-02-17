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
import { Rocket, Loader2 } from "lucide-react";

// Lazy load heavy components
const EpicBoard = lazy(() => import("../../../components/EpicBoard").then(m => ({ default: m.EpicBoard })));
const BrainHub = lazy(() => import("../../../components/BrainHub").then(m => ({ default: m.BrainHub })));
const CalendarView = lazy(() => import("../../../components/CalendarView").then(m => ({ default: m.CalendarView })));
const OKRDashboard = lazy(() => import("../../../components/OKRDashboard").then(m => ({ default: m.OKRDashboard })));
const BottleneckVisualizer = lazy(() => import("../../../components/BottleneckVisualizer").then(m => ({ default: m.BottleneckVisualizer })));
const InternalCalendarPanel = lazy(() => import("../../../components/InternalCalendarPanel").then(m => ({ default: m.InternalCalendarPanel })));
const AnalyticsDashboard = lazy(() => import("../../../components/AnalyticsDashboard").then(m => ({ default: m.AnalyticsDashboard })));

type TabType = "overview" | "board" | "epics" | "agents" | "workload" | "activity" | "documents" | "calendar" | "brain" | "okr" | "bottlenecks" | "sync" | "analytics" | "settings";

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
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);

  // Fetch all required data
  const agents = useQuery(api.agents.getAll);
  const tasks = useQuery(api.tasks.getAll);
  const epics = useQuery(api.epics.getAll);
  const activities = useQuery(api.activities.getRecent, { limit: 10 });
  const notifications = useQuery(api.notifications.getAll);
  const unreadCount = notifications?.filter(n => !n.read).length || 0;

  // Get mutations for initialization
  let seedAll: any, autoAssignBacklog: any;
  try {
    seedAll = useMutation(api.seed.seedAll);
    autoAssignBacklog = useMutation(api.tasks.autoAssignBacklog);
  } catch (e) {
    // Mutations may not be available if backend is not connected
  }

  const handleInitialize = async () => {
    if (!seedAll) {
      setSeedError("Backend not connected. Run 'npx convex dev' first.");
      return;
    }
    setIsSeeding(true);
    try {
      await seedAll();
      setSeedError(null);
      log.info('System initialized successfully');
    } catch (err: any) {
      setSeedError(err?.message || "Failed to initialize");
      log.error('System initialization failed', err);
    } finally {
      setIsSeeding(false);
    }
  };

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

  // Show initialization screen if database is empty
  const isEmpty = agents && tasks && agents.length === 0 && tasks.length === 0;

  useEffect(() => {
    console.log('[Overview] isEmpty:', isEmpty, 'agents:', agents?.length || 'loading', 'tasks:', tasks?.length || 'loading');
  }, [agents, tasks]);

  if (isEmpty) {
    return (
      <main className="flex-1 overflow-y-auto">
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="card p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Rocket className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Mission Control</h1>
            <p className="text-muted-foreground mb-6">
              Initialize your 10-agent squad to begin task coordination
            </p>
            {seedError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{seedError}</p>
              </div>
            )}
            <button
              onClick={handleInitialize}
              disabled={isSeeding}
              className="btn btn-primary w-full flex items-center justify-center gap-2"
            >
              {isSeeding && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSeeding ? "Initializing..." : "Initialize System"}
            </button>
          </div>
        </div>
      </main>
    );
  }

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

              {/* Initialize Button - shown when database is empty */}
              {taskCount === 0 && agentCount === 0 && (
                <div className="card p-6 text-center">
                  <Rocket className="w-8 h-8 text-blue-600 mx-auto mb-4" />
                  <h2 className="text-lg font-semibold mb-2">Get Started</h2>
                  <p className="text-muted-foreground mb-4">Initialize your system with 10 agents and sample tasks</p>
                  {seedError && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-600">{seedError}</p>
                    </div>
                  )}
                  <button
                    onClick={handleInitialize}
                    disabled={isSeeding}
                    className="btn btn-primary inline-flex items-center gap-2"
                  >
                    {isSeeding && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isSeeding ? "Initializing..." : "Initialize System"}
                  </button>
                </div>
              )}

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

      case "okr":
        return (
          <ErrorBoundary>
            <Suspense fallback={<LoadingSkeleton />}>
              <OKRDashboard />
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

      case "sync":
        return (
          <ErrorBoundary>
            <Suspense fallback={<LoadingSkeleton />}>
              <InternalCalendarPanel />
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
