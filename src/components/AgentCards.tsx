"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { GlassCard } from "./ui/GlassCard";
import { CardGridSkeleton } from "./LoadingSkeletons";
import {
  Bot,
  Cpu,
  Eye,
  Feather,
  FileText,
  Flame,
  Mail,
  PenTool,
  Search,
  Shield,
  Sparkles,
  Zap,
  User,
} from "lucide-react";

const agentIcons: Record<string, React.ReactNode> = {
  Jarvis: <Shield className="w-4 h-4" />,
  Shuri: <Search className="w-4 h-4" />,
  Fury: <Flame className="w-4 h-4" />,
  Vision: <Eye className="w-4 h-4" />,
  Loki: <Feather className="w-4 h-4" />,
  Quill: <PenTool className="w-4 h-4" />,
  Wanda: <Sparkles className="w-4 h-4" />,
  Pepper: <Mail className="w-4 h-4" />,
  Friday: <Cpu className="w-4 h-4" />,
  Wong: <FileText className="w-4 h-4" />,
};

const statusConfig = {
  idle: {
    color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    dot: "bg-amber-400",
    label: "Idle",
  },
  active: {
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    dot: "bg-emerald-400",
    label: "Active",
  },
  blocked: {
    color: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    dot: "bg-rose-400",
    label: "Blocked",
  },
};

interface AgentCardsProps {
  compact?: boolean;
}

export function AgentCards({ compact = false }: AgentCardsProps) {
  const agents = useQuery(api.agents.getAllAgents);

  if (!agents) {
    return compact ? (
      <GlassCard className="p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-slate-700 rounded w-20" />
          <div className="h-3 bg-slate-700 rounded" />
        </div>
      </GlassCard>
    ) : (
      <CardGridSkeleton />
    );
  }

  if (compact) {
    return (
      <GlassCard className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-white">Agents</h3>
          <span className="text-xs text-slate-500">
            {agents.filter((a) => a.status === "active").length} active
          </span>
        </div>
        <div className="space-y-2">
          {agents.slice(0, 5).map((agent) => {
            const status = statusConfig[agent.status as keyof typeof statusConfig] || statusConfig.idle;
            const icon = agentIcons[agent.name] || <User className="w-4 h-4" />;
            return (
              <div key={agent._id} className="flex items-center gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                <div className="p-1.5 rounded bg-violet-500/20 text-violet-400">
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{agent.name}</p>
                  <p className="text-xs text-slate-500 truncate">{agent.role}</p>
                </div>
                <div className={`px-2 py-0.5 rounded-full text-xs border ${status.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full inline-block mr-1 ${status.dot}`} />
                  {status.label}
                </div>
              </div>
            );
          })}
          {agents.length > 5 && (
            <p className="text-xs text-slate-500 text-center pt-1">
              +{agents.length - 5} more agents
            </p>
          )}
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Your Squad</h2>
        <p className="text-sm text-slate-500">
          {agents.filter((a) => a.status === "active").length} of {agents.length} active
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {agents.map((agent) => {
          const status = statusConfig[agent.status as keyof typeof statusConfig] || statusConfig.idle;
          const icon = agentIcons[agent.name] || <Bot className="w-4 h-4" />;

          return (
            <div
              key={agent._id}
              className={`p-4 rounded-xl border transition-all hover:scale-[1.01] cursor-pointer ${status.color}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 rounded-lg bg-black/20 text-white/80">
                  {icon}
                </div>
                <span className={`w-2 h-2 rounded-full ${status.dot}`} />
              </div>
              <h3 className="font-medium text-slate-200">{agent.name}</h3>
              <p className="text-xs text-slate-500">{agent.role}</p>
              {agent.currentTaskId && (
                <p className="text-xs text-slate-600 mt-2 pt-2 border-t border-white/5">
                  Working on task...
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
