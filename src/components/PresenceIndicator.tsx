"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Agent } from "@/types/agent";
import { useState, useEffect } from "react";
import {
  Circle,
  Clock,
  Wifi,
  WifiOff,
  MoreVertical,
  LogOut,
} from "lucide-react";

/**
 * Status badge with color indicator
 */
function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<
    string,
    { bg: string; text: string; icon: string; label: string }
  > = {
    online: {
      bg: "bg-success/10",
      text: "text-success",
      icon: "🟢",
      label: "Online",
    },
    away: {
      bg: "bg-warning/10",
      text: "text-warning",
      icon: "🟡",
      label: "Away",
    },
    do_not_disturb: {
      bg: "bg-destructive/10",
      text: "text-destructive",
      icon: "🔴",
      label: "Do Not Disturb",
    },
    offline: {
      bg: "bg-muted/10",
      text: "text-muted-foreground",
      icon: "⚪",
      label: "Offline",
    },
  };

  const config = statusConfig[status] || statusConfig.offline;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
    >
      <span>{config.icon}</span>
      {config.label}
    </span>
  );
}

/**
 * PresenceIndicator - Shows single agent's status with activity
 * Used in agent cards, task assignments, mentions
 */
export function PresenceIndicator({
  agentId,
  showActivity = false,
}: {
  agentId: string;
  showActivity?: boolean;
}) {
  const presence = useQuery(api.presence.getAgentPresence, {
    agentId: agentId as any,
  });

  if (!presence) {
    return (
      <div className="flex items-center gap-2">
        <Circle className="w-3 h-3 fill-muted-foreground text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Offline</span>
      </div>
    );
  }

  const colorMap: Record<string, string> = {
    online: "fill-success text-success",
    away: "fill-warning text-warning",
    do_not_disturb: "fill-destructive text-destructive",
    offline: "fill-muted-foreground text-muted-foreground",
  };

  return (
    <div className="flex items-center gap-2">
      <Circle className={`w-3 h-3 ${colorMap[presence.status] || colorMap.offline}`} />
      <span className="text-xs text-muted-foreground capitalize">
        {presence.status.replace("_", " ")}
      </span>
      {showActivity && presence.currentActivity && (
        <span className="text-xs text-muted-foreground ml-1 italic">
          — {presence.currentActivity}
        </span>
      )}
    </div>
  );
}

/**
 * PresenceList - Shows all agents for a business with online/away status
 * Used in agent roster, team overview
 */
export function PresenceList({
  businessId,
  agents,
  filter = "all",
}: {
  businessId: string;
  agents: Agent[];
  filter?: "online" | "away" | "offline" | "all";
}) {
  const allPresence = useQuery(api.presence.getBusinessPresence, {
    businessId: businessId as any,
  });

  const presenceMap = new Map(
    (allPresence || []).map((p) => [p.agentId as string, p])
  );

  const filteredAgents = agents.filter((agent) => {
    if (filter === "all") return true;
    const presence = presenceMap.get(agent._id as string);
    if (!presence) return filter === "offline";
    return presence.status === filter;
  });

  if (filteredAgents.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No agents {filter !== "all" ? `are ${filter}` : ""}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filteredAgents.map((agent) => {
        const presence = presenceMap.get(agent._id as string);

        return (
          <div
            key={agent._id}
            className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                {agent.name[0]}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{agent.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {agent.role}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              {presence && (
                <div className="text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <Circle
                      className={`w-2 h-2 fill-current ${
                        {
                          online: "text-success",
                          away: "text-warning",
                          do_not_disturb: "text-destructive",
                          offline: "text-muted-foreground/50",
                        }[presence.status] || "text-muted-foreground/50"
                      }`}
                    />
                    <span className="text-xs font-medium capitalize">
                      {presence.status.replace("_", " ")}
                    </span>
                  </div>
                  {presence.currentActivity && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {presence.currentActivity}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * CurrentUserPresence - Dropdown to set own status and activity
 * Used in top navigation or user menu
 */
export function CurrentUserPresence({
  businessId,
  agentId,
  agentName,
}: {
  businessId: string;
  agentId: string;
  agentName: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activity, setActivity] = useState("");
  const presence = useQuery(api.presence.getAgentPresence, {
    agentId: agentId as any,
  });
  const updatePresence = useMutation(api.presence.updatePresence);

  const currentStatus = presence?.status || "offline";

  const statuses = [
    { value: "online", label: "Online", icon: "🟢" },
    { value: "away", label: "Away", icon: "🟡" },
    { value: "do_not_disturb", label: "Do Not Disturb", icon: "🔴" },
    { value: "offline", label: "Offline", icon: "⚪" },
  ];

  const handleStatusChange = async (status: string) => {
    await updatePresence({
      businessId: businessId as any,
      agentId: agentId as any,
      status: status as any,
      currentActivity: activity || undefined,
    });
    setIsOpen(false);
  };

  const handleActivityChange = async (e: React.FormEvent) => {
    e.preventDefault();
    await updatePresence({
      businessId: businessId as any,
      agentId: agentId as any,
      status: currentStatus as any,
      currentActivity: activity || undefined,
    });
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors"
      >
        <Circle
          className={`w-3 h-3 fill-current ${
            {
              online: "text-success",
              away: "text-warning",
              do_not_disturb: "text-destructive",
              offline: "text-muted-foreground/50",
            }[currentStatus] || "text-muted-foreground/50"
          }`}
        />
        <span className="text-sm capitalize hidden sm:inline">
          {currentStatus.replace("_", " ")}
        </span>
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-card rounded-lg shadow-lg border p-4 z-50">
          {/* Status Selection */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              STATUS
            </p>
            <div className="space-y-1">
              {statuses.map((status) => (
                <button
                  key={status.value}
                  onClick={() => handleStatusChange(status.value)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${
                    currentStatus === status.value
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted"
                  }`}
                >
                  <span>{status.icon}</span>
                  {status.label}
                </button>
              ))}
            </div>
          </div>

          {/* Activity Input */}
          <div className="border-t pt-4">
            <form onSubmit={handleActivityChange}>
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                WHAT ARE YOU WORKING ON?
              </p>
              <input
                type="text"
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
                placeholder={presence?.currentActivity || "Task name..."}
                className="w-full px-3 py-2 border rounded-md text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="submit"
                className="w-full px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Update Activity
              </button>
            </form>
          </div>

          {/* Sign Out (Optional) */}
          <div className="border-t mt-4 pt-4">
            <button
              onClick={async () => {
                await updatePresence({
                  businessId: businessId as any,
                  agentId: agentId as any,
                  status: "offline",
                  currentActivity: undefined,
                });
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-2 rounded-md text-sm text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Go Offline
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
