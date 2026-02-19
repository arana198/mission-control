"use client";

import { Plus, Bell, Zap, HelpCircle } from "lucide-react";

type TabType = "overview" | "board" | "epics" | "agents" | "workload" | "activity" | "documents" | "calendar" | "brain" | "bottlenecks" | "sync" | "settings";

interface DashboardHeaderProps {
  activeTab: TabType;
  unreadCount: number;
  unassignedCount: number;
  p0Count: number;
  isAutoAssigning: boolean;
  onCreateTask: () => void;
  onToggleNotifications: () => void;
  onAutoAssign: () => void;
  canAutoAssign: boolean;
}

const TAB_TITLES: Record<TabType, string> = {
  overview: "Dashboard",
  epics: "Roadmap",
  board: "Task Board",
  agents: "Your Squad",
  workload: "Agent Workload",
  activity: "Activity",
  documents: "Documents",
  calendar: "Calendar & Events",
  brain: "2nd Brain",
  bottlenecks: "Bottleneck Analysis",
  sync: "Schedule",
  settings: "Settings",
};

export function DashboardHeader({
  activeTab,
  unreadCount,
  unassignedCount,
  p0Count,
  isAutoAssigning,
  onCreateTask,
  onToggleNotifications,
  onAutoAssign,
  canAutoAssign,
}: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-background border-b px-4 md:px-6 py-4 flex items-center justify-between">
      <div>
        <h2 className="text-base md:text-lg font-semibold">
          {TAB_TITLES[activeTab]}
        </h2>
      </div>

      <div className="flex items-center gap-3">
        {/* Auto-assign button */}
        {unassignedCount > 0 && canAutoAssign && (
          <button
            onClick={onAutoAssign}
            disabled={isAutoAssigning}
            className="btn btn-secondary text-sm disabled:opacity-50"
            aria-label={`Auto-assign ${unassignedCount} tasks`}
          >
            <Zap className="w-4 h-4 mr-2" />
            {isAutoAssigning ? "Assigning..." : `Auto-assign ${unassignedCount}`}
          </button>
        )}

        {/* P0 alert */}
        {p0Count > 0 && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 rounded-full"
            role="alert"
            aria-label={`${p0Count} critical P0 task(s) require attention`}
          >
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" aria-hidden="true" />
            <span className="text-sm font-medium text-red-600">{p0Count} P0 tasks</span>
          </div>
        )}

        {/* Notifications button */}
        <button
          onClick={onToggleNotifications}
          className="btn btn-ghost relative p-2"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          )}
        </button>

        {/* Create task button */}
        <button
          onClick={onCreateTask}
          className="btn btn-primary"
          aria-label="Create new task"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Task
        </button>

        {/* Help button - keyboard shortcuts */}
        <button
          className="btn btn-ghost relative p-2 hidden sm:inline-flex"
          aria-label="Keyboard shortcuts (press ?)"
          title="Press ? for keyboard shortcuts"
          onClick={() => {
            // Dispatch keyboard event to trigger shortcuts modal
            const event = new KeyboardEvent("keydown", {
              key: "?",
              code: "Slash",
              bubbles: true,
            });
            window.dispatchEvent(event);
          }}
        >
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
