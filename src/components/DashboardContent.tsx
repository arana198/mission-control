"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "../../convex/_generated/api";
import { useNotification } from "@/hooks/useNotification";
import { useTheme } from "./ThemeProvider";
import { ErrorBoundary } from "./ErrorBoundary";
import { CreateTaskModal } from "./CreateTaskModal";
import { NotificationPanel } from "./NotificationPanel";
import { CommandPalette } from "./CommandPalette";
import { log } from "../lib/logger";
import { metrics } from "../lib/monitoring";
import { SidebarNav } from "./dashboard/SidebarNav";
import { DashboardHeader } from "./dashboard/DashboardHeader";
import { TabContent } from "./dashboard/TabContent";
import { InitializationCard } from "./dashboard/InitializationCard";
import { Loader2 } from "lucide-react";

type TabType = "overview" | "board" | "epics" | "agents" | "workload" | "activity" | "documents" | "calendar" | "brain" | "okr" | "bottlenecks" | "sync" | "settings";

interface DashboardStats {
  activeCount: number;
  workingCount: number;
  inProgress: number;
  completed: number;
  unassigned: number;
  p0Count: number;
  activeEpicsCount: number;
}

/**
 * DashboardContent Component (Refactored for SRP)
 *
 * Extracted from Dashboard to be wrapped in Suspense boundary.
 * Handles useSearchParams() logic and orchestrates sub-components.
 *
 * Sub-components handle specific responsibilities:
 * - SidebarNav: Navigation and theme toggle
 * - DashboardHeader: Header with stats and actions
 * - TabContent: Tab rendering logic
 * - InitializationCard: Empty state and system initialization
 */
