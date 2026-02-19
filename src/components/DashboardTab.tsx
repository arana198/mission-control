"use client";

import { useState, useEffect, Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useBusiness } from "./BusinessProvider";
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
import { BusinessDashboard } from "./dashboard/BusinessDashboard";
import { GlobalDashboard } from "./dashboard/GlobalDashboard";
import { LoadingSkeleton } from "./LoadingSkeletons";

type TabType = "overview" | "board" | "epics" | "agents" | "workload" | "activity" | "documents" | "calendar" | "brain" | "bottlenecks" | "analytics" | "settings" | "api-docs" | "inbox";

/**
 * Dashboard Tab Content Component (Client)
 *
 * Router component that delegates to appropriate sub-components based on tab type.
 * - BusinessDashboard: Handles business-specific tabs (overview, board, epics, documents, settings)
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
  const { currentBusiness } = useBusiness();
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);

  // Only fetch global data needed by the header
  const notifications = useQuery(api.notifications.getAll);
  const unreadCount = notifications?.filter(n => !n.read).length || 0;

  // Determine tab type
  const isBusinessSpecificTab = ["overview", "board", "epics", "documents", "settings"].includes(tab);
  const targetBusinessId = currentBusiness?._id;

  // Log page load
  useEffect(() => {
    console.log(`[Dashboard] Tab: ${tab}, Business: ${currentBusiness?.name || "global"}`);
    log.info(`Dashboard tab loaded: ${tab}`, {
      business: currentBusiness?.name || "global",
      businessId: currentBusiness?._id,
    });
    metrics.recordPageLoad(performance.now());
  }, [tab, currentBusiness]);

  // Show loading state if business tab but no businessId
  if (isBusinessSpecificTab && !targetBusinessId) {
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
        canAutoAssign={isBusinessSpecificTab}
      />

      {/* Breadcrumb navigation */}
      <div className="px-6 py-3 border-b bg-background/50">
        <Breadcrumbs tab={tab} />
      </div>

      {/* Render appropriate dashboard based on tab type */}
      {isBusinessSpecificTab && targetBusinessId ? (
        <BusinessDashboard
          tab={tab as "overview" | "board" | "epics" | "documents" | "settings"}
          businessId={targetBusinessId}
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
