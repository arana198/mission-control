"use client";

import React, { useState, useEffect } from "react";
import { MessageSquare, ChevronDown, ChevronUp, Send, RefreshCw } from "lucide-react";
import { GatewaySession } from "@/hooks/useGatewaySessions";

/**
 * History entry structure
 */
interface HistoryEntry {
  type: "sent" | "received";
  content: string;
  timestamp: number;
}

/**
 * Status badge configuration
 * Maps session status to UI colors and text
 */
const STATUS_CONFIG = {
  active: {
    badge: "bg-success/20 text-success/70",
    label: "Active",
    infoClass: "text-success/70",
    infoLabel: "Connected",
  },
  idle: {
    badge: "bg-amber-500/20 text-amber-500/70",
    label: "Idle",
    infoClass: "text-amber-500/70",
    infoLabel: "Idle",
  },
  inactive: {
    badge: "bg-muted text-muted-foreground",
    label: "Inactive",
    infoClass: "text-muted-foreground",
    infoLabel: "Disconnected",
  },
} as const;

/**
 * Gateway Sessions Panel Component
 * Phase 4 UI: View and interact with gateway sessions
 */
interface GatewaySessionsPanelProps {
  gatewayId: string;
  sessions?: GatewaySession[];
  isLoading?: boolean;
  error?: string | null;
  isHealthy?: boolean;
  lastHealthCheck?: number | null;
  onSendMessage?: (sessionKey: string, message: string) => Promise<void>;
  onFetchHistory?: (sessionKey: string) => Promise<HistoryEntry[]>;
  onRefresh?: () => void;
}

