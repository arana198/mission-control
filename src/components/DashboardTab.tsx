"use client";

import { useState, useEffect, Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "./WorkspaceProvider";
import { CreateTaskModal } from "./CreateTaskModal";
import { NotificationPanel } from "./NotificationPanel";
import { DocumentPanel } from "./DocumentPanel";
import { CommandPalette } from "./CommandPalette";
import { KeyboardShortcuts } from "./KeyboardShortcuts";
import { SettingsPanel } from "./SettingsPanel";
import { Breadcrumbs } from "./Breadcrumbs";
import { log } from "../lib/logger";
import { metrics } from "../lib/monitoring";
import { DashboardHeader } from "./dashboard/DashboardHeader";
import { Dashboard } from "./dashboard/BusinessDashboard";
import { GlobalDashboard } from "./dashboard/GlobalDashboard";
import { LoadingSkeleton } from "./LoadingSkeletons";

type TabType = "overview" | "board" | "epics" | "agents" | "workload" | "activity" | "wiki" | "calendar" | "brain" | "bottlenecks" | "analytics" | "settings" | "api-docs" | "inbox";

/**
 * Dashboard Tab Content Component (Client)
 *
 * Router component that delegates to appropriate sub-components based on tab type.
 * - Dashboard: Handles business-specific tabs (overview, board, epics, wiki, settings)
 * - GlobalDashboard: Handles global tabs (agents, workload, activity, calendar, etc.)
 *
 * This architecture eliminates conditional hook violations by keeping each component's
 * data fetching in the component that needs it.
 */
export function DashboardTabClientContent({
  tab,
  businessSlug
}: {
  tab: TabType;
  businessSlug?: string;
}) {
  const { currentWorkspace } = useWorkspace();
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);

  // Only fetch global data needed by the header
  const notifications = useQuery(api.notifications.getAll);
  const unreadCount = notifications?.filter(n => !n.read).length || 0;

  // Determine tab type
  const isSpecificTab = ["overview", "board", "epics", "wiki", "analytics", "settings"].includes(tab);
  const targetId = currentWorkspace?._id;

  // Log page load
  useEffect(() => {
    console.log(`[Dashboard] Tab: ${tab}, : ${currentWorkspace?.name || "global"}`);
    log.info(`Dashboard tab loaded: ${tab}`, {
      business: currentWorkspace?.name || "global",
      workspaceId: currentWorkspace?._id,
    });
    metrics.recordPageLoad(performance.now());
  }, [tab, currentWorkspace]);

  // Show loading state if workspace tab but no workspaceId
  if (isSpecificTab && !targetId) {
    return (
      <main className="flex-1 overflow-y-auto">
        <DashboardHeader
          activeTab={tab as any}
          unreadCount={unreadCount}
          unassignedCount={0}
          p0Count={0}
          isAutoAssigning={false}
          onCreateTask={() => {}}
          onToggleNotifications={() => {}}
          onAutoAssign={() => {}}
          canAutoAssign={false}
        />
        <div className="p-6">
          <LoadingSkeleton />
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto">
      <DashboardHeader
        activeTab={tab as any}
        unreadCount={unreadCount}
        unassignedCount={0}
        p0Count={0}
        isAutoAssigning={autoAssigning}
        onCreateTask={() => setIsCreatingTask(true)}
        onToggleNotifications={() => setShowNotifications(!showNotifications)}
        onAutoAssign={() => {}}
        canAutoAssign={isSpecificTab}
      />

      {/* Breadcrumb navigation */}
      <div className="px-6 py-3 border-b bg-background/50">
        <Breadcrumbs tab={tab} />
      </div>

      {/* Render appropriate dashboard based on tab type */}
      {isSpecificTab && targetId ? (
        <Dashboard
          tab={tab as "overview" | "board" | "epics" | "wiki" | "analytics" | "settings"}
          workspaceId={targetId}
          isCreatingTask={isCreatingTask}
          setIsCreatingTask={setIsCreatingTask}
          autoAssigning={autoAssigning}
          setAutoAssigning={setAutoAssigning}
        />
      ) : (
        <Suspense fallback={<LoadingSkeleton />}>
          <GlobalDashboard tab={tab as "agents" | "workload" | "activity" | "calendar" | "brain" | "bottlenecks" | "analytics" | "api-docs"} />
        </Suspense>
      )}

      {/* Modals */}
      {isCreatingTask && (
        <CreateTaskModal
          onClose={() => setIsCreatingTask(false)}
          agents={[]}
          epics={[]}
          tasks={[]}
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

      <CommandPalette />
      <KeyboardShortcuts />
    </main>
  );
}
