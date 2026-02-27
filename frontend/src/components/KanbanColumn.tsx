"use client";

import { useMemo, useRef } from "react";
import { Task } from "@/types/task";
import { Agent } from "@/types/agent";
import { Epic } from "@/types/epic";
import { isOverdue, isDueSoon } from "@/lib/taskUtils";
import {
  AlertCircle,
  Calendar,
  ListTodo,
  Briefcase,
  LucideIcon,
} from "lucide-react";
import {
  getPriorityBadgeClass,
  getTimeEstimateBadgeClass,
} from "./Badge";
import { memo, useCallback } from "react";

interface KanbanColumnProps {
  column: {
    id: string;
    label: string;
    icon: LucideIcon;
  };
  tasks: Task[];
  agents: Agent[];
  epics: Epic[];
  bulkMode: boolean;
  selectedTasks: Set<string>;
  isDragOver: boolean;
  onTaskClick: (task: Task) => void;
  onTaskSelect: (taskId: string, e: React.MouseEvent<HTMLInputElement>) => void;
  onDragStart: (task: Task) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, status: string) => void;
  draggedTaskId?: string;
  presenceMap?: Map<string, string>;
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
  draggedTaskId,
  presenceMap,
}: KanbanColumnProps) {
  const Icon = column.icon;
  const taskRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Keyboard navigation handler for Arrow Up/Down between tasks
  const handleTaskKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>, index: number) => {
      if (tasks.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          const nextIndex = Math.min(index + 1, tasks.length - 1);
          taskRefs.current[nextIndex]?.focus();
          break;

        case "ArrowUp":
          e.preventDefault();
          const prevIndex = Math.max(index - 1, 0);
          taskRefs.current[prevIndex]?.focus();
          break;

        case "Enter":
        case " ":
          e.preventDefault();
          if (!bulkMode) {
            onTaskClick(tasks[index]);
          } else {
            // In bulk mode, Space toggles checkbox
            const checkboxEvent = new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              view: window,
            });
            const checkbox = (e.target as HTMLDivElement).querySelector("input[type='checkbox']");
            checkbox?.dispatchEvent(checkboxEvent);
          }
          break;

        default:
          break;
      }
    },
    [tasks, bulkMode, onTaskClick]
  );

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
          isDragOver ? "bg-primary/10" : ""
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
          tasks.map((task, index) => (
            <div
              key={task._id}
              ref={(el) => {
                if (el) taskRefs.current[index] = el;
              }}
              draggable={!bulkMode}
              onDragStart={() => !bulkMode && onDragStart(task)}
              onClick={() => !bulkMode && onTaskClick(task)}
              onKeyDown={(e) => handleTaskKeyDown(e, index)}
              className={`card p-3 cursor-pointer hover:shadow-md transition-all relative focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary ${
                task._id === draggedTaskId ? "opacity-50 scale-95" : ""
              }`}
              role="button"
              tabIndex={0}
              aria-label={`Task: ${task.title}. Priority: ${task.priority}. Status: ${task.status}. ${bulkMode ? "Press Space to select or Enter to open." : "Press Enter to open or arrow keys to navigate."}`}
              aria-describedby={task.blockedBy && task.blockedBy.length > 0 ? `blocked-${task._id}` : undefined}
            >
              {bulkMode && (
                <div className="absolute top-2 right-2">
                  <input
                    type="checkbox"
                    checked={selectedTasks.has(task._id)}
                    onChange={() => {}}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTaskSelect(task._id, e);
                    }}
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
                {/* Ticket number - like Jira */}
                {task.ticketNumber && (
                  <div className="text-xs font-semibold text-muted-foreground">
                    {task.ticketNumber}
                  </div>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  {task.blockedBy && task.blockedBy.length > 0 && (
                    <span className="badge bg-destructive/10 text-destructive">
                      <AlertCircle className="w-3 h-3" />
                      Blocked
                    </span>
                  )}
                  {task.priority && (
                    <span className={getPriorityBadgeClass(task.priority)}>
                      {task.priority}
                    </span>
                  )}
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
                      const presenceStatus = presenceMap?.get(agentId);
                      const dotColor = {
                        online: "bg-success",
                        away: "bg-warning",
                        do_not_disturb: "bg-destructive",
                        offline: "bg-muted-foreground",
                      }[presenceStatus ?? "offline"] ?? "bg-muted-foreground";

                      return agent ? (
                        <span
                          key={agentId}
                          className="relative text-xs"
                          title={`${agent.name}: ${presenceStatus ?? "offline"}`}
                        >
                          {agent.emoji}
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${dotColor}`}
                          />
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
                        ? "text-destructive font-medium"
                        : isDueSoon(task.dueDate)
                          ? "text-warning font-medium"
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
          <div className="py-4 border-2 border-dashed border-primary/50 rounded-lg text-center text-sm text-primary">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

export const KanbanColumn = memo(KanbanColumnComponent);
