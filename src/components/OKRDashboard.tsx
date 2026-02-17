"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  Target, TrendingUp, CheckCircle2, AlertCircle, Plus,
  ChevronDown, ChevronRight, Award, BarChart3, Zap
} from "lucide-react";
import clsx from "clsx";

interface KeyResult {
  id: string;
  title: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  confidence: number; // 0-100
  status: "at_risk" | "on_track" | "achieved";
  completedAt?: number;
}

interface OKRGoal {
  _id: string;
  title: string;
  category: string;
  progress: number;
  status: string;
  keyResults: KeyResult[];
  relatedTaskIds: string[];
  completedTasksCount: number;
  deadline: number;
}

/**
 * OKR Dashboard - Hierarchical goal tracking
 * Displays: Goals → Key Results → Task Progress
 */
export function OKRDashboard() {
  const goals = useQuery(api.goals.getByProgress);
  const tasks = useQuery(api.tasks.getAll);
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());

  const toggleGoal = (goalId: string) => {
    const newExpanded = new Set(expandedGoals);
    if (newExpanded.has(goalId)) {
      newExpanded.delete(goalId);
    } else {
      newExpanded.add(goalId);
    }
    setExpandedGoals(newExpanded);
  };

  if (!goals) {
    return <div className="p-8 text-center text-muted-foreground">Loading OKRs...</div>;
  }

  const allGoals = Object.values(goals).flat() as any[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Target className="w-6 h-6 text-blue-500" />
            OKR Tracking
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {allGoals.length} goals, {allGoals.reduce((sum, g: any) => sum + (g.keyResults?.length || 0), 0)} key results
          </p>
        </div>
        <button className="btn btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Goal
        </button>
      </div>

      {/* Metrics Summary */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          icon={Target}
          label="Active Goals"
          value={allGoals.filter((g: any) => g.status === "active").length}
          color="blue"
        />
        <MetricCard
          icon={CheckCircle2}
          label="Achieved"
          value={allGoals.filter((g: any) => g.status === "done").length}
          color="green"
        />
        <MetricCard
          icon={AlertCircle}
          label="At Risk"
          value={allGoals.filter((g: any) => g.progress < 25).length}
          color="red"
        />
        <MetricCard
          icon={TrendingUp}
          label="Avg Progress"
          value={`${Math.round(allGoals.reduce((sum, g: any) => sum + (g.progress || 0), 0) / allGoals.length)}%`}
          color="purple"
        />
      </div>

      {/* Goals Hierarchy */}
      <div className="space-y-3">
        {allGoals.map((goal: any) => (
          <GoalCard
            key={goal._id}
            goal={goal}
            expanded={expandedGoals.has(goal._id)}
            onToggle={() => toggleGoal(goal._id)}
            relatedTasks={tasks?.filter((t: any) => goal.relatedTaskIds?.includes(t._id)) || []}
          />
        ))}
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: string | number;
  color: "blue" | "green" | "red" | "purple";
}) {
  const colors = {
    blue: "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300",
    green: "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300",
    red: "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300",
    purple: "bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300",
  };

  return (
    <div className={clsx("p-4 rounded-lg", colors[color])}>
      <Icon className="w-5 h-5 mb-2 opacity-75" />
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs opacity-75">{label}</div>
    </div>
  );
}

