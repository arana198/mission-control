"use client";

import { Task } from "@/types/task";

interface DependencyGraphProps {
  task: Task;
  allTasks: Task[];
  onTaskClick: (task: Task) => void;
}

const STATUS_COLORS: Record<string, string> = {
  done: "bg-success/10 border-success/30 text-success",
  blocked: "bg-warning/10 border-warning/30 text-warning",
  in_progress: "bg-primary/10 border-primary/30 text-primary",
  ready: "bg-muted/10 border-muted/30 text-muted-foreground",
  review: "bg-accent/10 border-accent/30 text-accent",
};

const STATUS_DOT_COLORS: Record<string, string> = {
  done: "bg-success",
  blocked: "bg-warning",
  in_progress: "bg-primary",
  ready: "bg-muted-foreground",
  review: "bg-accent",
};

/**
 * Dependency Graph Component
 * Visualizes task blocking relationships with SVG
 */
export function DependencyGraph({
  task,
  allTasks,
  onTaskClick,
}: DependencyGraphProps) {
  // Check if task has dependencies
  const blockerIds = task.blockedBy || [];
  const blockingIds = task.blocks || [];

  if (blockerIds.length === 0 && blockingIds.length === 0) {
    return null; // No dependencies, don't render
  }

  // Resolve blocker tasks
  const blockers = blockerIds
    .map((id) => allTasks.find((t) => t._id === id))
    .filter(Boolean) as Task[];

  // Resolve blocking tasks
  const blockedTasks = blockingIds
    .map((id) => allTasks.find((t) => t._id === id))
    .filter(Boolean) as Task[];

  // Limit to 3 per side
  const maxNodes = 3;
  const blockerDisplay = blockers.slice(0, maxNodes);
  const blockedDisplay = blockedTasks.slice(0, maxNodes);
  const blockerOverflow = blockers.length - blockerDisplay.length;
  const blockedOverflow = blockedTasks.length - blockedDisplay.length;

  // Fixed row height for coordinate calculation
  const rowHeight = 48;

  // Helper to render a single node
  const renderNode = (nodeTask: Task, onClick: () => void) => {
    const taskNumber = nodeTask._id.toString().slice(-3);
    const shortTitle = nodeTask.title.substring(0, 20);
    const colorClasses = STATUS_COLORS[(nodeTask.status as any) || 'ready'] || STATUS_COLORS.ready;
    const dotColor = STATUS_DOT_COLORS[(nodeTask.status as any) || 'ready'] || STATUS_DOT_COLORS.ready;

    return (
      <button
        key={nodeTask._id}
        onClick={onClick}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-transform hover:scale-105 cursor-pointer whitespace-nowrap text-sm ${colorClasses}`}
        title={nodeTask.title}
      >
        <span className="font-bold text-xs">{taskNumber}</span>
        <span className="flex-1 text-left">{shortTitle}</span>
        <div className={`w-2 h-2 rounded-full ${dotColor} flex-shrink-0`} />
      </button>
    );
  };

  // Calculate SVG line coordinates
  const getLineCoordinates = (
    fromColumn: "left" | "center" | "right",
    fromIndex: number,
    toColumn: "left" | "center" | "right",
    toIndex: number
  ) => {
    const columnX: Record<string, number> = {
      left: 80,
      center: 280,
      right: 480,
    };

    const fromY = fromIndex * rowHeight + rowHeight / 2;
    const toY = toIndex * rowHeight + rowHeight / 2;

    return {
      x1: columnX[fromColumn],
      y1: fromY,
      x2: columnX[toColumn],
      y2: toY,
    };
  };

  return (
    <div className="space-y-4">
      {/* Title */}
      <h4 className="text-sm font-semibold text-muted-foreground">
        Dependencies
      </h4>

      {/* SVG and Node Layout */}
      <div className="relative pt-2">
        {/* SVG for connector lines */}
        <svg
          className="absolute inset-0 w-full pointer-events-none overflow-visible"
          style={{ height: `${Math.max(blockerDisplay.length, blockedDisplay.length) * rowHeight}px` }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 10 3, 0 6" fill="currentColor" className="text-muted-foreground" />
            </marker>
          </defs>

          {/* Lines from blockers to main task */}
          {blockerDisplay.map((blocker, index) => {
            const coords = getLineCoordinates("left", index, "center", 0);
            return (
              <line
                key={`blocker-line-${blocker._id}`}
                x1={coords.x1}
                y1={coords.y1}
                x2={coords.x2}
                y2={coords.y2}
                stroke="currentColor"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
                className="text-muted-foreground/50"
              />
            );
          })}

          {/* Lines from main task to blocking tasks */}
          {blockedDisplay.map((blocked, index) => {
            const coords = getLineCoordinates("center", 0, "right", index);
            return (
              <line
                key={`blocked-line-${blocked._id}`}
                x1={coords.x1}
                y1={coords.y1}
                x2={coords.x2}
                y2={coords.y2}
                stroke="currentColor"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
                className="text-muted-foreground/50"
              />
            );
          })}
        </svg>

        {/* Node Grid */}
        <div className="grid grid-cols-3 gap-8 pt-2">
          {/* Left Column: Blockers */}
          <div className="flex flex-col gap-3 items-start">
            {blockerDisplay.length > 0 && (
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Blocked by
              </p>
            )}
            <div className="space-y-3 w-full">
              {blockerDisplay.map((blocker) =>
                renderNode(blocker, () => onTaskClick(blocker))
              )}
              {blockerOverflow > 0 && (
                <div className="px-3 py-2 rounded-lg bg-muted text-muted-foreground text-xs font-medium">
                  +{blockerOverflow} more
                </div>
              )}
            </div>
          </div>

          {/* Center Column: Main Task */}
          <div className="flex flex-col gap-3 items-center justify-start">
            <p className="text-xs font-medium text-muted-foreground">This task</p>
            {renderNode(task, () => {
              /* No-op, can't click self */
            })}
          </div>

          {/* Right Column: Blocked Tasks */}
          <div className="flex flex-col gap-3 items-end">
            {blockedDisplay.length > 0 && (
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Blocks
              </p>
            )}
            <div className="space-y-3 w-full">
              {blockedDisplay.map((blocked) =>
                renderNode(blocked, () => onTaskClick(blocked))
              )}
              {blockedOverflow > 0 && (
                <div className="px-3 py-2 rounded-lg bg-muted text-muted-foreground text-xs font-medium text-right">
                  +{blockedOverflow} more
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