export function GatewaySessionsPanel({
  gatewayId,
  sessions = [],
  isLoading = false,
  error = null,
  isHealthy = undefined,
  lastHealthCheck = null,
  onSendMessage,
  onFetchHistory,
  onRefresh,
}: GatewaySessionsPanelProps) {
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [messageInputs, setMessageInputs] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<Record<string, HistoryEntry[]>>({});
  const [loadingHistory, setLoadingHistory] = useState<Record<string, boolean>>({});

  // Fetch history when session is expanded
  useEffect(() => {
    if (expandedSession && onFetchHistory && !history[expandedSession]) {
      setLoadingHistory((prev) => ({ ...prev, [expandedSession]: true }));
      onFetchHistory(expandedSession)
        .then((entries) => {
          setHistory((prev) => ({ ...prev, [expandedSession]: entries }));
        })
        .catch((err) => {
          console.error("Failed to fetch history:", err);
          setHistory((prev) => ({ ...prev, [expandedSession]: [] }));
        })
        .finally(() => {
          setLoadingHistory((prev) => ({ ...prev, [expandedSession]: false }));
        });
    }
  }, [expandedSession, onFetchHistory, history]);

  const handleSendMessage = async (sessionKey: string) => {
    const message = messageInputs[sessionKey]?.trim();
    if (!message || !onSendMessage) return;

    try {
      await onSendMessage(sessionKey, message);
      setMessageInputs((prev) => ({ ...prev, [sessionKey]: "" }));

      // Add sent message to history
      setHistory((prev) => ({
        ...prev,
        [sessionKey]: [
          ...(prev[sessionKey] || []),
          {
            type: "sent",
            content: message,
            timestamp: Date.now(),
          },
        ],
      }));
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const timeAgo = (ts: number) => {
    const secs = Math.floor((Date.now() - ts) / 1000);
    if (secs < 60) return `${secs}s`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m`;
    return `${Math.floor(secs / 3600)}h`;
  };

  return (
    <div className="space-y-4">
      {/* Error Banner */}
      {error && (
        <div className="bg-destructive/20 border border-destructive/70 rounded p-4 text-destructive/70 text-sm">
          Error: {error}
        </div>
      )}

      <div>
        {/* Header with Title and Refresh Button */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Active Sessions</h3>
            {lastHealthCheck && (
              <p className="text-xs text-muted-foreground mt-1">
                Last checked {timeAgo(lastHealthCheck)} ago
                {isHealthy !== undefined && (
                  <span className={isHealthy ? " · 🟢 Healthy" : " · 🔴 Unhealthy"} />
                )}
              </p>
            )}
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 text-primary/70 hover:text-primary/60 hover:bg-primary/20 rounded transition-colors"
              title="Refresh sessions"
            >
              <RefreshCw size={18} />
            </button>
          )}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="bg-card rounded-lg p-8 text-center text-muted-foreground">
            <div className="animate-spin inline-block mr-2">⟳</div>
            Loading sessions...
          </div>
        )}

        {/* No Sessions */}
        {!isLoading && sessions.length === 0 && (
          <div className="bg-card rounded-lg p-8 text-center text-muted-foreground">
            No active sessions
          </div>
        )}

        {/* Sessions List */}
        {!isLoading && sessions.length > 0 && (
          <div className="space-y-2">
            {sessions.map((session) => (
              <div key={session.key} className="border border-border rounded-lg overflow-hidden">
                {/* Session Header */}
                <button
                  onClick={() =>
                    setExpandedSession(expandedSession === session.key ? null : session.key)
                  }
                  className="w-full px-4 py-3 bg-surface hover:bg-surface/80 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 text-left">
                    <MessageSquare className="w-5 h-5 text-primary/70" />
                    <div>
                      <div className="font-medium text-white">{session.label || session.key}</div>
                      <div className="text-xs text-muted-foreground">{session.key}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {(() => {
                      const cfg = STATUS_CONFIG[session.status ?? "active"];
                      return (
                        <span className={`px-2 py-1 ${cfg.badge} text-xs rounded`}>
                          {cfg.label}
                        </span>
                      );
                    })()}
                    {expandedSession === session.key ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Session Content */}
                {expandedSession === session.key && (
                  <div className="bg-background p-4 space-y-4 border-t border-border">
                    {/* Message History */}
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground mb-2">Message History</h4>
                      <div className="bg-card rounded h-48 p-3 overflow-y-auto space-y-2 border border-border mb-3">
                        {loadingHistory[session.key] && (
                          <div className="text-center text-muted-foreground text-sm py-8">
                            Loading messages...
                          </div>
                        )}
                        {!loadingHistory[session.key] && (!history[session.key] || history[session.key].length === 0) && (
                          <div className="text-center text-muted-foreground text-sm py-8">
                            No messages yet. Send a message to start.
                          </div>
                        )}
                        {history[session.key]?.map((msg, idx) => (
                          <div
                            key={idx}
                            className={`text-sm p-2 rounded ${
                              msg.type === "sent"
                                ? "bg-primary/20 text-primary/80 ml-8 border-l-2 border-primary/50"
                                : "bg-muted text-muted-foreground mr-8 border-l-2 border-muted-foreground/30"
                            }`}
                          >
                            <div className="text-xs text-muted-foreground mb-1">{timeAgo(msg.timestamp)}</div>
                            <div>{msg.content}</div>
                          </div>
                        ))}
                      </div>

                      {/* Message Input */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Type message..."
                          value={messageInputs[session.key] || ""}
                          onChange={(e) =>
                            setMessageInputs((prev) => ({
                              ...prev,
                              [session.key]: e.target.value,
                            }))
                          }
                          onKeyPress={(e) => {
                            if (e.key === "Enter") {
                              handleSendMessage(session.key);
                            }
                          }}
                          className="flex-1 px-3 py-2 bg-card border border-border rounded text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary text-sm"
                        />
                        <button
                          onClick={() => handleSendMessage(session.key)}
                          disabled={!messageInputs[session.key]?.trim()}
                          className="px-4 py-2 bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground rounded font-medium transition-colors flex items-center gap-2"
                        >
                          <Send size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Session Info */}
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border text-sm">
                      <div>
                        <div className="text-muted-foreground">Last Activity</div>
                        <div className="text-white font-medium">
                          {session.lastActivity ? timeAgo(session.lastActivity) : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Status</div>
                        {(() => {
                          const cfg = STATUS_CONFIG[session.status ?? "active"];
                          return (
                            <div className={`${cfg.infoClass} font-medium`}>
                              {cfg.infoLabel}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
