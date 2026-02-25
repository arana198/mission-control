"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { X, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface LiveFeedPanelProps {
  isOpen: boolean;
  onClose: () => void;
  businessId?: string;
}

/**
 * LiveFeedPanel Component
 * Sliding right panel showing real-time activity stream
 * Powered by api.activities.getRecent
 */
export function LiveFeedPanel({ isOpen, onClose, businessId }: LiveFeedPanelProps) {
  const activities = useQuery(
    api.activities.getRecent,
    businessId ? { limit: 50, businessId: businessId as any } : { limit: 50 }
  );

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const ACTIVITY_ICONS: Record<string, string> = {
    task_created: "📋",
    task_updated: "✏️",
    task_completed: "✅",
    task_assigned: "👤",
    task_blocked: "🚫",
    comment_added: "💬",
    mention: "🔔",
    epic_created: "🗺️",
    epic_completed: "🏆",
    agent_claimed: "🤖",
    agent_status_changed: "🔄",
    dependency_added: "🔗",
    dependency_removed: "✂️",
    tags_updated: "🏷️",
    tasks_queried: "🔍",
  };

  const getActivityIcon = (type: string) => {
    return ACTIVITY_ICONS[type] || "⚡";
  };

  return (
    <>
      {/* Backdrop overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-overlay/20 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Live Feed Panel */}
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 h-full w-[520px] max-w-[96vw] transform border-l border-border bg-background shadow-2xl transition-transform duration-300",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-border px-6 py-4">
            <div className="flex items-start gap-3">
              <Activity className="mt-1 h-5 w-5 text-accent" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Live feed
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  Realtime task, approval, agent, and board-chat activity.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg border border-border p-2 text-muted-foreground transition hover:bg-muted"
              aria-label="Close live feed"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Scrollable feed */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {!activities ? (
              <p className="text-sm text-muted-foreground">Loading feed…</p>
            ) : activities.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  Waiting for new activity…
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activities.map((item: any) => (
                  <div
                    key={item._id}
                    className="flex gap-3 rounded-lg border border-border bg-muted/50 p-3 text-sm transition hover:bg-muted"
                  >
                    <span className="text-lg">{getActivityIcon(item.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {item.message}
                      </p>
                      {item.agentName && (
                        <p className="text-xs text-muted-foreground">
                          by {item.agentName}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        {formatTime(item._creationTime)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
