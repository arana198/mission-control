"use client";

import { AlertCircle, X } from "lucide-react";

interface TaskFilterBarProps {
  searchQuery: string;
  filterPriority: string;
  filterAssignee: string;
  filterEpic: string;
  showBlockedOnly: boolean;
  agents: any[];
  epics: any[];
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
  return (
    <div className="card p-4 mb-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="input"
          />
        </div>

        <select
          value={filterPriority}
          onChange={(e) => onPriorityChange(e.target.value)}
          className="input w-32"
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
