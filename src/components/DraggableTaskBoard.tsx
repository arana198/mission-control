"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNotification } from "@/hooks/useNotification";
import { useSetState } from "@/hooks/useSetState";
import { Task } from "@/types/task";
import { Agent } from "@/types/agent";
import { Epic } from "@/types/epic";
import { useFilterPersistence, FilterState } from "@/hooks/useFilterPersistence";
import {
  CheckCircle2, AlertCircle, Clock3, Inbox, CheckCircle,
  AlertTriangle, Loader2
} from "lucide-react";
import { TaskFilterBar } from "./TaskFilterBar";
import { BulkActionBar } from "./BulkActionBar";
import { KanbanColumn } from "./KanbanColumn";
import { TaskDetailModal } from "./TaskDetailModal";

export const kanbanColumns = [
  { id: "backlog", label: "Backlog", icon: Inbox },
  { id: "ready", label: "Ready", icon: CheckCircle2 },
  { id: "in_progress", label: "In Progress", icon: Clock3 },
  { id: "review", label: "Review", icon: AlertCircle },
  { id: "blocked", label: "Blocked", icon: AlertTriangle },
  { id: "done", label: "Done", icon: CheckCircle },
] as const;

interface DraggableTaskBoardProps {
  tasks: Task[];
  agents: Agent[];
  epics?: Epic[];
  businessId?: string;
}

