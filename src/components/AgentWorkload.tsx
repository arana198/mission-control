"use client";

import { useState, useMemo } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  Clock, CheckCircle2, AlertCircle, Loader2, Users,
  Briefcase, BarChart3, Calendar, ArrowUpRight, X, Zap, AlertTriangle
} from "lucide-react";

interface Agent {
  _id: string;
  name: string;
  role: string;
  level: "lead" | "specialist" | "intern";
  status: "idle" | "active" | "blocked";
  currentTaskId?: string;
}

interface Task {
  _id: string;
  title: string;
  status: string;
  priority: "P0" | "P1" | "P2" | "P3";
  assigneeIds: string[];
  timeEstimate?: "XS" | "S" | "M" | "L" | "XL";
  dueDate?: number;
  epicId?: string;
}

interface Epic {
  _id: string;
  title: string;
}

const TIME_HOURS: Record<string, number> = {
  XS: 1,
  S: 4,
  M: 8,
  L: 24,
  XL: 40,
};

export function AgentWorkload({ agents, tasks, epics }: {
  agents: Agent[];
  tasks: Task[];
  epics: Epic[];
}) {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [sortBy, setSortBy] = useState<"workload" | "tasks" | "name">("workload");

  // Rebalance functionality
  const autoAssignBacklog = useMutation(api.tasks.autoAssignBacklog);
  const [rebalancing, setRebalancing] = useState(false);
  const [rebalanceResult, setRebalanceResult] = useState<string | null>(null);

  const handleRebalance = async () => {
    setRebalancing(true);
    setRebalanceResult(null);
    try {
      const result = await autoAssignBacklog({ jarvisId: "system", limit: 10 });
      setRebalanceResult(`${result.assigned} task${result.assigned !== 1 ? "s" : ""} auto-assigned`);
      // Clear message after 3 seconds
      setTimeout(() => setRebalanceResult(null), 3000);
    } catch (error) {
      setRebalanceResult("Failed to auto-assign tasks");
      setTimeout(() => setRebalanceResult(null), 3000);
    } finally {
      setRebalancing(false);
    }
  };

  // Calculate workload for each agent
  const agentWorkloads = useMemo(() => {
    const data = agents.map(agent => {
      const agentTasks = tasks.filter(t => t.assigneeIds.includes(agent._id));
      const assignedTasks = agentTasks.length;
      const inProgressTasks = agentTasks.filter(t => t.status === "in_progress").length;
      const completedTasks = agentTasks.filter(t => t.status === "done").length;
      const backlogTasks = agentTasks.filter(t => t.status === "backlog" || t.status === "ready").length;
      const blockedTasks = agentTasks.filter(t => t.status === "blocked").length;

      // Calculate estimated hours
      const totalEstimatedHours = agentTasks.reduce((sum, t) => {
        return sum + (TIME_HOURS[t.timeEstimate || "M"] || 8);
      }, 0);

      const completedHours = agentTasks
        .filter(t => t.status === "done")
        .reduce((sum, t) => sum + (TIME_HOURS[t.timeEstimate || "M"] || 8), 0);

      // P0/P1 count
      const criticalTasks = agentTasks.filter(t => t.priority === "P0" || t.priority === "P1").length;

      // Overdue tasks
      const overdueTasks = agentTasks.filter(t => 
        t.dueDate && Date.now() > t.dueDate && t.status !== "done"
      );

      return {
        agent,
        assignedTasks,
        inProgressTasks,
        completedTasks,
        backlogTasks,
        blockedTasks,
        totalEstimatedHours,
        completedHours,
        criticalTasks,
        overdueTasks,
        tasks: agentTasks,
        utilization: totalEstimatedHours > 0 ? (completedHours / totalEstimatedHours) * 100 : 0,
      };
    });

    // Sort
    return data.sort((a, b) => {
      if (sortBy === "workload") return b.totalEstimatedHours - a.totalEstimatedHours;
      if (sortBy === "tasks") return b.assignedTasks - a.assignedTasks;
      return a.agent.name.localeCompare(b.agent.name);
    });
  }, [agents, tasks, sortBy]);

  if (selectedAgent) {
    const workload = agentWorkloads.find(w => w.agent._id === selectedAgent._id)!;
    return (
      <AgentDetailView 
        workload={workload} 
        epics={epics} 
        onBack={() => setSelectedAgent(null)} 
      />
    );
  }

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Agent Workload</h2>
          <p className="text-sm text-muted-foreground">
            Capacity planning and task distribution across the squad
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRebalance}
            disabled={rebalancing}
            className="btn btn-secondary text-sm flex items-center gap-2"
            title="Auto-assign unassigned backlog tasks to best-fit agents"
          >
            {rebalancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Rebalance
          </button>
          {rebalanceResult && (
            <span className="text-sm text-green-600 font-medium">{rebalanceResult}</span>
          )}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="input w-auto"
          >
            <option value="workload">Sort by hours</option>
            <option value="tasks">Sort by task count</option>
            <option value="name">Sort by name</option>
          </select>
        </div>
      </div>

      {/* Team Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <StatCard 
          label="Total Capacity" 
          value={`${agentWorkloads.reduce((sum, w) => sum + w.totalEstimatedHours, 0)}h`}
          icon={Clock}
        />
        <StatCard 
          label="In Progress" 
          value={agentWorkloads.reduce((sum, w) => sum + w.inProgressTasks, 0)}
          icon={Loader2}
          color="amber"
        />
        <StatCard 
          label="Completed" 
          value={agentWorkloads.reduce((sum, w) => sum + w.completedTasks, 0)}
          icon={CheckCircle2}
          color="green"
        />
        <StatCard 
          label="Critical (P0/P1)" 
          value={agentWorkloads.reduce((sum, w) => sum + w.criticalTasks, 0)}
          icon={AlertCircle}
          color="red"
        />
        <StatCard 
          label="Blocked" 
          value={agentWorkloads.reduce((sum, w) => sum + w.blockedTasks, 0)}
          icon={AlertCircle}
          color="orange"
        />
      </div>

      {/* Workload Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {agentWorkloads.map((workload) => {
          const { agent } = workload;
          const levelColors = {
            lead: "bg-blue-500",
            specialist: "bg-slate-500",
            intern: "bg-amber-500",
          };

          return (
            <div
              key={agent._id}
              onClick={() => setSelectedAgent(agent)}
              className={`card p-4 cursor-pointer hover:scale-[1.02] transition-transform ${
                workload.totalEstimatedHours > 80 ? "ring-2 ring-red-200" : ""
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${levelColors[agent.level]} flex items-center justify-center text-white font-medium`}>
                    {agent.name[0]}
                  </div>
                  <div>
                    <h3 className="font-semibold">{agent.name}</h3>
                    <p className="text-xs text-muted-foreground">{agent.role}</p>
                  </div>
                </div>
                <span className={`badge ${
                  agent.status === "active" ? "badge-status-active" :
                  agent.status === "blocked" ? "badge-status-blocked" :
                  "badge-status-idle"
                } text-xs`}>
                  {agent.status}
                </span>
              </div>

              {/* Workload bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Workload</span>
                  <span className="font-medium">{workload.totalEstimatedHours}h</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      workload.totalEstimatedHours > 80 ? "bg-red-500" :
                      workload.totalEstimatedHours > 40 ? "bg-amber-500" :
                      "bg-green-500"
                    }`}
                    style={{ width: `${Math.min((workload.totalEstimatedHours / 80) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {/* Task breakdown */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-muted/50 rounded p-2">
                  <p className="font-semibold text-sm">{workload.assignedTasks}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Total</p>
                </div>
                <div className="bg-blue-50 rounded p-2">
                  <p className="font-semibold text-sm text-blue-700">{workload.inProgressTasks}</p>
                  <p className="text-[10px] text-blue-600 uppercase">Active</p>
                </div>
                <div className="bg-amber-50 rounded p-2">
                  <p className="font-semibold text-sm text-amber-700">{workload.criticalTasks}</p>
                  <p className="text-[10px] text-amber-600 uppercase">P0/P1</p>
                </div>
                <div className="bg-red-50 rounded p-2">
                  <p className="font-semibold text-sm text-red-700">{workload.overdueTasks.length}</p>
                  <p className="text-[10px] text-red-600 uppercase">Overdue</p>
                </div>
              </div>

              {workload.totalEstimatedHours > 80 && (
                <div className="mt-3 flex items-center gap-1 text-xs text-red-600 font-medium">
                  <AlertTriangle className="w-3 h-3" />
                  Overloaded ({workload.totalEstimatedHours}h)
                </div>
              )}

              {workload.overdueTasks.length > 0 && (
                <div className="mt-3 p-2 bg-red-50 rounded text-xs text-red-700">
                  {workload.overdueTasks.length} overdue task{workload.overdueTasks.length > 1 ? "s" : ""}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Agent Detail View
function AgentDetailView({ workload, epics, onBack }: {
  workload: any;
  epics: Epic[];
  onBack: () => void;
}) {
  const { agent, tasks } = workload;
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Apply filters to tasks
  const filteredTasks = tasks.filter((t: any) => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    if (filterStatus && t.status !== filterStatus) return false;
    return true;
  });

  // Group filtered tasks by status
  const tasksByStatus = {
    in_progress: filteredTasks.filter((t: any) => t.status === "in_progress"),
    backlog: filteredTasks.filter((t: any) => t.status === "backlog" || t.status === "ready"),
    review: filteredTasks.filter((t: any) => t.status === "review"),
    blocked: filteredTasks.filter((t: any) => t.status === "blocked"),
    done: filteredTasks.filter((t: any) => t.status === "done"),
  };

  return (
    <div className="max-w-6xl">
      <button onClick={onBack} className="btn btn-ghost mb-4">
        ← Back to Workload Overview
      </button>

      {/* Filter Row */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input flex-1 min-w-[180px]"
          aria-label="Search agent tasks"
        />
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="input w-32"
          aria-label="Filter by priority"
        >
          <option value="">All Priorities</option>
          <option value="P0">P0</option>
          <option value="P1">P1</option>
          <option value="P2">P2</option>
          <option value="P3">P3</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="input w-36"
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          <option value="backlog">Backlog</option>
          <option value="ready">Ready</option>
          <option value="in_progress">In Progress</option>
          <option value="review">Review</option>
          <option value="blocked">Blocked</option>
          <option value="done">Done</option>
        </select>
        {(search || filterPriority || filterStatus) && (
          <button
            onClick={() => {
              setSearch("");
              setFilterPriority("");
              setFilterStatus("");
            }}
            className="btn btn-ghost"
            aria-label="Clear all filters"
          >
            <X className="w-4 h-4" /> Clear
          </button>
        )}
      </div>

      {/* Profile Header */}
      <div className="card p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl text-white font-bold ${
            agent.level === "lead" ? "bg-blue-500" :
            agent.level === "specialist" ? "bg-slate-500" :
            "bg-amber-500"
          }`}>
            {agent.name[0]}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold">{agent.name}</h1>
              <span className={`badge ${
                agent.level === "lead" ? "badge-level-lead" :
                agent.level === "specialist" ? "badge-level-specialist" :
                "badge-level-intern"
              }`}>
                {agent.level}
              </span>
            </div>
            <p className="text-foreground/80">{agent.role}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {workload.assignedTasks} tasks assigned · {workload.totalEstimatedHours}h estimated · {workload.completedHours}h completed
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{Math.round(workload.utilization)}%</p>
            <p className="text-sm text-muted-foreground">utilization</p>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left: Task Lists */}
        <div className="col-span-2 space-y-4">
          {Object.entries(tasksByStatus).map(([status, tasks]: [string, any]) => 
            tasks.length > 0 && (
              <div key={status} className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <span className={`badge badge-status-${status}`}>
                      {status.replace("_", " ")}
                    </span>
                    <span className="text-muted-foreground">({tasks.length})</span>
                  </h3>
                </div>
                <div className="space-y-2">
                  {tasks.map((task: any) => (
                    <div key={task._id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {epics.find(e => e._id === task.epicId)?.title || "No epic"}
                          {task.dueDate && (
                            <span className="ml-2">
                              · Due {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {task.timeEstimate && (
                          <span className="badge bg-blue-100 text-blue-700 text-xs">
                            {task.timeEstimate}
                          </span>
                        )}
                        <span className={`badge badge-priority-${task.priority.toLowerCase()} text-xs`}>
                          {task.priority}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>

        {/* Right: Stats */}
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Task Distribution
            </h3>
            <div className="space-y-3">
              {Object.entries(tasksByStatus)
                .filter(([_, tasks]: [string, any]) => tasks.length > 0)
                .map(([status, tasks]: [string, any]) => (
                <div key={status} className="flex items-center gap-3">
                  <span className={`badge badge-status-${status} text-xs w-20`}>
                    {status.replace("_", " ")}
                  </span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full bg-${
                        status === "done" ? "green" :
                        status === "in_progress" ? "blue" :
                        status === "blocked" ? "amber" :
                        "slate"
                      }-500`}
                      style={{ width: `${(tasks.length / workload.assignedTasks) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm w-6 text-right">{tasks.length}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Priority Breakdown
            </h3>
            <div className="space-y-2">
              {["P0", "P1", "P2", "P3"].map(priority => {
                const count = workload.tasks.filter((t: any) => t.priority === priority).length;
                if (count === 0) return null;
                return (
                  <div key={priority} className="flex items-center justify-between">
                    <span className={`badge badge-priority-${priority.toLowerCase()}`}>{priority}</span>
                    <span className="text-sm font-medium">{count} tasks</span>
                  </div>
                );
              })}
            </div>
          </div>

          {workload.overdueTasks.length > 0 && (
            <div className="card p-4 border-red-300">
              <h3 className="font-semibold mb-2 flex items-center gap-2 text-red-600">
                <Calendar className="w-4 h-4" /> Overdue Tasks
              </h3>
              <div className="space-y-2">
                {workload.overdueTasks.map((task: any) => (
                  <div key={task._id} className="text-sm">
                    <p className="font-medium truncate">{task.title}</p>
                    <p className="text-xs text-red-600">
                      Due {new Date(task.dueDate).toLocaleDateString()} · {
                        Math.ceil((Date.now() - task.dueDate) / 86400000)
                      } days overdue
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { 
  label: string; 
  value: string | number; 
  icon: any; 
  color?: string;
}) {
  const colorClass = color === "green" ? "bg-green-100 text-green-700" :
                     color === "amber" ? "bg-amber-100 text-amber-700" :
                     color === "red" ? "bg-red-100 text-red-700" :
                     color === "orange" ? "bg-orange-100 text-orange-700" :
                     "bg-muted text-muted-foreground";

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
        <div className={`p-2 rounded-lg ${colorClass}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
