"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useMemo } from "react";
import { Task } from "@/types/task";
import { Agent } from "@/types/agent";
import { Epic } from "@/types/epic";
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Inbox,
} from "lucide-react";
import { TaskDetailModal } from "./TaskDetailModal";

interface AgentInboxProps {
  agents: Agent[];
  workspaceId: string;
}

interface InboxData {
  myTasks: Task[];
  ready: Task[];
  blocked: Task[];
  inReview: Task[];
  done: Task[];
  summary: {
    totalTasks: number;
    inProgress: number;
    readyCount: number;
    blockedCount: number;
    inReviewCount: number;
    completedCount: number;
  };
}

/**
 * Agent Inbox Component
 * Personal task view organized by status with agent selector
 */
export function AgentInbox({ agents, workspaceId }: AgentInboxProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string>(agents[0]?._id || "");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Fetch inbox data for selected agent
  const inboxData = useQuery(
    api.tasks.getInboxForAgent,
    selectedAgentId && workspaceId ? { workspaceId: workspaceId as any, agentId: selectedAgentId as any } : "skip"
  );

  // Fetch all required data for task detail modal
  const allTasks = useQuery(api.tasks.getFiltered,
    selectedAgentId && workspaceId ? { workspaceId: workspaceId as any, agentId: selectedAgentId as any } : "skip"
  );
  const allAgents = useQuery(api.agents.getAllAgents);
  const allEpics = useQuery(api.epics.getAllEpics,
    workspaceId ? { workspaceId: workspaceId as any } : "skip"
  );

  const selectedAgent = useMemo(
    () => agents.find((a) => a._id === selectedAgentId),
    [agents, selectedAgentId]
  );

  if (!workspaceId) {
    return (
      <div className="p-6 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
          <Inbox className="w-6 h-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No  Selected</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          Select a workspace from the filter dropdown to view your inbox.
        </p>
      </div>
    );
  }

  if (!agents || agents.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
          <Inbox className="w-6 h-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No Agents</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          No agents are registered in this workspace yet.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      {/* Agent Selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground">View inbox for:</label>
        <select
          value={selectedAgentId}
          onChange={(e) => setSelectedAgentId(e.target.value)}
          className="px-3 py-2 rounded-md border border-input bg-background text-foreground"
        >
          {agents.map((agent) => (
            <option key={agent._id} value={agent._id}>
              {agent.name} ({agent.role})
            </option>
          ))}
        </select>
      </div>

      {/* Summary Stats */}
      {inboxData && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="card p-3">
            <div className="text-2xl font-bold text-accent">
              {inboxData.summary.totalTasks}
            </div>
            <div className="text-xs text-muted-foreground">Total Tasks</div>
          </div>
          <div className="card p-3">
            <div className="text-2xl font-bold text-primary">
              {inboxData.summary.inProgress}
            </div>
            <div className="text-xs text-muted-foreground">In Progress</div>
          </div>
          <div className="card p-3">
            <div className="text-2xl font-bold text-success">
              {inboxData.summary.readyCount}
            </div>
            <div className="text-xs text-muted-foreground">Ready</div>
          </div>
          <div className="card p-3">
            <div className="text-2xl font-bold text-warning">
              {inboxData.summary.blockedCount}
            </div>
            <div className="text-xs text-muted-foreground">Blocked</div>
          </div>
          <div className="card p-3">
            <div className="text-2xl font-bold text-accent">
              {inboxData.summary.inReviewCount}
            </div>
            <div className="text-xs text-muted-foreground">In Review</div>
          </div>
        </div>
      )}

      {/* Inbox Sections */}
      {inboxData ? (
        <div className="space-y-4">
          <InboxSection
            title="In Progress"
            icon={Clock}
            color="blue"
            tasks={inboxData.myTasks}
            onTaskClick={setSelectedTask}
            defaultOpen={true}
          />
          <InboxSection
            title="Ready"
            icon={CheckCircle2}
            color="green"
            tasks={inboxData.ready}
            onTaskClick={setSelectedTask}
            defaultOpen={true}
          />
          <InboxSection
            title="Blocked"
            icon={AlertTriangle}
            color="amber"
            tasks={inboxData.blocked}
            onTaskClick={setSelectedTask}
            defaultOpen={true}
          />
          <InboxSection
            title="In Review"
            icon={Eye}
            color="purple"
            tasks={inboxData.inReview}
            onTaskClick={setSelectedTask}
            defaultOpen={false}
          />
          <InboxSection
            title="Completed"
            icon={CheckCircle2}
            color="gray"
            tasks={inboxData.done}
            onTaskClick={setSelectedTask}
            defaultOpen={false}
          />
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">Loading inbox...</div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          agents={allAgents || []}
          epics={allEpics || []}
          tasks={allTasks || []}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}

/**
 * Collapsible inbox section for each status
 */
function InboxSection({
  title,
  icon: Icon,
  color,
  tasks,
  onTaskClick,
  defaultOpen = true,
}: {
  title: string;
  icon: any;
  color: string;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const colorClasses = {
    blue: "bg-primary/10 text-primary border-primary/30",
    green: "bg-success/10 text-success border-success/30",
    amber: "bg-warning/10 text-warning border-warning/30",
    purple: "bg-accent/10 text-accent border-accent/30",
    gray: "bg-muted/10 text-muted-foreground border-border",
  };

  return (
    <div className="card">
      {/* Section Header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5" />
          <span className="font-semibold">{title}</span>
          <span className={`inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-medium ${colorClasses[color as keyof typeof colorClasses]}`}>
            {tasks.length}
          </span>
        </div>
        {open ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* Section Content */}
      {open && (
        <div className="border-t px-4 py-3 space-y-2">
          {tasks.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              No tasks here
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task._id}
                onClick={() => onTaskClick(task)}
                className="p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors border border-transparent hover:border-border"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-1 rounded">
                        {task.title?.substring(0, 3).toUpperCase() || "TASK"}
                      </span>
                      <span className="text-xs font-medium px-2 py-1 rounded bg-primary/10 text-primary">
                        {task.priority || "P2"}
                      </span>
                    </div>
                    <h4 className="font-medium text-sm mb-1 truncate">
                      {task.title}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {task.description}
                    </p>
                  </div>
                  {task.blockedBy && task.blockedBy.length > 0 && (
                    <div className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded bg-warning/10 text-warning text-xs font-medium">
                      <AlertTriangle className="w-3 h-3" />
                      {task.blockedBy.length}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
