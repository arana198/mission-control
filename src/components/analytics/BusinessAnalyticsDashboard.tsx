"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  AnalyticsStatCard,
  MiniBarChart,
  WeeklyVelocityChart,
  StackedBarChart,
} from "./AnalyticsCharts";
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle2,
  Users,
  Zap,
  AlertCircle,
} from "lucide-react";

interface WorkspaceAnalyticsDashboardProps {
  workspaceId: Id<"workspaces">;
}

export function AnalyticsDashboard({
  workspaceId,
}: AnalyticsDashboardProps) {
  // Fetch analytics data
  const cycleTimeMetrics = useQuery(api.tasks.getCycleTimeMetrics, {
    workspaceId,
  });

  const velocityByWeek = useQuery(api.tasks.getVelocityByWeek, {
    workspaceId,
    weeks: 8,
  });

  const statusOverview = useQuery(api.tasks.getStatusOverview, {
    workspaceId,
  });

  const agentLeaderboard = useQuery(api.agentMetrics.getLeaderboard, {
    limit: 10,
  });

  const isLoading = !cycleTimeMetrics || !velocityByWeek || !statusOverview;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading analytics...</div>
      </div>
    );
  }

  // Calculate completion rate trend (compare last week to previous week)
  const lastWeekVelocity = velocityByWeek?.slice(-1)[0]?.count || 0;
  const previousWeekVelocity = velocityByWeek?.slice(-2, -1)[0]?.count || 0;
  let velocityTrend: "up" | "down" | "flat" = "flat";
  if (lastWeekVelocity > previousWeekVelocity * 1.1) velocityTrend = "up";
  else if (lastWeekVelocity < previousWeekVelocity * 0.9) velocityTrend = "down";

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <AnalyticsStatCard
          label="Total Tasks"
          value={statusOverview?.total || 0}
          icon={BarChart3}
        />
        <AnalyticsStatCard
          label="Completion Rate"
          value={statusOverview?.completionRate || 0}
          icon={CheckCircle2}
          unit="%"
        />
        <AnalyticsStatCard
          label="Avg Cycle Time"
          value={cycleTimeMetrics?.overallAvgDays || 0}
          icon={Clock}
          unit=" days"
        />
        <AnalyticsStatCard
          label="Top Agent"
          value={
            agentLeaderboard && agentLeaderboard.length > 0
              ? agentLeaderboard[0].agentName
              : "—"
          }
          icon={Users}
        />
      </div>

      {/* Velocity Chart */}
      <div className="card p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Weekly Velocity
        </h3>
        <WeeklyVelocityChart data={velocityByWeek || []} />
      </div>

      {/* Task Status Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="card p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Task Status Distribution
          </h3>
          {statusOverview?.byStatus && statusOverview.byStatus.length > 0 ? (
            <MiniBarChart
              data={statusOverview.byStatus.map((item) => ({
                label: item.status,
                value: item.count,
              }))}
              colorFn={(status) => {
                const colors: Record<string, string> = {
                  backlog: "bg-muted",
                  ready: "bg-primary/20",
                  in_progress: "bg-warning/20",
                  review: "bg-accent/20",
                  blocked: "bg-destructive/20",
                  done: "bg-success/20",
                };
                return colors[status] || "bg-muted/50";
              }}
            />
          ) : (
            <div className="text-sm text-muted-foreground">No tasks yet</div>
          )}
        </div>

        {/* Cycle Time by Priority */}
        <div className="card p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Cycle Time by Priority
          </h3>
          {cycleTimeMetrics?.byPriority ? (
            <MiniBarChart
              data={Object.entries(cycleTimeMetrics.byPriority)
                .filter(([_, value]) => value > 0)
                .map(([priority, days]) => ({
                  label: priority,
                  value: days,
                }))}
              colorFn={(priority) => {
                const colors: Record<string, string> = {
                  P0: "bg-destructive",
                  P1: "bg-warning",
                  P2: "bg-primary",
                  P3: "bg-success",
                };
                return colors[priority] || "bg-muted/50";
              }}
            />
          ) : (
            <div className="text-sm text-muted-foreground">No completed tasks</div>
          )}
          <div className="text-xs text-muted-foreground mt-4">
            Average days to complete (sample: {cycleTimeMetrics?.sampleSize || 0}{" "}
            tasks)
          </div>
        </div>
      </div>

      {/* Agent Leaderboard */}
      <div className="card p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Users className="w-4 h-4" />
          Agent Performance Leaderboard
        </h3>
        {agentLeaderboard && agentLeaderboard.length > 0 ? (
          <div className="space-y-2">
            {agentLeaderboard.slice(0, 10).map((agent, index) => (
              <div key={agent.agentId} className="flex items-center justify-between p-2 hover:bg-muted rounded">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground w-6">
                    #{index + 1}
                  </span>
                  <span className="text-sm">{agent.agentName}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-right">
                    <span className="font-medium">{agent.tasksCompleted}</span>
                    <span className="text-xs text-muted-foreground ml-1">
                      completed
                    </span>
                  </div>
                  <div className="text-right w-16">
                    <span className="font-medium">
                      {agent.tasksCreated ? Math.round((agent.tasksCompleted / agent.tasksCreated) * 100) : 0}%
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">
                      rate
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            No agent metrics available
          </div>
        )}
      </div>

      {/* Priority Breakdown Card */}
      <div className="card p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          Task Priority Breakdown
        </h3>
        {statusOverview?.byPriority ? (
          <StackedBarChart
            segments={[
              {
                label: "P0 Critical",
                value: statusOverview.byPriority.P0 || 0,
                color: "bg-destructive",
              },
              {
                label: "P1 High",
                value: statusOverview.byPriority.P1 || 0,
                color: "bg-warning",
              },
              {
                label: "P2 Medium",
                value: statusOverview.byPriority.P2 || 0,
                color: "bg-primary",
              },
              {
                label: "P3 Low",
                value: statusOverview.byPriority.P3 || 0,
                color: "bg-success",
              },
            ]}
            total={statusOverview?.total || 0}
            label="Tasks by priority"
          />
        ) : null}
      </div>
    </div>
  );
}
