"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

// Skip prerendering for dynamic page
export const dynamic = "force-dynamic";

/**
 * Mission Control V2 - Agent Control Panel
 * Phase 6B: Observability Dashboard using Phase 5 queries
 */
export default function ControlPage() {
  // Get first available business to satisfy query requirement
  const businesses = useQuery(api.businesses.getAll);
  const businessId = businesses?.[0]?._id;

  // Phase 5 Observability Queries
  const systemHealth = useQuery(
    api.agentLifecycle.getSystemHealthFixed,
    businessId ? { businessId } : "skip"
  );
  const recentExecutions = useQuery(api.executions.getRecentExecutions, {
    limit: 20,
  });
  const events = useQuery(api.executions.getEventStream, {
    limit: 50,
  });
  const costBreakdown = useQuery(api.executions.getCostBreakdown, {
    date: new Date().toISOString().split("T")[0],
  });
  const agents = useQuery(api.agents.getAllAgents);

  // Helpers
  const formatTokens = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return n.toString();
  };

  const formatCents = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const timeAgo = (ts: number) => {
    const secs = Math.floor((Date.now() - ts) / 1000);
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86400)}d ago`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
      case "idle":
        return "text-success";
      case "busy":
      case "running":
        return "text-warning";
      case "failed":
      case "error":
        return "text-destructive";
      default:
        return "text-muted-foreground";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "info":
        return "text-primary";
      case "warning":
        return "text-warning";
      case "error":
        return "text-destructive";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              🎛️ Mission Control
            </h1>
            <p className="text-muted-foreground">
              Observability Dashboard — Phase 6B Control Plane
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors"
          >
            ↻ Refresh
          </button>
        </div>

        {/* System Health Stats */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">System Health</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Agents"
              value={systemHealth?.totalAgents ?? 0}
              icon="🤖"
            />
            <StatCard
              label="Active"
              value={systemHealth?.activeAgents ?? 0}
              icon="🚀"
            />
            <StatCard
              label="Health"
              value={`${systemHealth?.systemHealthPercent ?? 0}%`}
              icon="❤️"
            />
            <StatCard
              label="Avg Queue"
              value={systemHealth?.avgQueueDepth?.toFixed(1) ?? 0}
              icon="📊"
            />
          </div>
        </section>

        {/* Main Grid: Executions + Events */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Recent Executions */}
          <div className="card">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              📋 Recent Executions
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {recentExecutions?.slice(0, 10).map((exec: any) => (
                <div
                  key={exec._id}
                  className="bg-muted rounded p-3 border border-border hover:border-border-strong transition-colors"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <div className="font-medium text-foreground">
                        {exec.agentName || "Unknown"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {exec.triggerType || "manual"} •{" "}
                        <span className={getStatusColor(exec.status)}>
                          {exec.status}
                        </span>
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <div>{formatTokens(exec.inputTokens || 0)} tokens</div>
                      <div className="text-xs">
                        {timeAgo(exec.startTime || 0)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {!recentExecutions || recentExecutions.length === 0 && (
                <div className="text-center text-muted-foreground py-8">No recent executions</div>
              )}
            </div>
          </div>

          {/* Live Event Feed */}
          <div className="card">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              📢 Event Stream
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {events?.slice(0, 15).map((event: any) => (
                <div
                  key={event._id}
                  className="bg-muted rounded p-3 border border-border hover:border-border-strong transition-colors"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-medium ${getSeverityColor(event.severity)}`}>
                          ●
                        </span>
                        <span className="text-foreground font-medium text-sm">
                          {event.type}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {event.message}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground/75 whitespace-nowrap">
                      {timeAgo(event.timestamp || 0)}
                    </div>
                  </div>
                </div>
              ))}
              {!events || events.length === 0 && (
                <div className="text-center text-muted-foreground py-8">No events</div>
              )}
            </div>
          </div>
        </section>

        {/* Cost Breakdown */}
        <section className="card mb-8">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            💰 Cost Today
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-muted rounded p-4 border border-border">
              <div className="text-sm text-muted-foreground mb-2">Total Cost</div>
              <div className="text-3xl font-bold text-foreground">
                {formatCents(costBreakdown?.totalCostCents || 0)}
              </div>
            </div>
            <div className="bg-muted rounded p-4 border border-border">
              <div className="text-sm text-muted-foreground mb-2">Agents</div>
              <div className="text-3xl font-bold text-foreground">
                {costBreakdown?.byAgent?.length || 0}
              </div>
            </div>
            <div className="bg-muted rounded p-4 border border-border">
              <div className="text-sm text-muted-foreground mb-2">Avg per Agent</div>
              <div className="text-3xl font-bold text-foreground">
                {formatCents(
                  ((costBreakdown?.totalCostCents || 0) / (costBreakdown?.byAgent?.length || 1)) | 0
                )}
              </div>
            </div>
          </div>
          {costBreakdown?.byAgent && costBreakdown.byAgent.length > 0 && (
            <div className="mt-6 pt-6 border-t border-border">
              <div className="text-sm text-muted-foreground mb-3">Per-Agent Breakdown</div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {costBreakdown.byAgent.map((item: any) => (
                  <div
                    key={item.agentId}
                    className="bg-card rounded p-3 flex justify-between items-center"
                  >
                    <span className="text-foreground text-sm truncate">
                      {agents?.find((a: any) => a._id === item.agentId)?.name ||
                        "Unknown"}
                    </span>
                    <span className="text-foreground font-medium">
                      {formatCents(item.costCents)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Agent Registry */}
        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">
            🤖 Agent Registry
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents?.map((agent: any) => (
              <div key={agent._id} className="card">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold text-foreground">{agent.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {agent.role} • Level {agent.level || 1}
                    </p>
                  </div>
                  <span className="badge bg-muted text-muted-foreground text-xs">
                    {agent.runtimeStatus || "idle"}
                  </span>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div>
                    {agent.workspacePath ? (
                      <div className="truncate font-mono text-xs">
                        {agent.workspacePath}
                      </div>
                    ) : (
                      <div>—</div>
                    )}
                  </div>
                  <div>Last seen: {timeAgo(agent.lastHeartbeat || 0)}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/**
 * Stat Card Component
 */
function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: string;
}) {
  return (
    <div className="card">
      <div className="flex justify-between items-start mb-2">
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="text-muted-foreground text-sm mb-1">{label}</div>
      <div className="text-3xl font-bold text-foreground">{value}</div>
    </div>
  );
}