function GoalCard({
  goal,
  expanded,
  onToggle,
  relatedTasks,
}: {
  goal: any;
  expanded: boolean;
  onToggle: () => void;
  relatedTasks: any[];
}) {
  const keyResults = goal.keyResults || generateMockKRs(goal);
  const avgKRProgress = keyResults.length > 0
    ? Math.round(keyResults.reduce((sum: number, kr: any) => sum + kr.currentValue / kr.targetValue * 100, 0) / keyResults.length)
    : 0;

  const statusColor =
    goal.progress >= 75
      ? "text-green-600"
      : goal.progress >= 50
        ? "text-blue-600"
        : goal.progress >= 25
          ? "text-amber-600"
          : "text-red-600";

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Goal Header */}
      <button
        onClick={onToggle}
        className="w-full p-4 hover:bg-secondary/50 transition-colors flex items-start gap-3 text-left"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 mt-1 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 mt-1 flex-shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-foreground">{goal.title}</div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
            <span className="capitalize">{goal.category}</span>
            <span>•</span>
            <span className={`font-medium ${statusColor}`}>{goal.progress}%</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className={clsx(
                "h-full transition-all",
                goal.progress >= 75
                  ? "bg-green-500"
                  : goal.progress >= 50
                    ? "bg-blue-500"
                    : goal.progress >= 25
                      ? "bg-amber-500"
                      : "bg-red-500"
              )}
              style={{ width: `${goal.progress}%` }}
            />
          </div>
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-border p-4 space-y-4 bg-secondary/20">
          {/* Key Results */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Award className="w-4 h-4" />
              Key Results ({keyResults.length})
            </h4>
            <div className="space-y-2">
              {keyResults.map((kr: any, idx: number) => (
                <KeyResultCard key={idx} kr={kr} />
              ))}
            </div>
          </div>

          {/* Related Tasks */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Tasks ({relatedTasks.length})
            </h4>
            {relatedTasks.length > 0 ? (
              <div className="space-y-1">
                {relatedTasks.slice(0, 5).map((task: any) => (
                  <div
                    key={task._id}
                    className="text-xs p-2 rounded bg-background/50 border border-border/50 flex items-center justify-between"
                  >
                    <span className="truncate">{task.title}</span>
                    <span
                      className={clsx(
                        "text-[10px] px-2 py-1 rounded font-medium",
                        task.status === "done"
                          ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                          : task.status === "in_progress"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      )}
                    >
                      {task.status}
                    </span>
                  </div>
                ))}
                {relatedTasks.length > 5 && (
                  <div className="text-xs text-muted-foreground p-2">
                    +{relatedTasks.length - 5} more tasks
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground p-2">No tasks yet</div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button className="btn btn-sm btn-secondary flex-1">Edit KRs</button>
            <button className="btn btn-sm btn-secondary flex-1">Add Task</button>
          </div>
        </div>
      )}
    </div>
  );
}

function KeyResultCard({ kr }: { kr: any }) {
  const progressPercent = (kr.currentValue / kr.targetValue) * 100;
  const achieved = kr.currentValue >= kr.targetValue;

  return (
    <div className="p-3 rounded-lg bg-background/50 border border-border/50 space-y-2">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="font-medium text-sm">{kr.title}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {kr.currentValue} / {kr.targetValue} {kr.unit}
          </div>
        </div>
        <div className={clsx("text-sm font-bold", achieved ? "text-green-600" : "text-muted-foreground")}>
          {Math.round(progressPercent)}%
        </div>
      </div>
      <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className={clsx(
            "h-full transition-all",
            achieved ? "bg-green-500" : kr.confidence > 75 ? "bg-blue-500" : kr.confidence > 50 ? "bg-amber-500" : "bg-red-500"
          )}
          style={{ width: `${Math.min(progressPercent, 100)}%` }}
        />
      </div>
      {kr.confidence < 75 && (
        <div className="text-xs text-amber-600 dark:text-amber-400">
          Confidence: {kr.confidence}% — May not achieve by deadline
        </div>
      )}
    </div>
  );
}

// Mock KRs for demo
function generateMockKRs(goal: any): KeyResult[] {
  if (goal.progress === 0) return [];
  return [
    {
      id: `kr-1-${goal._id}`,
      title: `Complete core requirements`,
      targetValue: 100,
      currentValue: goal.progress,
      unit: "%",
      confidence: Math.max(50, 100 - (100 - goal.progress)),
      status: goal.progress >= 100 ? "achieved" : goal.progress >= 75 ? "on_track" : "at_risk",
    },
    {
      id: `kr-2-${goal._id}`,
      title: `User feedback score ≥ 4/5`,
      targetValue: 5,
      currentValue: Math.min(5, 2 + goal.progress / 50),
      unit: "/5",
      confidence: 70,
      status: "on_track",
    },
  ];
}
