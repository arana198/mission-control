"use client";
import { useNotification } from "@/hooks/useNotification";

import { useState } from "react";
import { Task } from "@/types/task";
import { api } from "../../convex/_generated/api";
import { 
  Shield, Search, Flame, Eye, Feather, PenTool, 
  Sparkles, Mail, Cpu, FileText, Zap,
  CheckCircle, Activity, Users,
  MapPin, Briefcase, MessageSquare, ExternalLink
} from "lucide-react";
import { AgentDetailModal } from "./AgentDetailModal";

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
};

export function AgentSquad({ agents, tasks = [] }: { agents: Agent[]; tasks?: Task[] }) {
  const notif = useNotification();
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  // Sort: Lead first, then by level, then by name
  const sortedAgents = [...agents].sort((a, b) => {
    const levelOrder = { lead: 0, specialist: 1, intern: 2 };
    if (levelOrder[a.level] !== levelOrder[b.level]) {
      return levelOrder[a.level] - levelOrder[b.level];
    }
    return a.name.localeCompare(b.name);
  });

  const leadCount = agents.filter(a => a.level === "lead").length;
  const specialistCount = agents.filter(a => a.level === "specialist").length;
  const internCount = agents.filter(a => a.level === "intern").length;
  const activeCount = agents.filter(a => a.status === "active").length;

  // Get agent's current tasks
  const getAgentTasks = (agentId: string) => tasks.filter(t => t.assigneeIds?.includes(agentId));

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
                  onClick={() => setSelectedAgent(agent)}
                  className="btn btn-primary text-sm"
                >
                  View Profile
                </button>
                <button 
                  onClick={() => notif.info(`Agent ${agent.name} workspace integration coming soon. Use OpenClaw CLI to interact with this agent.`)}
                  className="btn btn-secondary text-sm opacity-75"
                  title="Agent workspace integration in development"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Workspace (Soon)
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
              onClick={() => setSelectedAgent(agent)}
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
                onClick={() => setSelectedAgent(agent)}
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
          onClose={() => setSelectedAgent(null)}
        />
      )}
    </div>
  );
}

// Compact Agent Card
function AgentCard({ agent, onClick, compact = false }: { agent: Agent; onClick: () => void; compact?: boolean }) {
  const levelBadge = levelBadges[agent.level];
  
  return (
    <div 
      onClick={onClick}
      className={`card cursor-pointer hover:border-[var(--accent)] transition-all group ${compact ? "p-3" : "p-4"}`}
    >
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
