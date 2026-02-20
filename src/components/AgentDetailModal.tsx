"use client";
import { useNotification } from "@/hooks/useNotification";

import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../convex/_generated/api";
import { 
  Shield, X, Briefcase, ExternalLink, History, Calendar,
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
    // Navigate to the first available business board with the task ID
    // Note: This opens the first business's board; ideally we'd know the task's business
    router.push(`?task=${taskId}`);
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div 
        className="relative card w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-[var(--border)] flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white">
              <Icon className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>{agent.name}</h2>
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
              <p style={{ color: "var(--muted-foreground)" }}>{agent.role}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-[var(--muted)] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" style={{ color: "var(--foreground)" }} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6" style={{ background: "var(--background)" }}>
          {/* Status Row - Dark Mode Compatible */}
          <div className="flex gap-4">
            <div className="flex-1 p-4 rounded-lg" style={{ background: "var(--muted)" }}>
              <p className="text-xs uppercase mb-1" style={{ color: "var(--muted-foreground)" }}>Status</p>
              <p className={`font-medium ${
                agent.status === "active" ? "text-[var(--success)]" :
                agent.status === "blocked" ? "text-[var(--warning)]" :
                "text-[var(--muted-foreground)]"
              }`}>
                {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
              </p>
            </div>
            <div className="flex-1 p-4 rounded-lg" style={{ background: "var(--muted)" }}>
              <p className="text-xs uppercase mb-1" style={{ color: "var(--muted-foreground)" }}>Session</p>
              <p className="font-mono text-sm truncate" style={{ color: "var(--muted-foreground)" }}>{agent.sessionKey}</p>
            </div>
            <div className="flex-1 p-4 rounded-lg" style={{ background: "var(--muted)" }}>
              <p className="text-xs uppercase mb-1" style={{ color: "var(--muted-foreground)" }}>Last Active</p>
              <p className="font-medium text-sm" style={{ color: "var(--foreground)" }}>
                {new Date(agent.lastHeartbeat).toLocaleTimeString()}
              </p>
            </div>
          </div>

          {/* Current Tasks - Dark Mode Compatible */}
          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
              <Briefcase className="w-4 h-4" />
              Assigned Tasks ({tasks.length})
            </h3>
            {tasks.length > 0 ? (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {tasks.map((task: any) => (
                  <button
                    key={task._id}
                    onClick={() => handleTaskClick(task._id)}
                    className="w-full flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors hover:opacity-80"
                    style={{ background: "var(--muted)" }}
                    title="Click to view task on board"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`badge badge-priority-${task.priority.toLowerCase()} text-xs flex-shrink-0`}>
                        {task.priority}
                      </span>
                      <span className="text-sm truncate" style={{ color: "var(--foreground)" }}>{task.title}</span>
                    </div>
                    <span className={`badge badge-status-${task.status} text-xs flex-shrink-0`}>
                      {task.status.replace("_", " ")}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm p-4 rounded-lg" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
                No tasks assigned to this agent
              </p>
            )}
          </div>

          {/* Activity Log - Dark Mode Compatible */}
          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
              <History className="w-4 h-4" />
              Recent Activity
              <span className="text-xs font-normal" style={{ color: "var(--muted-foreground)" }}>
                ({agentActivities?.length || 0} entries)
              </span>
            </h3>
            <div className="rounded-lg p-4 max-h-60 overflow-y-auto" style={{ background: "var(--muted)" }}>
              {agentActivities && agentActivities.length > 0 ? (
                <div className="space-y-3">
                  {groupActivitiesByDate(agentActivities).map(([date, activities]) => (
                    <div key={date}>
                      {/* Date Header */}
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-3 h-3" style={{ color: "var(--muted-foreground)" }} />
                        <span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>{date}</span>
                      </div>
                      {/* Activities */}
                      <div className="space-y-2 ml-5">
                        {activities.map((activity: Activity) => {
                          const ActIcon = activityIcons[activity.type] || MessageSquare;
                          return (
                            <div key={activity._id} className="flex items-start gap-2 p-2 rounded-lg transition-colors hover:opacity-80" style={{ background: "var(--surface)" }}>
                              <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}>
                                <ActIcon className="w-3 h-3" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm leading-snug" style={{ color: "var(--foreground)" }}>
                                  {activity.message}
                                </p>
                                <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
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
                <p className="text-sm text-center py-4" style={{ color: "var(--muted-foreground)" }}>
                  No recent activity for this agent
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
            <button 
              onClick={() => notif.info(`Agent ${agent.name} workspace integration coming soon. Use OpenClaw CLI for direct agent interaction.`)}
              className="btn btn-primary flex-1 opacity-90"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Agent Workspace (Soon)
            </button>
          </div>
        </div>
      </div>
    </div>
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
