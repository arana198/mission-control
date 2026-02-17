"use client";

import { 
  MessageSquare, CheckCircle2, PlusCircle, 
  UserPlus, AlertCircle, Clock, Target,
  CheckSquare, Send, AtSign, PenTool, Calendar,
  MoreHorizontal, Filter, Activity, TrendingUp, Zap
} from "lucide-react";
import { useState } from "react";

interface ActivityItem {
  _id: string;
  type: string;
  message: string;
  agentName?: string;
  agentRole?: string;
  taskTitle?: string;
  createdAt: number;
}

const activityIcons: Record<string, any> = {
  task_created: PlusCircle,
  task_completed: CheckCircle2,
  task_assigned: UserPlus,
  task_updated: PenTool,
  message_sent: MessageSquare,
  comment_added: Send,
  mention: AtSign,
  task_status_changed: Clock,
  agent_claimed: CheckSquare,
  epic_created: Target,
  epic_completed: CheckCircle2,
  migration: AlertCircle,
  task_deleted: AlertCircle,
};

const activityTypeLabels: Record<string, string> = {
  task_created: "Task Created",
  task_completed: "Task Completed", 
  task_assigned: "Task Assigned",
  task_updated: "Task Updated",
  message_sent: "Message Sent",
  comment_added: "Comment Added",
  mention: "Mention",
  task_status_changed: "Status Changed",
  agent_claimed: "Agent Claimed",
  epic_created: "Epic Created",
  epic_completed: "Epic Completed",
  migration: "Migration",
  task_deleted: "Task Deleted",
};

