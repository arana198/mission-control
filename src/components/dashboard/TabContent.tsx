"use client";

import { lazy, Suspense } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CardGridSkeleton, LoadingSkeleton } from "@/components/LoadingSkeletons";
import { TaskBoard } from "@/components/TaskBoard";
import { AgentSquad } from "@/components/AgentSquad";
import { AgentWorkload } from "@/components/AgentWorkload";
import { ActivityFeed } from "@/components/ActivityFeed";
import { SettingsPanel } from "@/components/SettingsPanel";
import { DashboardOverview } from "./DashboardOverview";

// Lazy load heavy components
const EpicBoard = lazy(() => import("@/components/EpicBoard").then(m => ({ default: m.EpicBoard })));
const BrainHub = lazy(() => import("@/components/BrainHub").then(m => ({ default: m.BrainHub })));
const CalendarView = lazy(() => import("@/components/CalendarView").then(m => ({ default: m.CalendarView })));
const OKRDashboard = lazy(() => import("@/components/OKRDashboard").then(m => ({ default: m.OKRDashboard })));
const BottleneckVisualizer = lazy(() => import("@/components/BottleneckVisualizer").then(m => ({ default: m.BottleneckVisualizer })));
const InternalCalendarPanel = lazy(() => import("@/components/InternalCalendarPanel").then(m => ({ default: m.InternalCalendarPanel })));

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

interface TabContentProps {
  activeTab: TabType;
  agents: any[];
  tasks: any[];
  epics: any[];
  activities: any[];
  stats: DashboardStats;
  onNavigate: (tab: TabType) => void;
}

export function TabContent({
  activeTab,
  agents,
  tasks,
  epics,
  activities,
  stats,
  onNavigate,
}: TabContentProps) {
  return (
    <div className="p-4 md:p-6">
      <ErrorBoundary componentName="TabContent">
        {activeTab === "overview" && (
          <DashboardOverview
            agents={agents}
            tasks={tasks}
            epics={epics}
            activities={activities}
            stats={stats}
            onNavigate={onNavigate}
          />
        )}
        {activeTab === "board" && (
          <ErrorBoundary componentName="TaskBoard">
            <TaskBoard tasks={tasks} agents={agents} epics={epics} />
          </ErrorBoundary>
        )}
        {activeTab === "epics" && (
          <ErrorBoundary componentName="EpicBoard">
            <Suspense fallback={<CardGridSkeleton />}>
              <EpicBoard epics={epics} tasks={tasks} agents={agents} />
            </Suspense>
          </ErrorBoundary>
        )}
        {activeTab === "agents" && (
          <ErrorBoundary componentName="AgentSquad">
            <AgentSquad agents={agents} tasks={tasks} />
          </ErrorBoundary>
        )}
        {activeTab === "workload" && (
          <ErrorBoundary componentName="AgentWorkload">
            <AgentWorkload agents={agents} tasks={tasks} epics={epics} />
          </ErrorBoundary>
        )}
        {activeTab === "activity" && (
          <ActivityFeed activities={activities} />
        )}
        {activeTab === "calendar" && (
          <ErrorBoundary componentName="CalendarView">
            <Suspense fallback={<LoadingSkeleton />}>
              <CalendarView tasks={tasks} agents={agents} />
            </Suspense>
          </ErrorBoundary>
        )}
        {activeTab === "brain" && (
          <ErrorBoundary componentName="BrainHub">
            <Suspense fallback={<CardGridSkeleton />}>
              <BrainHub tasks={tasks} activities={activities} />
            </Suspense>
          </ErrorBoundary>
        )}
        {activeTab === "okr" && (
          <ErrorBoundary componentName="OKRDashboard">
            <Suspense fallback={<LoadingSkeleton />}>
              <OKRDashboard />
            </Suspense>
          </ErrorBoundary>
        )}
        {activeTab === "bottlenecks" && (
          <ErrorBoundary componentName="BottleneckVisualizer">
            <Suspense fallback={<LoadingSkeleton />}>
              <BottleneckVisualizer />
            </Suspense>
          </ErrorBoundary>
        )}
        {activeTab === "sync" && (
          <ErrorBoundary componentName="InternalCalendarPanel">
            <Suspense fallback={<LoadingSkeleton />}>
              <InternalCalendarPanel />
            </Suspense>
          </ErrorBoundary>
        )}
        {activeTab === "settings" && <SettingsPanel />}
      </ErrorBoundary>
    </div>
  );
}
