"use client";
import { useNotification } from "@/hooks/useNotification";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "convex/react";
import { Task } from "@/types/task";
import { api } from "../../convex/_generated/api";
import {
  Shield, Search, Flame, Eye, Feather, PenTool,
  Sparkles, Mail, Cpu, FileText, Zap, Cog,
  CheckCircle, Activity, Users,
  MapPin, Briefcase, MessageSquare, ExternalLink, Folder, AlertCircle, Trash2
} from "lucide-react";
import { AgentDetailModal } from "./AgentDetailModal";
import { AgentWorkspaceModal } from "./AgentWorkspaceModal";

interface Agent {
  _id: string;
  name: string;
  role: string;
  status: "idle" | "active" | "blocked";
  level: "lead" | "specialist" | "intern";
  sessionKey: string;
  currentTaskId?: string;
  lastHeartbeat: number;
  personality?: string;
  capabilities?: string[];
}

const agentIcons: Record<string, any> = {
  Jarvis: Shield,
  Shuri: Search,
  Fury: Flame,
  Vision: Eye,
  Loki: Feather,
  Quill: PenTool,
  Wanda: Sparkles,
  Pepper: Mail,
  Friday: Cpu,
  Wong: FileText,
  Gus: Cog,
};

const levelBadges = {
  lead: { bg: "badge-level-lead", text: "text-[var(--accent)]", label: "Lead" },
  specialist: { bg: "badge-level-specialist", text: "text-[var(--muted-foreground)]", label: "Specialist" },
  intern: { bg: "badge-level-intern", text: "text-[var(--warning)]", label: "Intern" },
};

const agentDescriptions: Record<string, string> = {
  Jarvis: "Squad lead. Coordinates, makes decisions, your primary interface for team management.",
  Shuri: "Skeptical tester who finds edge cases and questions assumptions before code ships.",
  Fury: "Deep researcher who reads reviews and ensures every claim has documented receipts.",
  Vision: "SEO strategist who thinks in keywords and focuses on search intent optimization.",
  Loki: "Editorial perfectionist. Pro-Oxford comma, anti-passive voice, words matter deeply.",
  Quill: "Community builder with hooks and threads, build-in-public mindset for engagement.",
  Wanda: "Visual thinker who creates infographics, designs UI mockups, and shapes aesthetics.",
  Pepper: "Lifecycle email specialist, drip sequences where every word converts or gets cut.",
  Friday: "Clean code poet — tested, documented, and elegantly architected solutions.",
  Wong: "Documentation keeper who ensures nothing gets lost. Organized and methodical.",
  Gus: "Calm operations architect. Strategic planner obsessed with precision. Builds resilient systems that never panic under load—meticulous discipline in every execution.",
};

