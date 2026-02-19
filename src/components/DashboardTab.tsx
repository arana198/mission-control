"use client";

import { ReactNode, lazy, Suspense, useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useBusiness } from "./BusinessProvider";
import { BusinessFilter } from "./BusinessFilter";
import { BusinessBadge } from "./BusinessBadge";
import { TaskBoard } from "./TaskBoard";
import { AgentSquad } from "./AgentSquad";
import { AgentWorkload } from "./AgentWorkload";
import { ActivityFeed } from "./ActivityFeed";
import { CreateTaskModal } from "./CreateTaskModal";
import { NotificationPanel } from "./NotificationPanel";
import { DocumentPanel } from "./DocumentPanel";
import { LoadingSkeleton, CardGridSkeleton } from "./LoadingSkeletons";
import { ErrorBoundary } from "./ErrorBoundary";
import { CommandPalette } from "./CommandPalette";
import { SettingsPanel } from "./SettingsPanel";
import { log } from "../lib/logger";
import { metrics } from "../lib/monitoring";
import { useMutation } from "convex/react";
import { DashboardHeader } from "./dashboard/DashboardHeader";

// Lazy load heavy components
const EpicBoard = lazy(() => import("./EpicBoard").then(m => ({ default: m.EpicBoard })));
const BrainHub = lazy(() => import("./BrainHub").then(m => ({ default: m.BrainHub })));
const CalendarView = lazy(() => import("./CalendarView").then(m => ({ default: m.CalendarView })));
const BottleneckVisualizer = lazy(() => import("./BottleneckVisualizer").then(m => ({ default: m.BottleneckVisualizer })));
const AnalyticsDashboard = lazy(() => import("./AnalyticsDashboard").then(m => ({ default: m.AnalyticsDashboard })));
const ApiDocsPanel = lazy(() => import("./ApiDocsPanel").then(m => ({ default: m.ApiDocsPanel })));

type TabType = "overview" | "board" | "epics" | "agents" | "workload" | "activity" | "documents" | "calendar" | "brain" | "bottlenecks" | "analytics" | "settings" | "api-docs";

/**
 * Dashboard Tab Content Component (Client)
 *
 * Renders the appropriate component based on the active tab.
 * Handles data fetching with business scoping for business-specific tabs.
 * Global tabs show all businesses with optional filtering.
 */
export function DashboardTabClientContent({
  tab,
  businessSlug
}: {
  tab: TabType;
  businessSlug?: string;
}) {
  const { currentBusiness } = useBusiness();
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [selectedBusinessFilter, setSelectedBusinessFilter] = useState<string | null>(null);

  // Determine if this is a business-specific tab
  const isBusinessSpecificTab = ["overview", "board", "epics", "documents", "settings"].includes(tab);
  const targetBusinessId = currentBusiness?._id;

  // Fetch all required data - ALWAYS call hooks in same order on every render
  // This is critical for React's Rules of Hooks - never conditionally call hooks
  const agents = useQuery(api.agents.getAllAgents);

  // Always call useQuery with same function, params may be undefined/partial
  const businessTasks = useQuery(api.tasks.getAllTasks, {
    businessId: targetBusinessId || undefined
  } as any);

  const globalTasks = useQuery(api.tasks.getFiltered, {
    businessId: selectedBusinessFilter || undefined,
    agentId: agents?.[0]?._id || undefined
  } as any);

  const businessEpics = useQuery(api.epics.getAllEpics, {
    businessId: targetBusinessId || undefined
  } as any);

  const globalEpicsData = useQuery(api.epics.getAllEpics, {
    businessId: targetBusinessId || undefined
  } as any);

  const activities = useQuery(api.activities.getRecent, {
    limit: 10,
    businessId: selectedBusinessFilter || undefined
  });

  const notifications = useQuery(api.notifications.getAll);

  const autoAssignBacklog = useMutation(api.tasks.autoAssignBacklog);

  // Select appropriate data based on tab AFTER all hooks are called
  const tasks = isBusinessSpecificTab ? businessTasks : globalTasks;
  const epics = isBusinessSpecificTab ? businessEpics : globalEpicsData;
  const unreadCount = notifications?.filter(n => !n.read).length || 0;

  // Log page load
  useEffect(() => {
    console.log(`[Dashboard] Tab: ${tab}, Business: ${currentBusiness?.name || "global"}, Loading state:`, {
      agentsLoading: agents === undefined,
      tasksLoading: tasks === undefined,
      epicsLoading: epics === undefined,
      activitiesLoading: activities === undefined,
      businessSpecificTab: isBusinessSpecificTab,
      selectedBusinessFilter: selectedBusinessFilter,
      agentsCount: agents?.length || 0,
      tasksCount: tasks?.length || 0,
      epicsCount: epics?.length || 0
    });

    if (agents && tasks) {
      log.info(`Dashboard tab loaded: ${tab}`, {
        business: currentBusiness?.name || "global",
        businessId: currentBusiness?._id,
        agents: agents.length,
        tasks: tasks.length,
        epics: epics?.length || 0
      });
      metrics.recordPageLoad(performance.now());
    }
  }, [tab, agents, tasks, epics, activities, currentBusiness, selectedBusinessFilter, isBusinessSpecificTab]);


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

  // Determine if we should show the business filter
  const isGlobalTab = ["workload", "activity", "analytics"].includes(tab);

  // Calculate counts for header
  const p0Count = tasks?.filter((t: any) => t.priority === "P0").length || 0;
  const unassignedCount = tasks?.filter((t: any) => t.assigneeIds.length === 0 && t.status !== "done").length || 0;

  return (
    <main className="flex-1 overflow-y-auto">
      <DashboardHeader
        activeTab={tab as any}
        unreadCount={unreadCount}
        unassignedCount={unassignedCount}
        p0Count={p0Count}
        isAutoAssigning={autoAssigning}
        onCreateTask={() => setIsCreatingTask(true)}
        onToggleNotifications={() => setShowNotifications(!showNotifications)}
        onAutoAssign={() => {
          if (autoAssignBacklog) {
            setAutoAssigning(true);
            autoAssignBacklog({ taskCount: unassignedCount }).then(() => {
              setAutoAssigning(false);
            }).catch(() => {
              setAutoAssigning(false);
            });
          }
        }}
        canAutoAssign={!!autoAssignBacklog && isBusinessSpecificTab}
      />
      <div className="p-6">
        {/* Business Filter for global tabs */}
        {isGlobalTab && (
          <div className="mb-6 pb-4 border-b">
            <BusinessFilter onFilterChange={setSelectedBusinessFilter} />
          </div>
        )}

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
