"use client";
import { useNotification } from "@/hooks/useNotification";
import { ModalWrapper } from "./Modal";

import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import {
  Shield, Briefcase, ExternalLink, History, Calendar,
  MessageSquare, PlusCircle, CheckCircle2, UserPlus, Clock,
  Target, AlertCircle, PenTool
} from "lucide-react";

interface Activity {
  _id: string;
  type: string;
  message: string;
  agentName?: string;
  createdAt: number;
}

interface AgentDetailModalProps {
  agent: {
    _id: string;
    name: string;
    role: string;
    status: string;
    sessionKey: string;
    lastHeartbeat: number;
  };
  levelBadge: { bg: string; text: string; label: string };
  tasks: any[];
  onClose: () => void;
}

const agentIcons: Record<string, any> = {
  Jarvis: Shield,
  Shuri: History,
  Fury: Briefcase,
  Vision: Shield,
  Loki: Shield,
  Quill: Shield,
  Wanda: Shield,
  Pepper: Shield,
  Friday: Shield,
  Wong: Shield,
};

const activityIcons: Record<string, any> = {
  task_created: PlusCircle,
  task_completed: CheckCircle2,
  task_assigned: UserPlus,
  task_updated: PenTool,
  message_sent: MessageSquare,
  comment_added: MessageSquare,
  mention: MessageSquare,
  task_status_changed: Clock,
  agent_claimed: CheckCircle2,
  epic_created: Target,
  epic_completed: CheckCircle2,
  migration: AlertCircle,
  task_deleted: AlertCircle,
};

export function AgentDetailModal({ agent, levelBadge, tasks, onClose }: AgentDetailModalProps) {
  const notif = useNotification();
  const router = useRouter();

  // Fetch agent activities
  const agentActivities = useQuery(api.migrations.getAgentActivities, {
    agentName: agent.name,
    limit: 30
  });

  const Icon = agentIcons[agent.name] || Shield;

  // Handle task click - navigate to board and highlight task
  const handleTaskClick = (taskId: string) => {
    const currentUrl = `/global/agents?agent=${agent._id}`;
    const returnUrl = encodeURIComponent(currentUrl);
    // Navigate to the first available workspace board with the task ID
    // Note: This opens the first business's board; ideally we'd know the task's business
    router.push(`?task=${taskId}`);
  };

  return (
    <ModalWrapper
      isOpen={true}
      onClose={onClose}
      title={agent.name}
      subtitle={agent.role}
      className="w-full max-w-3xl sm:max-h-[90vh] overflow-y-auto"
    >
      {/* Agent Icon and Badges - Custom Header Content */}
      <div className="px-6 pt-0 pb-2 flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground flex-shrink-0">
          <Icon className="w-7 h-7" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`badge ${levelBadge.bg} ${levelBadge.text}`}>
            {levelBadge.label}
          </span>
          <span className={`badge ${
            agent.status === "active" ? "badge-status-active" :
            agent.status === "blocked" ? "badge-status-blocked" :
            "badge-status-idle"
          }`}>
            {agent.status}
          </span>
        </div>
      </div>

      {/* Modal Content */}
      <div className="p-6 space-y-6">
          {/* Status Row - Dark Mode Compatible */}
          <div className="flex gap-4">
            <div className="flex-1 p-4 rounded-lg bg-muted">
              <p className="text-xs uppercase mb-1 text-muted-foreground">Status</p>
              <p className={`font-medium ${
                agent.status === "active" ? "text-success" :
                agent.status === "blocked" ? "text-warning" :
                "text-muted-foreground"
              }`}>
                {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
              </p>
            </div>
            <div className="flex-1 p-4 rounded-lg bg-muted">
              <p className="text-xs uppercase mb-1 text-muted-foreground">Session</p>
              <p className="font-mono text-sm truncate text-muted-foreground">{agent.sessionKey}</p>
            </div>
            <div className="flex-1 p-4 rounded-lg bg-muted">
              <p className="text-xs uppercase mb-1 text-muted-foreground">Last Active</p>
              <p className="font-medium text-sm text-foreground">
                {new Date(agent.lastHeartbeat).toLocaleTimeString()}
              </p>
            </div>
          </div>

          {/* Current Tasks - Dark Mode Compatible */}
          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2 text-foreground">
              <Briefcase className="w-4 h-4" />
              Assigned Tasks ({tasks.length})
            </h3>
            {tasks.length > 0 ? (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {tasks.map((task: any) => (
                  <button
                    key={task._id}
                    onClick={() => handleTaskClick(task._id)}
                    className="w-full flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors hover:opacity-80 bg-muted"
                    title="Click to view task on board"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`badge badge-priority-${task.priority.toLowerCase()} text-xs flex-shrink-0`}>
                        {task.priority}
                      </span>
                      <span className="text-sm truncate text-foreground">{task.title}</span>
                    </div>
                    <span className={`badge badge-status-${task.status} text-xs flex-shrink-0`}>
                      {task.status.replace("_", " ")}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm p-4 rounded-lg bg-muted text-muted-foreground">
                No tasks assigned to this agent
              </p>
            )}
          </div>

          {/* Activity Log - Dark Mode Compatible */}
          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2 text-foreground">
              <History className="w-4 h-4" />
              Recent Activity
              <span className="text-xs font-normal text-muted-foreground">
                ({agentActivities?.length || 0} entries)
              </span>
            </h3>
            <div className="rounded-lg p-4 max-h-60 overflow-y-auto bg-muted">
              {agentActivities && agentActivities.length > 0 ? (
                <div className="space-y-3">
                  {groupActivitiesByDate(agentActivities).map(([date, activities]) => (
                    <div key={date}>
                      {/* Date Header */}
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">{date}</span>
                      </div>
                      {/* Activities */}
                      <div className="space-y-2 ml-5">
                        {activities.map((activity: Activity) => {
                          const ActIcon = activityIcons[activity.type] || MessageSquare;
                          return (
                            <div key={activity._id} className="flex items-start gap-2 p-2 rounded-lg transition-colors hover:opacity-80 bg-surface">
                              <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-accent text-accent-foreground">
                                <ActIcon className="w-3 h-3" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm leading-snug text-foreground">
                                  {activity.message}
                                </p>
                                <p className="text-xs mt-1 text-muted-foreground">
                                  {new Date(activity.createdAt).toLocaleTimeString("en-GB", {
                                    hour: "2-digit",
                                    minute: "2-digit"
                                  })}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-center py-4 text-muted-foreground">
                  No recent activity for this agent
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <button
              onClick={() => notif.info(`Agent ${agent.name} workspace integration coming soon. Use OpenClaw CLI for direct agent interaction.`)}
              className="btn btn-primary flex-1 opacity-90"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Agent Workspace (Soon)
            </button>
          </div>
        </div>
    </ModalWrapper>
  );
}

// Helper to group activities by date
function groupActivitiesByDate(activities: Activity[]): [string, Activity[]][] {
  const groups: Record<string, Activity[]> = {};
  
  for (const activity of activities) {
    const date = new Date(activity.createdAt);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let dateLabel: string;
    if (date.toDateString() === today.toDateString()) {
      dateLabel = "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      dateLabel = "Yesterday";
    } else {
      dateLabel = date.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short"
      });
    }
    
    if (!groups[dateLabel]) groups[dateLabel] = [];
    groups[dateLabel].push(activity);
  }
  
  return Object.entries(groups).sort((a, b) => {
    const map: Record<string, number> = { "Today": 0, "Yesterday": 1 };
    const aVal = map[a[0]] ?? 2;
    const bVal = map[b[0]] ?? 2;
    return aVal - bVal;
  });
}