export function DashboardContent() {
  const notif = useNotification();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, toggleTheme } = useTheme();
  const [initialized, setInitialized] = useState(false);

  // State Management
  const initialTab = ((searchParams?.get("page")) || "overview") as TabType;
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);

  // Data Queries
  const agents = useQuery(api.agents.getAll);
  const tasks = useQuery(api.tasks.getAll);
  const epics = useQuery(api.epics.getAll);
  const activities = useQuery(api.activities.getRecent, { limit: 10 });
  const notifications = useQuery(api.notifications.getAll);
  const unreadCount = notifications?.filter(n => !n.read).length || 0;

  // Mutations
  const seedAll = useMutation(api.seed.seedAll);
  const autoAssignBacklog = useMutation(api.tasks.autoAssignBacklog);

  // Initialize after mount
  useEffect(() => {
    setInitialized(true);
  }, []);

  // Log initialization
  useEffect(() => {
    if (initialized && agents && tasks) {
      log.info('Dashboard data loaded', { agents: agents.length, tasks: tasks.length, epics: epics?.length || 0 });
      metrics.recordPageLoad(performance.now());
    }
  }, [initialized, agents, tasks, epics]);

  // Handle tab changes
  const handleTabChange = (tab: string) => {
    const validTab = tab as TabType;
    setActiveTab(validTab);
    const url = new URL(window.location.href);
    url.searchParams.set("page", tab);
    router.push(url.toString(), { scroll: false });
    log.info('Dashboard tab changed', { tab: validTab });
    metrics.recordInteraction({ action: 'tab_change', component: 'Dashboard', duration: 0, success: true, metadata: { tab: validTab } });
  };

  // Handle system initialization
  const handleInitialize = async () => {
    if (!seedAll) {
      setSeedError("Backend not connected. Run 'npx convex dev' first.");
      log.warn('Backend not connected, seeding failed');
      return;
    }
    setIsSeeding(true);
    const startTime = performance.now();
    try {
      log.info('Starting system initialization');
      await seedAll();
      const duration = performance.now() - startTime;
      log.info('System initialized successfully', { duration: `${duration.toFixed(2)}ms` });
      metrics.recordInteraction({ action: 'system_init', component: 'Dashboard', duration, success: true });
    } catch (err: any) {
      const duration = performance.now() - startTime;
      const errorMsg = err?.message || "Failed to initialize";
      setSeedError(errorMsg);
      log.error('System initialization failed', err instanceof Error ? err : new Error(errorMsg));
      metrics.recordInteraction({ action: 'system_init', component: 'Dashboard', duration, success: false, error: errorMsg });
    } finally {
      setIsSeeding(false);
    }
  };

  // Handle auto-assignment
  const handleAutoAssign = async () => {
    if (!autoAssignBacklog || !agents) return;
    setIsAutoAssigning(true);
    const startTime = performance.now();
    try {
      const jarvis = agents.find(a => a.name.toLowerCase() === "jarvis");
      if (!jarvis) {
        notif.error("Jarvis not found");
        log.warn('Jarvis agent not found for auto-assignment');
        return;
      }
      log.info('Starting auto-assignment', { agentId: jarvis._id, limit: 10 });
      await autoAssignBacklog({ jarvisId: jarvis._id, limit: 10 });
      const duration = performance.now() - startTime;
      notif.success("Auto-assignment complete!");
      log.info('Auto-assignment completed successfully', { duration: `${duration.toFixed(2)}ms`, agentId: jarvis._id });
      metrics.recordInteraction({ action: 'auto_assign', component: 'Dashboard', duration, success: true, metadata: { agent: jarvis.name } });
    } catch (err: any) {
      const duration = performance.now() - startTime;
      const errorMsg = err?.message || "Unknown error";
      notif.error("Auto-assign failed: " + errorMsg);
      log.error('Auto-assignment failed', err instanceof Error ? err : new Error(errorMsg));
      metrics.recordInteraction({ action: 'auto_assign', component: 'Dashboard', duration, success: false, error: errorMsg });
    } finally {
      setIsAutoAssigning(false);
    }
  };

  // Loading state
  if (agents === undefined || tasks === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Empty state
  const isEmpty = agents.length === 0 && tasks.length === 0;
  if (isEmpty) {
    return (
      <InitializationCard
        isSeeding={isSeeding}
        error={seedError}
        onInitialize={handleInitialize}
      />
    );
  }

  // Calculate stats
  const stats: DashboardStats = {
    activeCount: agents.filter(a => a.status === "active").length,
    workingCount: agents.filter(a => a.currentTaskId).length,
    inProgress: tasks.filter(t => t.status === "in_progress").length,
    completed: tasks.filter(t => t.status === "done").length,
    unassigned: tasks.filter(t => t.status === "backlog" && (!t.assigneeIds?.length)).length,
    p0Count: tasks.filter(t => t.priority === "P0" && t.status !== "done").length,
    activeEpicsCount: epics?.filter(e => e.status === "active").length || 0,
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Sidebar Navigation */}
      <SidebarNav
        activeTab={activeTab}
        activeCount={stats.activeCount}
        totalAgents={agents.length}
        theme={theme}
        onTabChange={handleTabChange}
        onThemeToggle={toggleTheme}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto w-full">
        {/* Header */}
        <DashboardHeader
          activeTab={activeTab}
          unreadCount={unreadCount}
          unassignedCount={stats.unassigned}
          p0Count={stats.p0Count}
          isAutoAssigning={isAutoAssigning}
          onCreateTask={() => setIsCreatingTask(true)}
          onToggleNotifications={() => setShowNotifications(!showNotifications)}
          onAutoAssign={handleAutoAssign}
          canAutoAssign={!!autoAssignBacklog}
        />

        {/* Content */}
        <TabContent
          activeTab={activeTab}
          agents={agents}
          tasks={tasks}
          epics={epics || []}
          activities={activities || []}
          stats={stats}
          onNavigate={handleTabChange}
        />
      </main>

      {/* Create Task Modal */}
      {isCreatingTask && (
        <ErrorBoundary componentName="CreateTaskModal">
          <CreateTaskModal
            agents={agents}
            epics={epics || []}
            onClose={() => setIsCreatingTask(false)}
          />
        </ErrorBoundary>
      )}

      {/* Notifications Panel */}
      {showNotifications && (
        <ErrorBoundary componentName="NotificationPanel">
          <div
            className="fixed inset-0 z-50 bg-black/50 flex items-start justify-end"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notifications-title"
          >
            <div className="w-96 h-screen bg-background border-l shadow-lg overflow-y-auto">
              <div id="notifications-title" className="sr-only">
                Notifications
              </div>
              <NotificationPanel />
              <button
                onClick={() => setShowNotifications(false)}
                className="absolute top-4 right-4 p-2 hover:bg-muted rounded-lg"
                aria-label="Close notifications"
              >
                ✕
              </button>
            </div>
          </div>
        </ErrorBoundary>
      )}

      {/* Command Palette */}
      <CommandPalette
        onCreateTask={() => setIsCreatingTask(true)}
        onNavigate={(tab) => handleTabChange(tab)}
      />
    </div>
  );
}