export function DraggableTaskBoard({ tasks, agents, epics = [], businessId }: DraggableTaskBoardProps) {
  const notif = useNotification();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Persist filter state to localStorage
  const [filters, filterSetters] = useFilterPersistence(
    "kanban-filters",
    {
      searchQuery: "",
      filterPriority: "",
      filterAssignee: "",
      filterEpic: "",
      filterStatus: "",
      showBlockedOnly: false,
    } as FilterState
  );

  // Quick filter state (mutually exclusive)
  const [quickFilter, setQuickFilter] = useState<string | null>(null);

  // Selection state for bulk actions - using centralized hook
  const { set: selectedTasks, toggle: toggleTaskSelection, addAll, clear: clearSelection } = useSetState<string>();

  // Wrapper to match BulkActionBar interface
  const selectAllVisible = () => addAll(filteredTasks.map(t => t._id));
  const [bulkMode, setBulkMode] = useState(false);

  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [draggedTask, setDraggedTask] = useState<any>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Load task from URL parameter if present (using ticketNumber)
  useEffect(() => {
    const ticketNumberFromUrl = searchParams?.get('task');
    if (ticketNumberFromUrl) {
      const task = tasks.find(t => t.ticketNumber === ticketNumberFromUrl);
      if (task) {
        setSelectedTask(task);
      }
    }
  }, [searchParams, tasks]);

  // Handle task selection with URL update (using ticketNumber)
  const handleSelectTask = (task: Task) => {
    setSelectedTask(task);
    const urlParam = task.ticketNumber || task._id;
    router.push(`?task=${urlParam}`);
  };

  // Handle closing task modal and clearing URL
  const handleCloseTask = () => {
    setSelectedTask(null);
    router.push('?');
  };

  const updateTask = useMutation(api.tasks.update);
  const addDependency = useMutation(api.tasks.addDependency);
  const removeDependency = useMutation(api.tasks.removeDependency);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        if (!task.title.toLowerCase().includes(q) && !task.description?.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (filters.filterPriority && task.priority !== filters.filterPriority) return false;
      if (filters.filterAssignee) {
        if (filters.filterAssignee === "unassigned") {
          if (task.assigneeIds.length > 0) return false;
        } else if (!task.assigneeIds.includes(filters.filterAssignee)) {
          return false;
        }
      }
      if (filters.filterEpic) {
        if (filters.filterEpic === "none") {
          if (task.epicId) return false;
        } else if (task.epicId !== filters.filterEpic) {
          return false;
        }
      }
      if (filters.filterStatus && task.status !== filters.filterStatus) return false;
      if (filters.showBlockedOnly && (!task.blockedBy || task.blockedBy.length === 0)) return false;

      // Quick filter pills (mutually exclusive)
      if (quickFilter === "my_tasks") {
        // Show tasks assigned to first agent (representative of "my" tasks)
        const firstAgentId = agents[0]?._id;
        if (!firstAgentId || !task.assigneeIds?.includes(firstAgentId)) {
          return false;
        }
      }
      if (quickFilter === "blocked") {
        if (task.status !== "blocked") return false;
      }
      if (quickFilter === "ready") {
        if (task.status !== "ready") return false;
      }

      return true;
    });
  }, [tasks, filters, quickFilter, agents]);

  const tasksByStatus = useMemo(() => {
    return kanbanColumns.reduce((acc, col) => {
      acc[col.id] = filteredTasks.filter((t) => t.status === col.id);
      return acc;
    }, {} as Record<string, Task[]>);
  }, [filteredTasks]);

  // Bulk actions (now with cleaner selection API)
  const handleBulkMove = async (newStatus: string) => {
    if (!updateTask) return;
    const promises = Array.from(selectedTasks).map(taskId =>
      updateTask({ id: taskId as any, status: newStatus as any })
    );
    await Promise.all(promises);
    clearSelection();
    notif.success("Tasks moved");
  };

  const handleBulkAssign = async (agentId: string | null) => {
    if (!updateTask) return;
    const promises = Array.from(selectedTasks).map(taskId => {
      const task = tasks.find(t => t._id === taskId);
      const newAssignees = agentId
        ? [...new Set([...(task?.assigneeIds || []), agentId])]
        : [];
      return updateTask({ id: taskId as any, assigneeIds: newAssignees as any });
    });
    await Promise.all(promises);
    clearSelection();
    notif.success("Tasks assigned");
  };

  // Drag handlers
  const handleDragStart = (task: any) => {
    if (!bulkMode) setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (!draggedTask || draggedTask.status === columnId) {
      setDraggedTask(null);
      return;
    }
    if (!updateTask) {
      notif.error("Backend offline");
      setDraggedTask(null);
      return;
    }
    try {
      await updateTask({ id: draggedTask._id as any, status: columnId as any });
      notif.success("Task moved");
    } catch (err: any) {
      const errorMsg = err?.message || "Failed to move task";
      notif.error(errorMsg);
    } finally {
      setDraggedTask(null);
    }
  };

  const hasFilters = !!(
    filters.searchQuery ||
    filters.filterPriority ||
    filters.filterAssignee ||
    filters.filterEpic ||
    filters.filterStatus ||
    filters.showBlockedOnly
  );

  return (
    <div className="h-full flex flex-col">
      {/* Filter Bar */}
      <TaskFilterBar
        searchQuery={filters.searchQuery}
        filterPriority={filters.filterPriority}
        filterAssignee={filters.filterAssignee}
        filterEpic={filters.filterEpic}
        filterStatus={filters.filterStatus}
        showBlockedOnly={filters.showBlockedOnly}
        quickFilter={quickFilter}
        onQuickFilterChange={setQuickFilter}
        agents={agents}
        epics={epics}
        onSearchChange={filterSetters.setSearchQuery}
        onPriorityChange={filterSetters.setFilterPriority}
        onAssigneeChange={filterSetters.setFilterAssignee}
        onEpicChange={filterSetters.setFilterEpic}
        onStatusChange={filterSetters.setFilterStatus}
        onBlockedToggle={() => filterSetters.setShowBlockedOnly(!filters.showBlockedOnly)}
        onClearFilters={filterSetters.clearAll}
        hasFilters={hasFilters}
      />

      {/* Bulk Action Bar */}
      <BulkActionBar
        bulkMode={bulkMode}
        selectedTasks={selectedTasks}
        filteredTasks={filteredTasks}
        agents={agents}
        onToggleBulkMode={() => {
          setBulkMode(!bulkMode);
          if (bulkMode) clearSelection();
        }}
        onSelectAll={selectAllVisible}
        onClearSelection={clearSelection}
        onBulkMove={handleBulkMove}
        onBulkAssign={handleBulkAssign}
      />

      {/* Kanban Board - Responsive Layout */}
      <div className="flex-1 min-h-0 overflow-x-auto pb-4 md:overflow-x-visible scroll-smooth">
        <div className="flex gap-3 min-w-min md:grid md:grid-cols-3 lg:grid-cols-6 md:min-w-0 snap-x snap-mandatory md:snap-none">
          {kanbanColumns.map((col) => (
            <div
              key={col.id}
              className="min-w-[280px] md:min-w-0 flex-shrink-0 md:flex-shrink snap-start"
            >
              <KanbanColumn
                column={col}
                tasks={tasksByStatus[col.id] || []}
                agents={agents}
                epics={epics}
                bulkMode={bulkMode}
                selectedTasks={selectedTasks}
                isDragOver={dragOverColumn === col.id}
                onTaskClick={handleSelectTask}
                onTaskSelect={toggleTaskSelection}
                onDragStart={handleDragStart}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              />
            </div>
          ))}
        </div>
        {/* Mobile scroll hint */}
        <p className="md:hidden text-xs text-muted-foreground text-center py-2 px-4">
          ← Swipe to see all columns →
        </p>
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          agents={agents}
          epics={epics}
          tasks={tasks}
          onClose={handleCloseTask}
          addDependency={addDependency}
          removeDependency={removeDependency}
        />
      )}
    </div>
  );
}
