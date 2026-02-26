"use client";

import { Agent } from "@/types/agent";
import { Task } from "@/types/task";
import { Epic } from "@/types/epic";
import { Activity } from "@/types/activity";

type TabType = "overview" | "board" | "epics" | "agents" | "workload" | "activity" | "documents" | "calendar" | "brain" | "settings";

interface DashboardStats {
  activeCount: number;
  workingCount: number;
  inProgress: number;
  completed: number;
  unassigned: number;
  p0Count: number;
  activeEpicsCount: number;
}

interface DashboardOverviewProps {
  agents: Agent[];
  tasks: Task[];
  epics: Epic[];
  activities: Activity[];
  stats: DashboardStats;
  onNavigate: (tab: TabType) => void;
}

function StatCard({
  label,
  value,
  total,
  alert,
}: {
  label: string;
  value: number;
  total?: number;
  alert?: boolean;
}) {
  return (
    <div className={`card p-4 ${alert ? "border-destructive/30 bg-destructive/10" : ""}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold ${alert ? "text-destructive" : ""}`}>{value}</p>
      {total !== undefined && (
        <p className="text-xs text-muted-foreground">{total} total</p>
      )}
    </div>
  );
}

export function DashboardOverview({
  agents,
  tasks,
  epics,
  activities,
  stats,
  onNavigate,
}: DashboardOverviewProps) {
  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Active Agents" value={stats.activeCount} total={agents.length} />
        <StatCard label="In Progress" value={stats.inProgress} total={tasks.length} />
        <StatCard label="Completed" value={stats.completed} total={tasks.length} />
        <StatCard label="P0 Tasks" value={stats.p0Count} alert={stats.p0Count > 0} />
      </div>

      {/* Additional summary cards could go here */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Unassigned Tasks" value={stats.unassigned} />
        <StatCard label="Agents Working" value={stats.workingCount} total={agents.length} />
        <StatCard label="Active Epics" value={stats.activeEpicsCount} total={epics.length} />
      </div>
    </div>
  );
}
