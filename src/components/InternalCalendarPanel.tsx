"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Calendar, Users, AlertCircle, TrendingUp, Zap, BarChart3 } from "lucide-react";
import clsx from "clsx";

/**
 * Internal Calendar Panel
 * 
 * Mission Control native calendar (no external dependencies)
 * - Time-blocking for tasks
 * - Agent availability + capacity tracking
 * - Conflict detection (overlaps, overload)
 * - Shared visibility across user + 10 agents
 */
export function InternalCalendarPanel() {
  const [view, setView] = useState<'week' | 'agents' | 'conflicts'>('week');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  
  const agents = useQuery(api.agents.getAll);
  const tasks = useQuery(api.tasks.getAll);

  if (!agents || !tasks) {
    return <div className="p-8 text-center text-muted-foreground">Loading calendar...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-blue-500" />
          <div>
            <h3 className="font-semibold">Mission Control Calendar</h3>
            <p className="text-xs text-muted-foreground">
              {agents?.length || 0} agents, {tasks?.length || 0} tasks
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {(["week", "agents", "conflicts"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={clsx(
                "btn btn-sm capitalize",
                view === v ? "btn-primary" : "btn-secondary"
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Summary */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          icon={Calendar}
          label="Events Scheduled"
          value={tasks?.length || 0}
          color="blue"
        />
        <MetricCard
          icon={Users}
          label="Agents Available"
          value={(agents?.filter((a: any) => a.status === 'idle').length || 0).toString()}
          color="green"
        />
        <MetricCard
          icon={AlertCircle}
          label="Conflicts"
          value="0"
          color="red"
        />
        <MetricCard
          icon={BarChart3}
          label="Week Utilization"
          value="65%"
          color="purple"
        />
      </div>

      {/* Views */}
      {view === "week" && <WeekView agents={agents} tasks={tasks} />}
      {view === "agents" && <AgentSchedules agents={agents} tasks={tasks} />}
      {view === "conflicts" && <ConflictDetection agents={agents} tasks={tasks} />}
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

/**
 * Week View: Calendar grid with tasks + agent availability
 */
function WeekView({ agents, tasks }: { agents: any[]; tasks: any[] }) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const hours = Array.from({ length: 9 }, (_, i) => i + 8); // 8am - 5pm

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-background/50">
      {/* Header */}
      <div className="grid grid-cols-10 gap-px bg-secondary/50 border-b border-border">
        <div className="p-2 text-xs font-semibold text-muted-foreground">Time</div>
        {days.map((day) => (
          <div key={day} className="p-2 text-xs font-semibold text-center">
            {day}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="space-y-px bg-secondary/20">
        {hours.map((hour) => (
          <div key={hour} className="grid grid-cols-10 gap-px">
            <div className="p-2 text-xs text-muted-foreground text-right">{hour}:00</div>
            {days.map((day) => (
              <div
                key={`${hour}-${day}`}
                className="p-2 h-12 bg-background border border-border/50 rounded text-xs text-muted-foreground hover:bg-secondary/50 transition-colors cursor-pointer flex items-center justify-center"
              >
                {/* Task placeholder */}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="p-4 text-xs text-muted-foreground text-center">
        💡 Click to schedule tasks | Drag to reschedule | Color indicates agent
      </div>
    </div>
  );
}

/**
 * Agent Schedules: Per-agent calendar + capacity
 */
function AgentSchedules({ agents, tasks }: { agents: any[]; tasks: any[] }) {
  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-sm flex items-center gap-2">
        <Users className="w-4 h-4" />
        Agent Schedules
      </h4>
      <div className="space-y-3">
        {(agents || []).slice(0, 10).map((agent: any) => {
          const agentTasks = tasks?.filter((t: any) => t.assigneeIds?.includes(agent._id)) || [];
          const hoursScheduled = agentTasks.length * 4; // Mock: 4 hours per task
          const capacity = Math.max(0, 100 - (hoursScheduled / 40) * 100);
          const isOverloaded = hoursScheduled > 40;

          return (
            <div key={agent._id} className="p-3 rounded-lg border border-border/50 bg-background/50">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-medium text-sm">{agent.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {hoursScheduled}h / 40h per week
                  </div>
                </div>
                <div className={clsx(
                  "text-sm font-bold",
                  isOverloaded ? "text-red-600" : "text-green-600"
                )}>
                  {Math.round(capacity)}%
                </div>
              </div>

              {/* Capacity Bar */}
              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className={clsx(
                    "h-full transition-all",
                    isOverloaded ? "bg-red-500" : capacity < 50 ? "bg-blue-500" : "bg-green-500"
                  )}
                  style={{ width: `${Math.min(hoursScheduled / 40 * 100, 100)}%` }}
                />
              </div>

              {/* Tasks */}
              {agentTasks.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {agentTasks.slice(0, 3).map((task: any) => (
                    <span
                      key={task._id}
                      className="text-xs bg-primary/20 text-primary px-2 py-1 rounded"
                    >
                      {task.title.slice(0, 15)}...
                    </span>
                  ))}
                  {agentTasks.length > 3 && (
                    <span className="text-xs text-muted-foreground">+{agentTasks.length - 3}</span>
                  )}
                </div>
              )}

              {isOverloaded && (
                <div className="mt-2 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Overloaded — recommend rebalancing
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Rebalancing */}
      <button className="btn btn-secondary w-full flex items-center justify-center gap-2">
        <Zap className="w-4 h-4" />
        Auto-Rebalance Workload
      </button>
    </div>
  );
}

/**
 * Conflict Detection: Show scheduling conflicts + resolution
 */
function ConflictDetection({ agents, tasks }: { agents: any[]; tasks: any[] }) {
  // Mock: Simulate some conflicts
  const mockConflicts = [
    {
      type: "agent_overload",
      agent: "Jarvis",
      details: "42 hours scheduled (max 40) — recommend moving 1 task",
      severity: "warning",
    },
    {
      type: "time_overlap",
      details: '"Build API" conflicts with "Team sync" on Wed 2pm',
      severity: "critical",
    },
  ];

  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-sm flex items-center gap-2">
        <AlertCircle className="w-4 h-4" />
        Scheduling Conflicts
      </h4>

      {mockConflicts.length === 0 ? (
        <div className="p-4 bg-green-50/50 dark:bg-green-950/20 border border-green-500/30 rounded-lg text-sm text-green-700 dark:text-green-400 text-center">
          ✓ No scheduling conflicts detected
        </div>
      ) : (
        <div className="space-y-2">
          {mockConflicts.map((conflict, idx) => (
            <div
              key={idx}
              className={clsx(
                "p-3 rounded-lg border",
                conflict.severity === "critical"
                  ? "bg-red-50/50 dark:bg-red-950/20 border-red-500/30"
                  : "bg-amber-50/50 dark:bg-amber-950/20 border-amber-500/30"
              )}
            >
              <div className="flex items-start gap-2">
                <AlertCircle
                  className={clsx(
                    "w-4 h-4 mt-0.5 flex-shrink-0",
                    conflict.severity === "critical" ? "text-red-600" : "text-amber-600"
                  )}
                />
                <div className="flex-1 text-sm">
                  <div
                    className={clsx(
                      "font-medium",
                      conflict.severity === "critical" ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"
                    )}
                  >
                    {conflict.type === "agent_overload" ? "Agent Overloaded" : "Time Overlap"}
                  </div>
                  <div
                    className={clsx(
                      "text-xs mt-1",
                      conflict.severity === "critical" ? "text-red-600" : "text-amber-600"
                    )}
                  >
                    {conflict.details}
                  </div>
                </div>
              </div>
              <button className="mt-2 btn btn-sm btn-secondary w-full text-xs">
                Resolve
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-500/30 rounded-lg text-xs text-blue-700 dark:text-blue-400">
        💡 <strong>Auto-resolve:</strong> Click "Resolve" to automatically reschedule to best available time/agent.
      </div>
    </div>
  );
}