export function ActivityFeed({ activities }: { activities: ActivityItem[] }) {
  const [filter, setFilter] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<string>("all");

  // Filter activities by type and time
  const filteredActivities = activities.filter(activity => {
    if (filter && activity.type !== filter) return false;
    
    if (timeFilter !== "all") {
      const now = new Date();
      const activityDate = new Date(activity.createdAt);
      const diffHours = (now.getTime() - activityDate.getTime()) / (1000 * 60 * 60);
      
      switch (timeFilter) {
        case "1h": return diffHours <= 1;
        case "24h": return diffHours <= 24;
        case "7d": return diffHours <= 168;
        default: return true;
      }
    }
    
    return true;
  });

  // Group activities by date
  const grouped = groupByDate(filteredActivities);
  
  if (!activities || activities.length === 0) {
    return (
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold">Activity Feed</h2>
            <p className="text-muted-foreground">
              Real-time updates from your AI agent squad
            </p>
          </div>
        </div>
        
        <div className="card p-16 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ background: "var(--muted)" }}>
            <Activity className="w-8 h-8" style={{ color: "var(--muted-foreground)" }} />
          </div>
          <h3 className="text-xl font-semibold mb-3">No Activity Yet</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            As your AI agents work on tasks, create epics, and collaborate, their activities will appear here in real-time.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      {/* Header with Stats */}
      <div className="mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-semibold mb-1">Activity Feed</h2>
            <p className="text-muted-foreground">
              {filteredActivities.length} of {activities.length} activities • Live updates
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5" style={{ color: "var(--accent)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--accent)" }}>Live</span>
          </div>
        </div>

        {/* Activity Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{activities.filter(a => a.type === 'task_created').length}</p>
                <p className="text-xs text-muted-foreground">Tasks Created</p>
              </div>
              <PlusCircle className="w-5 h-5" style={{ color: "rgba(59, 130, 246, 0.7)" }} />
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{activities.filter(a => a.type === 'task_completed').length}</p>
                <p className="text-xs text-muted-foreground">Tasks Completed</p>
              </div>
              <CheckCircle2 className="w-5 h-5" style={{ color: "rgba(34, 197, 94, 0.7)" }} />
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{activities.filter(a => a.type === 'comment_added').length}</p>
                <p className="text-xs text-muted-foreground">Comments</p>
              </div>
              <Send className="w-5 h-5" style={{ color: "rgba(245, 158, 11, 0.7)" }} />
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{new Set(activities.map(a => a.agentName)).size}</p>
                <p className="text-xs text-muted-foreground">Active Agents</p>
              </div>
              <TrendingUp className="w-5 h-5" style={{ color: "rgba(168, 85, 247, 0.7)" }} />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 p-4 rounded-lg" style={{ background: "var(--muted)" }}>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
            <span className="text-sm font-medium">Filters:</span>
          </div>
          
          {/* Activity Type Filter */}
          <select 
            value={filter || ""}
            onChange={(e) => setFilter(e.target.value || null)}
            className="input-sm"
          >
            <option value="">All Activities</option>
            {Object.entries(activityTypeLabels).map(([type, label]) => (
              <option key={type} value={type}>{label}</option>
            ))}
          </select>
          
          {/* Time Filter */}
          <select 
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="input-sm"
          >
            <option value="all">All Time</option>
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
          </select>
          
          {/* Clear Filters */}
          {(filter || timeFilter !== "all") && (
            <button 
              onClick={() => { setFilter(null); setTimeFilter("all"); }}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="space-y-8">
        {grouped.map(([date, dayActivities]) => (
          <div key={date} className="relative">
            {/* Date Header */}
            <div className="sticky top-0 z-10 flex items-center gap-4 mb-6 py-2" style={{ background: "var(--background)" }}>
              <div className="flex items-center gap-3">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center border-2"
                  style={{ 
                    background: "var(--background)",
                    borderColor: "var(--accent)",
                    color: "var(--accent)"
                  }}
                >
                  <Calendar className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-semibold">{formatDateFull(date)}</h3>
              </div>
              <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
              <span className="text-sm px-3 py-1 rounded-full" style={{ 
                background: "var(--muted)",
                color: "var(--muted-foreground)"
              }}>
                {dayActivities.length} activities
              </span>
            </div>

            {/* Activity items */}
            <div className="space-y-3">
              {dayActivities.map((activity: ActivityItem) => (
                <ActivityRow key={activity._id} activity={activity} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      {filteredActivities.length === 0 && activities.length > 0 && (
        <div className="card p-8 text-center mt-8">
          <Filter className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--muted-foreground)" }} />
          <h3 className="font-semibold mb-2">No activities match your filters</h3>
          <p className="text-muted-foreground mb-4">Try adjusting your filter criteria to see more results.</p>
          <button 
            onClick={() => { setFilter(null); setTimeFilter("all"); }}
            className="btn btn-secondary"
          >
            Clear All Filters
          </button>
        </div>
      )}
    </div>
  );
}

function ActivityRow({ activity }: { activity: ActivityItem }) {
  const Icon = activityIcons[activity.type] || MessageSquare;
  
  return (
    <div className="group relative">
      {/* Timeline line connector */}
      <div 
        className="absolute left-6 top-12 w-px h-6 opacity-20"
        style={{ background: "var(--border)" }}
      />
      
      <div className="flex items-start gap-4 p-4 rounded-lg group-hover:opacity-90 transition-all" style={{ background: "var(--surface)" }}>
        {/* Icon */}
        <div 
          className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ 
            background: "var(--accent)",
            color: "var(--accent-foreground)"
          }}
        >
          <Icon className="w-5 h-5" />
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-1">
            <div>
              <p className="text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>
                {activity.message}
              </p>
              {activity.taskTitle && (
                <div className="flex items-center gap-2 mt-2">
                  <span 
                    className="text-xs px-2 py-1 rounded"
                    style={{ 
                      background: "rgba(59, 130, 246, 0.1)",
                      color: "var(--accent)"
                    }}
                  >
                    {activity.taskTitle}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                {new Date(activity.createdAt).toLocaleTimeString("en-GB", { 
                  hour: "2-digit", 
                  minute: "2-digit" 
                })}
              </span>
            </div>
          </div>
          
          {activity.agentName && (
            <div className="flex items-center gap-2 mt-2">
              <div 
                className="w-4 h-4 rounded-full flex items-center justify-center text-[10px]"
                style={{ 
                  background: "var(--accent)",
                  color: "var(--accent-foreground)"
                }}
              >
                {activity.agentName[0]}
              </div>
              <span className="text-xs font-medium" style={{ color: "var(--accent)" }}>
                {activity.agentName}
              </span>
              {activity.agentRole && (
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  • {activity.agentRole}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Group activities by date
function groupByDate(activities: ActivityItem[]) {
  const groups: Record<string, ActivityItem[]> = {};
  
  for (const activity of activities) {
    const date = new Date(activity.createdAt).toDateString();
    if (!groups[date]) groups[date] = [];
    groups[date].push(activity);
  }
  
  return Object.entries(groups).sort((a, b) => 
    new Date(b[0]).getTime() - new Date(a[0]).getTime()
  );
}

// Format helpers
function formatDateFull(dateStr: string) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) {
    return "Today";
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }
  
  return date.toLocaleDateString("en-GB", { 
    weekday: "long", 
    day: "numeric", 
    month: "long",
    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined
  });
}