export function AgentSquad({ agents, tasks = [] }: { agents: Agent[]; tasks?: Task[] }) {
  const notif = useNotification();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [workspaceAgent, setWorkspaceAgent] = useState<Agent | null>(null);
  const [deletingAgent, setDeletingAgent] = useState<Agent | null>(null);
  const deleteAgentMutation = useMutation(api.agents.deleteAgent);

  // Load selected agent from URL on mount or when agents change
  useEffect(() => {
    const agentIdFromUrl = searchParams?.get('agent');
    if (agentIdFromUrl) {
      const agent = agents.find(a => a._id === agentIdFromUrl);
      if (agent) {
        setSelectedAgent(agent);
      }
    }
  }, [searchParams, agents]);

  // PERF: Phase 5C - Memoize sorted agents to prevent unnecessary re-renders
  const sortedAgents = useMemo(() => {
    return [...agents].sort((a, b) => {
      const levelOrder = { lead: 0, specialist: 1, intern: 2 };
      if (levelOrder[a.level] !== levelOrder[b.level]) {
        return levelOrder[a.level] - levelOrder[b.level];
      }
      return a.name.localeCompare(b.name);
    });
  }, [agents]);

  // PERF: Phase 5C - Memoize agent counts to prevent unnecessary recalculation
  const { leadCount, specialistCount, internCount, activeCount } = useMemo(() => ({
    leadCount: agents.filter(a => a.level === "lead").length,
    specialistCount: agents.filter(a => a.level === "specialist").length,
    internCount: agents.filter(a => a.level === "intern").length,
    activeCount: agents.filter(a => a.status === "active").length,
  }), [agents]);

  // PERF: Phase 5C - Memoize getAgentTasks function
  const getAgentTasks = useCallback((agentId: string) => {
    return tasks.filter(t => t.assigneeIds?.includes(agentId));
  }, [tasks]);

  // PERF: Phase 5C - Memoize handlers to prevent recreation on every render
  const handleSelectAgent = useCallback((agent: Agent) => {
    setSelectedAgent(agent);
    router.push(`/global/agents?agent=${agent._id}`);
  }, [router]);

  // Handle closing agent detail and clearing URL
  const handleCloseAgent = useCallback(() => {
    setSelectedAgent(null);
    router.push('/global/agents');
  }, [router]);

  // Handle agent deletion
  const handleDeleteAgent = useCallback(async () => {
    if (!deletingAgent) return;
    try {
      await deleteAgentMutation({ agentId: deletingAgent._id as any, deletedBy: "user" });
      notif.success(`Agent "${deletingAgent.name}" removed from squad`);
    } catch (error) {
      notif.error("Failed to delete agent");
    } finally {
      setDeletingAgent(null);
    }
  }, [deletingAgent, deleteAgentMutation, notif]);

  // Show empty state if no agents
  if (!agents || agents.length === 0) {
    return (
      <div className="max-w-6xl">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold">Your Squad</h2>
          <p className="text-muted-foreground">
            Manage and monitor your AI agent team
          </p>
        </div>

        <div className="card p-16 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center bg-muted">
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-3">No Agents Yet</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            Your agent squad appears to be empty. Register or invite agents to start building your autonomous team.
          </p>
          <button className="btn btn-primary">
            Register Agent
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      {/* Header Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-2xl font-bold">{agents.length}</p>
              <p className="text-muted-foreground text-sm">Total Agents</p>
            </div>
            <div className="p-2 rounded-lg" style={{ background: "rgba(37, 99, 235, 0.15)" }}>
              <Users className="w-5 h-5" style={{ color: "var(--accent)" }} />
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-2xl font-bold">{leadCount}</p>
              <p className="text-muted-foreground text-sm">Squad Leads</p>
            </div>
            <div className="p-2 rounded-lg" style={{ background: "rgba(37, 99, 235, 0.15)" }}>
              <Shield className="w-5 h-5" style={{ color: "var(--accent)" }} />
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-2xl font-bold">{specialistCount}</p>
              <p className="text-muted-foreground text-sm">Specialists</p>
            </div>
            <div className="p-2 rounded-lg" style={{ background: "var(--muted)" }}>
              <Briefcase className="w-5 h-5" style={{ color: "var(--muted-foreground)" }} />
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-2xl font-bold" style={{ color: "var(--success)" }}>{activeCount}</p>
              <p className="text-muted-foreground text-sm">Active Now</p>
            </div>
            <div className="p-2 rounded-lg" style={{ background: "rgba(34, 197, 94, 0.15)" }}>
              <Activity className="w-5 h-5" style={{ color: "var(--success)" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Lead Agent - Featured */}
      {sortedAgents.filter(a => a.level === "lead").map(agent => (
        <div key={agent._id} className="card p-6 mb-6 border-l-4 border-l-[var(--accent)]">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
              {(() => {
                const Icon = agentIcons[agent.name] || Shield;
                return <Icon className="w-8 h-8" />;
              })()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-xl font-bold">{agent.name}</h2>
                <span className={`badge ${levelBadges[agent.level].bg}`}>
                  {levelBadges[agent.level].label}
                </span>
                <span className={`badge ${
                  agent.status === "active" ? "badge-status-active" :
                  agent.status === "blocked" ? "badge-status-blocked" :
                  "badge-status-idle"
                }`}>
                  {agent.status}
                </span>
              </div>
              <p className="font-medium">{agent.role}</p>
              <p className="text-muted-foreground text-sm mt-2 max-w-2xl">
                {agentDescriptions[agent.name] || agent.personality || "Agent ready for assignments."}
              </p>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => handleSelectAgent(agent)}
                  className="btn btn-primary text-sm"
                >
                  View Profile
                </button>
                <button
                  onClick={() => setWorkspaceAgent(agent)}
                  className="btn btn-secondary text-sm"
                  title="View agent workspace files"
                >
                  <Folder className="w-4 h-4 mr-2" />
                  Workspace
                </button>
                <button
                  onClick={() => setDeletingAgent(agent)}
                  className="btn bg-red-600 hover:bg-red-700 text-white text-sm"
                  title="Remove agent from squad"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Specialists Grid */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
          <Users className="w-4 h-4" />
          Specialists ({specialistCount})
        </h3>
        <div className="grid grid-cols-3 gap-4">
          {sortedAgents.filter(a => a.level === "specialist").map(agent => (
            <AgentCard
              key={agent._id}
              agent={agent}
              onClick={() => handleSelectAgent(agent)}
              onDelete={() => setDeletingAgent(agent)}
            />
          ))}
        </div>
      </div>

      {/* Interns Grid */}
      {internCount > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Interns ({internCount})
          </h3>
          <div className="grid grid-cols-4 gap-4">
            {sortedAgents.filter(a => a.level === "intern").map(agent => (
              <AgentCard
                key={agent._id}
                agent={agent}
                onClick={() => handleSelectAgent(agent)}
                onDelete={() => setDeletingAgent(agent)}
                compact
              />
            ))}
          </div>
        </div>
      )}

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <AgentDetailModal
          agent={selectedAgent}
          levelBadge={levelBadges[selectedAgent.level]}
          tasks={getAgentTasks(selectedAgent._id)}
          onClose={handleCloseAgent}
        />
      )}

      {/* Agent Workspace Modal */}
      {workspaceAgent && (
        <AgentWorkspaceModal
          agentId={workspaceAgent._id}
          agentName={workspaceAgent.name}
          onClose={() => setWorkspaceAgent(null)}
        />
      )}

      {/* Delete Agent Modal */}
      {deletingAgent && (
        <DeleteAgentModal
          agent={deletingAgent}
          onConfirm={handleDeleteAgent}
          onClose={() => setDeletingAgent(null)}
        />
      )}
    </div>
  );
}

// Compact Agent Card
function AgentCard({ agent, onClick, onDelete, compact = false }: { agent: Agent; onClick: () => void; onDelete?: () => void; compact?: boolean }) {
  const levelBadge = levelBadges[agent.level];

  return (
    <div
      onClick={onClick}
      className={`card cursor-pointer hover:border-[var(--accent)] transition-all group relative ${compact ? "p-3" : "p-4"}`}
    >
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 rounded transition-all"
          aria-label={`Delete ${agent.name}`}
          type="button"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
      <div className="flex items-center gap-3">
        <div className={`rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-white ${compact ? "w-10 h-10" : "w-12 h-12"}`}>
          {(() => {
            const Icon = agentIcons[agent.name] || Shield;
            return <Icon className={compact ? "w-5 h-5" : "w-6 h-6"} />;
          })()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className={`font-semibold truncate ${compact ? "text-sm" : ""}`}>{agent.name}</h4>
            {!compact && (
              <span className={`badge text-xs ${levelBadge.bg}`}>
                {levelBadge.label}
              </span>
            )}
          </div>
          <p className={`text-muted-foreground truncate ${compact ? "text-xs" : "text-sm"}`}>
            {agent.role}
          </p>
        </div>
      </div>
      {!compact && (
        <div className="mt-3 pt-3 border-t flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
          <span className={`badge ${
            agent.status === "active" ? "badge-status-active" :
            agent.status === "blocked" ? "badge-status-blocked" :
            "badge-status-idle"
          } text-xs`}>
            {agent.status}
          </span>
          <span className="text-xs text-muted-foreground">
            {new Date(agent.lastHeartbeat).toLocaleDateString()}
          </span>
        </div>
      )}
    </div>
  );
}

// Delete Agent Confirmation Modal
function DeleteAgentModal({ agent, onConfirm, onClose }: {
  agent: Agent;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="card rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center gap-3 text-red-600 mb-4">
            <AlertCircle className="w-6 h-6" />
            <h2 className="text-lg font-semibold">Remove Agent</h2>
          </div>
          <p className="text-muted-foreground mb-2">
            Are you sure you want to remove <strong>{agent.name}</strong> from the squad?
          </p>
          {agent.status === "active" && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200 mb-4">
              ⚠️ This agent is currently <strong>active</strong>. Removing them will unassign all their tasks.
            </div>
          )}
          <p className="text-sm text-muted-foreground mb-6">
            This will unassign them from all tasks. This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
            <button
              onClick={handleConfirm}
              disabled={isDeleting}
              className="btn bg-red-600 hover:bg-red-700 text-white flex-1 disabled:opacity-50"
            >
              {isDeleting ? "Removing..." : "Remove Agent"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
