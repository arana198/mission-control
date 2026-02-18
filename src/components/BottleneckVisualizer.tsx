"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  AlertTriangle, TrendingDown, Network, Clock, Users,
  ChevronDown, ChevronRight
} from "lucide-react";
import clsx from "clsx";

/**
 * Advanced Bottleneck Visualizer
 *
 * Displays:
 * - Severity heatmap (critical → medium)
 * - Task dependency graph (which tasks block others)
 * - Critical path highlighting (longest chain to completion)
 * - Agent utilization vs. capacity
 */

// Magic numbers extracted to constants
const CAPACITY_PER_TASK = 20; // % capacity per active task
const OVERLOAD_THRESHOLD = 70;
const UNDERUTILIZED_THRESHOLD = 30;
const CRITICAL_PROGRESS_THRESHOLD = 50;
const HIGH_RISK_PROGRESS = 25;
const CRITICAL_RISK_PROGRESS = 10;

export function BottleneckVisualizer() {
  const goals = useQuery(api.goals.getByProgress);
  const tasks = useQuery(api.tasks.getAllTasks);
  const agents = useQuery(api.agents.getAllAgents);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [view, setView] = useState<"heatmap" | "graph" | "path" | "agents">("heatmap");

  if (!goals || !tasks || !agents) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }

  const allGoals = Object.values(goals).flat() as any[];
  const bottleneckedGoals = allGoals.filter((g: any) => g.progress < CRITICAL_PROGRESS_THRESHOLD);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            Bottleneck Analysis
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {bottleneckedGoals.length} goals with less than 50% progress
          </p>
        </div>
        <div className="flex gap-2">
          {(["heatmap", "graph", "path", "agents"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={clsx(
                "btn btn-sm",
                view === v ? "btn-primary" : "btn-secondary"
              )}
            >
              {v === "heatmap" && "Heatmap"}
              {v === "graph" && "Dependencies"}
              {v === "path" && "Critical Path"}
              {v === "agents" && "Utilization"}
            </button>
          ))}
        </div>
      </div>

      {/* View Selector */}
      {view === "heatmap" && <HeatmapView goals={bottleneckedGoals} />}
      {view === "graph" && <DependencyGraph goals={allGoals} tasks={tasks} />}
      {view === "path" && <CriticalPathView goals={allGoals} tasks={tasks} />}
      {view === "agents" && <AgentUtilizationView agents={agents} goals={allGoals} />}
    </div>
  );
}

/**
 * Severity Heatmap: Visualize bottleneck distribution
 */
