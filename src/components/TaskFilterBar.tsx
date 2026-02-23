"use client";

import { AlertCircle, X, User, CheckCircle2 } from "lucide-react";
import { Agent } from "@/types/agent";
import { Epic } from "@/types/epic";

interface TaskFilterBarProps {
  searchQuery: string;
  filterPriority: string;
  filterAssignee: string;
  filterEpic: string;
  showBlockedOnly: boolean;
  quickFilter?: string | null;
  onQuickFilterChange?: (filter: string | null) => void;
  agents: Agent[];
  epics: Epic[];
  onSearchChange: (value: string) => void;
  onPriorityChange: (value: string) => void;
  onAssigneeChange: (value: string) => void;
  onEpicChange: (value: string) => void;
  onBlockedToggle: () => void;
  onClearFilters: () => void;
  hasFilters: boolean;
}

export function TaskFilterBar({
  searchQuery,
  filterPriority,
  filterAssignee,
  filterEpic,
  showBlockedOnly,
  quickFilter,
  onQuickFilterChange,
  agents,
  epics,
  onSearchChange,
  onPriorityChange,
  onAssigneeChange,
  onEpicChange,
  onBlockedToggle,
  onClearFilters,
  hasFilters,
}: TaskFilterBarProps) {
  const quickFilterPills = [
    { id: "my_tasks", label: "My Tasks", icon: User },
    { id: "ready", label: "Ready", icon: CheckCircle2 },
    { id: "blocked", label: "Blocked", icon: AlertCircle },
  ];

  return (
    <div className="card p-4 mb-4 space-y-3">
      {/* Quick Filter Pills */}
      <div className="flex items-center gap-2">
        {quickFilterPills.map((pill) => (
          <button
            key={pill.id}
            onClick={() =>
              onQuickFilterChange?.(
                quickFilter === pill.id ? null : pill.id
              )
            }
            className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition-colors ${
              quickFilter === pill.id
                ? "bg-accent text-accent-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            title={`Filter by ${pill.label}`}
          >
            <pill.icon className="w-3.5 h-3.5" />
            {pill.label}
          </button>
        ))}
      </div>

      {/* Search and Advanced Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="input"
            aria-label="Search tasks by title or description"
          />
        </div>

        <select
          value={filterPriority}
          onChange={(e) => onPriorityChange(e.target.value)}
          className="input w-32"
          aria-label="Filter tasks by priority level"
        >
          <option value="">All Priorities</option>
          <option value="P0">P0</option>
          <option value="P1">P1</option>
          <option value="P2">P2</option>
          <option value="P3">P3</option>
        </select>

        <select
          value={filterAssignee}
          onChange={(e) => onAssigneeChange(e.target.value)}
          className="input w-40"
          aria-label="Filter tasks by assigned agent"
        >
          <option value="">All Assignees</option>
          <option value="unassigned">Unassigned</option>
          {agents.map((agent) => (
            <option key={agent._id} value={agent._id}>
              {agent.name}
            </option>
          ))}
        </select>

        <select
          value={filterEpic}
          onChange={(e) => onEpicChange(e.target.value)}
          className="input w-40"
          aria-label="Filter tasks by epic"
        >
          <option value="">All Epics</option>
          <option value="none">No Epic</option>
          {epics.map((epic) => (
            <option key={epic._id} value={epic._id}>
              {epic.name || epic.title}
            </option>
          ))}
        </select>

        <button
          onClick={onBlockedToggle}
          className={`btn ${
            showBlockedOnly ? "btn-primary" : "btn-secondary"
          }`}
        >
          <AlertCircle className="w-4 h-4" />
          Blocked Only
        </button>

        {hasFilters && (
          <button onClick={onClearFilters} className="btn btn-ghost">
            <X className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
