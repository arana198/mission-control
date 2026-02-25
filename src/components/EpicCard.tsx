"use client";

import { memo } from "react";
import { CheckSquare, Users } from "lucide-react";

interface EpicCardProps {
  epic: {
    _id: string;
    name?: string;
    title?: string;
    description: string;
    status: string;
    progress: number;
  };
  tasks: any[];
  agents: any[];
  onClick: () => void;
}

function EpicCardComponent({ epic, tasks, agents, onClick }: EpicCardProps) {
  const epicTasks = tasks.filter((t) => t.epicId === epic._id);
  const completedTasks = epicTasks.filter((t) => t.status === "done").length;
  const totalTasks = epicTasks.length;
  const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const statusColors: Record<string, string> = {
    planning: "bg-muted text-muted-foreground",
    active: "bg-success/10 text-success",
    on_hold: "bg-warning/10 text-warning",
    completed: "bg-primary/10 text-primary",
  };

  const epicName = epic.name || epic.title || "Untitled Epic";

  return (
    <div
      onClick={onClick}
      className="card p-4 cursor-pointer hover:shadow-lg transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold mb-1 line-clamp-1">{epicName}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {epic.description}
          </p>
        </div>
        <span
          className={`badge ${statusColors[epic.status] || statusColors.planning}`}
        >
          {epic.status}
        </span>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>Progress</span>
          <span>{Math.round(progressPercent)}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1 text-muted-foreground">
          <CheckSquare className="w-4 h-4" />
          <span>
            {completedTasks}/{totalTasks}
          </span>
        </div>
        {agents.length > 0 && (
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4 text-muted-foreground" />
            <div className="flex -space-x-1">
              {agents.slice(0, 3).map((agent) => (
                <span key={agent._id} className="text-sm">
                  {agent.emoji}
                </span>
              ))}
              {agents.length > 3 && (
                <span className="text-xs text-muted-foreground ml-1">
                  +{agents.length - 3}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const EpicCard = memo(EpicCardComponent);