function HeatmapView({ goals }: { goals: any[] }) {
  // Derive categories from actual goal data (not hardcoded)
  const categories = Array.from(
    new Set(goals.map((g: any) => g.category).filter(Boolean))
  ).sort();

  if (categories.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No goals to analyze. Create goals to see bottleneck patterns.
      </div>
    );
  }

  const severities = categories.map((cat) => {
    const goalsInCat = goals.filter((g: any) => g.category === cat);
    const avgProgress = goalsInCat.length > 0
      ? goalsInCat.reduce((sum: number, g: any) => sum + g.progress, 0) / goalsInCat.length
      : 50;
    const severity = avgProgress < CRITICAL_RISK_PROGRESS ? "critical" : avgProgress < HIGH_RISK_PROGRESS ? "high" : "medium";
    return { category: cat, count: goalsInCat.length, avgProgress, severity };
  });

  return (
    <div className="grid grid-cols-2 gap-4">
      {severities.map((item) => {
        const colors = {
          critical: "bg-red-500 text-white",
          high: "bg-amber-500 text-white",
          medium: "bg-yellow-500 text-white",
        };
        return (
          <div
            key={item.category}
            className={clsx(
              "p-4 rounded-lg",
              colors[item.severity as keyof typeof colors]
            )}
          >
            <div className="font-semibold">{item.category.charAt(0).toUpperCase() + item.category.slice(1)}</div>
            <div className="text-sm mt-2">
              {item.count} goals | {Math.round(item.avgProgress)}% avg progress
            </div>
            <div className="mt-3 text-xs opacity-75 capitalize">
              Severity: {item.severity}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Task Dependency Graph: Show which tasks block others
 */
function DependencyGraph({ goals, tasks }: { goals: any[]; tasks: any[] }) {
  // Simplified: Show critical blockers (tasks that other tasks depend on)
  const blockedGoals = goals.filter((g: any) => g.progress < 50);

  return (
    <div className="space-y-4">
      <div className="p-4 bg-secondary/50 rounded-lg border border-border">
        <h3 className="font-semibold flex items-center gap-2 mb-3">
          <Network className="w-4 h-4" />
          Critical Blockers
        </h3>
        <div className="space-y-2">
          {blockedGoals.slice(0, 5).map((goal: any) => (
            <div key={goal._id} className="text-sm p-3 bg-background rounded border border-border/50">
              <div className="font-medium">{goal.title}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {goal.relatedTaskIds?.length || 0} tasks | {goal.progress}% progress
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {(goal.relatedTaskIds || []).slice(0, 3).map((taskId: any, idx: number) => (
                  <span key={idx} className="text-xs bg-red-500/20 text-red-700 dark:text-red-400 px-2 py-1 rounded">
                    Task {idx + 1}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20 text-sm text-blue-700 dark:text-blue-400">
        💡 <strong>Hint:</strong> Break critical tasks into smaller milestones to unblock parallel work.
      </div>
    </div>
  );
}

/**
 * Critical Path: Goals with most tasks relative to progress
 * Note: True critical path analysis requires task dependency graphs
 */
function CriticalPathView({ goals, tasks }: { goals: any[]; tasks: any[] }) {
  const criticalGoals = goals
    .filter((g: any) => g.progress > 0 && g.progress < 75)
    .sort((a: any, b: any) => (b.relatedTaskIds?.length || 0) - (a.relatedTaskIds?.length || 0))
    .slice(0, 3);

  if (criticalGoals.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No goals in critical path range (0-75% progress). Goals are either completed or blocked.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {criticalGoals.map((goal: any, idx: number) => {
        const taskCount = goal.relatedTaskIds?.length || 0;
        return (
          <div key={goal._id} className="p-4 border border-border rounded-lg">
            <div className="flex items-center gap-3 mb-3">
              <div className="font-semibold">{goal.title}</div>
              <span className="text-xs px-2 py-1 rounded bg-amber-500/20 text-amber-700 dark:text-amber-400">
                {taskCount} {taskCount === 1 ? "task" : "tasks"}
              </span>
              <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-700 dark:text-blue-400">
                {goal.progress}% progress
              </span>
            </div>

            {/* Task sequence visualization */}
            <div className="space-y-2">
              {(goal.relatedTaskIds || []).slice(0, 4).map((taskId: any, step: number) => (
                <div key={taskId} className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {step + 1}
                  </div>
                  <div className="flex-1 h-1 bg-gradient-to-r from-blue-500 to-blue-300" />
                </div>
              ))}
            </div>

            {taskCount > 4 && (
              <div className="mt-2 text-xs text-muted-foreground">
                +{taskCount - 4} more {taskCount - 4 === 1 ? "task" : "tasks"}
              </div>
            )}

            <div className="mt-3 p-2 bg-background/50 rounded text-xs text-muted-foreground">
              Remaining to complete: {Math.round(100 - goal.progress)}%
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Agent Utilization vs. Capacity
 */
function AgentUtilizationView({ agents, goals, tasks }: { agents: any[]; goals: any[]; tasks?: any[] }) {
  // Get all tasks from goals and compute agent utilization
  const allTaskIds = new Set(goals.flatMap((g: any) => g.relatedTaskIds || []));
  const tasksData = Array.from(allTaskIds).map((id) => {
    // Find task details from goals (simplified since tasks aren't passed)
    return { _id: id };
  });

  const agentLoads = (agents as any[]).map((agent) => {
    // Count active (in_progress/review) tasks assigned to this agent
    // Note: This is a simplified calculation since we get task IDs from goals
    // In a real system, we'd fetch the full task objects to check status
    const assignedTaskCount = (agent.currentTaskId ? 1 : 0);
    const utilization = Math.min(100, assignedTaskCount * CAPACITY_PER_TASK);

    return {
      id: agent._id,
      name: agent.name,
      capacity: 100,
      current: utilization,
      activeTaskCount: assignedTaskCount,
      status: agent.status,
    };
  });

  const overloaded = agentLoads.filter((a) => a.current > OVERLOAD_THRESHOLD);
  const underutilized = agentLoads.filter((a) => a.current < UNDERUTILIZED_THRESHOLD);
  const balanced = agentLoads.length - overloaded.length - underutilized.length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/20">
          <div className="text-2xl font-bold text-red-600">{overloaded.length}</div>
          <div className="text-xs text-red-700 dark:text-red-400">Overloaded</div>
        </div>
        <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
          <div className="text-2xl font-bold text-green-600">{balanced}</div>
          <div className="text-xs text-green-700 dark:text-green-400">Balanced</div>
        </div>
        <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
          <div className="text-2xl font-bold text-blue-600">{underutilized.length}</div>
          <div className="text-xs text-blue-700 dark:text-blue-400">Underutilized</div>
        </div>
      </div>

      {/* Agent List */}
      <div className="space-y-2">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Users className="w-4 h-4" />
          Agent Utilization
        </h3>
        {agentLoads.map((agent) => (
          <div key={agent.id} className="p-3 bg-secondary/30 rounded-lg border border-border/50">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-sm">{agent.name}</span>
              <span className={clsx(
                "text-xs font-bold",
                agent.current > OVERLOAD_THRESHOLD ? "text-red-600" : agent.current > 50 ? "text-amber-600" : "text-green-600"
              )}>
                {Math.round(agent.current)}%
              </span>
            </div>
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className={clsx(
                  "h-full transition-all",
                  agent.current > OVERLOAD_THRESHOLD ? "bg-red-500" : agent.current > 50 ? "bg-amber-500" : "bg-green-500"
                )}
                style={{ width: `${agent.current}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {agent.activeTaskCount} active {agent.activeTaskCount === 1 ? "task" : "tasks"} • {agent.status}
            </div>
          </div>
        ))}
      </div>

      {/* Recommendations */}
      <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20 space-y-2">
        <div className="font-semibold text-sm text-blue-700 dark:text-blue-400">Rebalancing Recommendations</div>
        <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
          <li>• Shift {overloaded.length} tasks from overloaded agents to underutilized ones</li>
          <li>• Prioritize P0 tasks for high-capacity agents</li>
          <li>• Consider temporary pause for {overloaded.length > 0 ? "new task intake" : "none needed"}</li>
        </ul>
      </div>
    </div>
  );
}
