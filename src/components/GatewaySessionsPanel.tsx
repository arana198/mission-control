"use client";

import { useState, useEffect } from "react";
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
        <div className="bg-red-900/20 border border-red-700 rounded p-4 text-red-300 text-sm">
          Error: {error}
        </div>
      )}

      <div>
        {/* Header with Title and Refresh Button */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Active Sessions</h3>
            {lastHealthCheck && (
              <p className="text-xs text-gray-400 mt-1">
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
              className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded transition-colors"
              title="Refresh sessions"
            >
              <RefreshCw size={18} />
            </button>
          )}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="bg-slate-800 rounded-lg p-8 text-center text-gray-400">
            <div className="animate-spin inline-block mr-2">⟳</div>
            Loading sessions...
          </div>
        )}

        {/* No Sessions */}
        {!isLoading && sessions.length === 0 && (
          <div className="bg-slate-800 rounded-lg p-8 text-center text-gray-400">
            No active sessions
          </div>
        )}

        {/* Sessions List */}
        {!isLoading && sessions.length > 0 && (
          <div className="space-y-2">
            {sessions.map((session) => (
              <div key={session.key} className="border border-slate-700 rounded-lg overflow-hidden">
                {/* Session Header */}
                <button
                  onClick={() =>
                    setExpandedSession(expandedSession === session.key ? null : session.key)
                  }
                  className="w-full px-4 py-3 bg-slate-900 hover:bg-slate-800 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 text-left">
                    <MessageSquare className="w-5 h-5 text-blue-400" />
                    <div>
                      <div className="font-medium text-white">{session.label || session.key}</div>
                      <div className="text-xs text-gray-500">{session.key}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-green-900/30 text-green-300 text-xs rounded">
                      Active
                    </span>
                    {expandedSession === session.key ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Session Content */}
                {expandedSession === session.key && (
                  <div className="bg-slate-950 p-4 space-y-4 border-t border-slate-700">
                    {/* Message History */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-300 mb-2">Message History</h4>
                      <div className="bg-slate-900 rounded h-48 p-3 overflow-y-auto space-y-2 border border-slate-700 mb-3">
                        {loadingHistory[session.key] && (
                          <div className="text-center text-gray-500 text-sm py-8">
                            Loading messages...
                          </div>
                        )}
                        {!loadingHistory[session.key] && (!history[session.key] || history[session.key].length === 0) && (
                          <div className="text-center text-gray-500 text-sm py-8">
                            No messages yet. Send a message to start.
                          </div>
                        )}
                        {history[session.key]?.map((msg, idx) => (
                          <div
                            key={idx}
                            className={`text-sm p-2 rounded ${
                              msg.type === "sent"
                                ? "bg-blue-900/30 text-blue-200 ml-8 border-l-2 border-blue-500"
                                : "bg-gray-900/30 text-gray-300 mr-8 border-l-2 border-gray-500"
                            }`}
                          >
                            <div className="text-xs text-gray-400 mb-1">{timeAgo(msg.timestamp)}</div>
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
                          className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                        />
                        <button
                          onClick={() => handleSendMessage(session.key)}
                          disabled={!messageInputs[session.key]?.trim()}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white rounded font-medium transition-colors flex items-center gap-2"
                        >
                          <Send size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Session Info */}
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700 text-sm">
                      <div>
                        <div className="text-gray-400">Last Activity</div>
                        <div className="text-white font-medium">
                          {session.lastActivity ? timeAgo(session.lastActivity) : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400">Status</div>
                        <div className="text-green-300 font-medium">Connected</div>
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
