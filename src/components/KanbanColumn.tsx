"use client";

import { useMemo } from "react";
import { Task } from "@/types/task";
import { isOverdue, isDueSoon } from "@/lib/taskUtils";
import {
  AlertCircle,
  Calendar,
  ListTodo,
  Briefcase,
} from "lucide-react";
import {
  getPriorityBadgeClass,
  getTimeEstimateBadgeClass,
} from "./Badge";
import { memo } from "react";

interface KanbanColumnProps {
  column: {
    id: string;
    label: string;
    icon: any;
  };
  tasks: Task[];
  agents: any[];
  epics: any[];
  bulkMode: boolean;
  selectedTasks: Set<string>;
  isDragOver: boolean;
  onTaskClick: (task: Task) => void;
  onTaskSelect: (taskId: string) => void;
  onDragStart: (task: Task) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, status: string) => void;
}

function KanbanColumnComponent({
  column,
  tasks,
  agents,
  epics,
  bulkMode,
  selectedTasks,
  isDragOver,
  onTaskClick,
  onTaskSelect,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: KanbanColumnProps) {
  const Icon = column.icon;

  return (
    <div className="flex flex-col min-h-[600px]">
      <div className="flex items-center gap-2 mb-3 px-1">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h3 className="font-medium text-sm">{column.label}</h3>
        <span className="ml-auto text-xs text-muted-foreground">
          {tasks.length}
        </span>
      </div>

      <div
        className={`flex-1 space-y-2 min-h-[200px] rounded-lg p-2 transition-colors ${
          isDragOver ? "bg-blue-50 dark:bg-blue-900/20" : ""
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, column.id)}
        role="region"
        aria-label={`${column.label} tasks`}
      >
        {tasks.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No tasks
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task._id}
              draggable={!bulkMode}
              onDragStart={() => !bulkMode && onDragStart(task)}
              onClick={() => !bulkMode && onTaskClick(task)}
              className="card p-3 cursor-pointer hover:shadow-md transition-all relative"
              role="button"
              tabIndex={0}
              onKeyPress={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (!bulkMode) onTaskClick(task);
                }
              }}
              aria-label={`Task: ${task.title}. Priority: ${task.priority}. Status: ${task.status}`}
              aria-describedby={task.blockedBy && task.blockedBy.length > 0 ? `blocked-${task._id}` : undefined}
            >
              {bulkMode && (
                <div className="absolute top-2 right-2">
                  <input
                    type="checkbox"
                    checked={selectedTasks.has(task._id)}
                    onChange={() => onTaskSelect(task._id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4"
                    aria-label={`Select task: ${task.title}`}
                  />
                </div>
              )}
              {task.blockedBy && task.blockedBy.length > 0 && (
                <span id={`blocked-${task._id}`} className="sr-only">
                  This task is blocked by {task.blockedBy.length} other task(s)
                </span>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {task.blockedBy && task.blockedBy.length > 0 && (
                    <span className="badge bg-red-100 text-red-700">
                      <AlertCircle className="w-3 h-3" />
                      Blocked
                    </span>
                  )}
                  <span className={getPriorityBadgeClass(task.priority)}>
                    {task.priority}
                  </span>
                  {task.timeEstimate && (
                    <span className={getTimeEstimateBadgeClass(
                      task.timeEstimate
                    )}>
                      {task.timeEstimate}
                    </span>
                  )}
                </div>

                <h4 className="font-medium text-sm line-clamp-2">
                  {task.title}
                </h4>

                {task.epicId && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Briefcase className="w-3 h-3" />
                    <span>
                      {epics.find((e) => e._id === task.epicId)?.name ||
                        "Unknown Epic"}
                    </span>
                  </div>
                )}

                {task.assigneeIds && task.assigneeIds.length > 0 && (
                  <div className="flex items-center gap-1">
                    {task.assigneeIds.slice(0, 3).map((agentId: string) => {
                      const agent = agents.find((a) => a._id === agentId);
                      return agent ? (
                        <span key={agentId} className="text-xs">
                          {agent.emoji}
                        </span>
                      ) : null;
                    })}
                    {task.assigneeIds.length > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{task.assigneeIds.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {task.dueDate && (
                  <div
                    className={`flex items-center gap-1 text-xs ${
                      isOverdue(task.dueDate)
                        ? "text-red-600 font-medium"
                        : isDueSoon(task.dueDate)
                          ? "text-orange-600 font-medium"
                          : "text-muted-foreground"
                    }`}
                  >
                    <Calendar className="w-3 h-3" />
                    <span>
                      {new Date(task.dueDate).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {task.subtaskIds && task.subtaskIds.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ListTodo className="w-3 h-3" />
                    <span>{task.subtaskIds.length} subtasks</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {isDragOver && (
          <div className="py-4 border-2 border-dashed border-blue-400 rounded-lg text-center text-sm text-blue-600">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

export const KanbanColumn = memo(KanbanColumnComponent);
