"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * Mission Control V2 - Agent Control Panel
 * Phase 1: Agent Registry + Execution Logging
 */
export default function ControlPage() {
  const summary = useQuery(api.dashboard.getDashboardSummary);
  const executions = useQuery(api.dashboard.getExecutions, { limit: 20 });
  const agents = useQuery(api.agents.getAllAgents);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Format tokens
  const formatTokens = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return n.toString();
  };

  // Format time ago
  const timeAgo = (ts: number) => {
    const secs = Math.floor((Date.now() - ts) / 1000);
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86400)}d ago`;
  };

  // Quick sync function (calls via button)
  const handleSync = async () => {
    setLastSync(new Date());
    // In full impl, would call sync script here
    window.location.reload();
  };

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "bold", margin: 0 }}>
            🎛️ Mission Control V2
          </h1>
          <p style={{ color: "#666", marginTop: "4px" }}>Agent Control Panel — Phase 1</p>
        </div>
        <button
          onClick={handleSync}
          style={{
            padding: "10px 20px",
            background: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          ↻ Sync Now
        </button>
      </header>

      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "32px" }}>
        <StatCard label="Total Agents" value={summary?.totalAgents ?? 0} color="#2563eb" />
        <StatCard label="Active" value={summary?.activeAgents ?? 0} color="#16a34a" />
        <StatCard label="Tokens Today" value={formatTokens(summary?.todayTokens ?? 0)} color="#9333ea" />
        <StatCard label="Success Rate" value={`${summary?.successRate ?? 0}%`} color={(summary?.successRate ?? 0) >= 80 ? "#16a34a" : "#dc2626"} />
      </div>

      {/* Agent Registry */}
      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "16px" }}>🤖 Agent Registry</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
          {agents?.map((agent: any) => (
            <div
              key={agent._id}
              style={{
                background: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                padding: "16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <h3 style={{ fontWeight: 600, margin: 0 }}>{agent.name}</h3>
                  <p style={{ color: "#666", fontSize: "14px", margin: "4px 0" }}>
                    {agent.role} • {agent.level}
                  </p>
                </div>
                <span
                  style={{
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    background: agent.status === "active" ? "#dcfce7" : "#f3f4f6",
                    color: agent.status === "active" ? "#16a34a" : "#666",
                  }}
                >
                  {agent.status}
                </span>
              </div>
              <div style={{ marginTop: "12px", fontSize: "13px", color: "#666" }}>
                <p>📁 {agent.workspacePath || "—"}</p>
                <p>🔑 Last heartbeat: {timeAgo(agent.lastHeartbeat)}</p>
              </div>
            </div>
          ))}
          {(!agents || agents.length === 0) && (
            <p style={{ color: "#666", gridColumn: "1 / -1" }}>No agents registered</p>
          )}
        </div>
      </section>

      {/* Execution History */}
      <section>
        <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "16px" }}>📊 Execution History</h2>
        <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 500 }}>Agent</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 500 }}>Trigger</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 500 }}>Status</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: 500 }}>Tokens</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: 500 }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {executions?.slice(0, 10).map((ex: any) => (
                <tr key={ex._id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "12px 16px" }}>{ex.agentName}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ 
                      padding: "2px 8px", 
                      borderRadius: "4px", 
                      fontSize: "12px",
                      background: ex.triggerType === "cron" ? "#fef3c7" : ex.triggerType === "autonomous" ? "#dbeafe" : "#f3f4f6"
                    }}>
                      {ex.triggerType}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ 
                      color: ex.status === "success" ? "#16a34a" : ex.status === "failed" ? "#dc2626" : "#666"
                    }}>
                      {ex.status}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "monospace" }}>
                    {formatTokens(ex.totalTokens || 0)}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: "#666" }}>
                    {timeAgo(ex.startTime)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!executions || executions.length === 0) && (
            <p style={{ padding: "24px", textAlign: "center", color: "#666" }}>No executions yet</p>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{
      background: "white",
      border: "1px solid #e5e7eb",
      borderRadius: "12px",
      padding: "20px",
    }}>
      <p style={{ color: "#666", fontSize: "14px", margin: "0 0 8px 0" }}>{label}</p>
      <p style={{ fontSize: "28px", fontWeight: "bold", margin: 0, color }}>{value}</p>
    </div>
  );
}