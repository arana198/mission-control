"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  Calendar, Clock, Users, ChevronLeft, ChevronRight,
  CheckCircle2, AlertCircle, Zap, Repeat2
} from "lucide-react";

interface Task {
  _id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: number;
  assigneeIds: string[];
  timeEstimate?: string;
  epicId?: string;
}

interface Agent {
  _id: string;
  name: string;
  role: string;
  status: string;
  lastHeartbeat: number;
}

interface CalendarEventData {
  _id: string;
  title: string;
  startTime: number;
  endTime: number;
  type: "human" | "ai_task" | "ai_workflow" | "bot_generated";
  executedAt?: number;
  recurring?: {
    rule: string;
  };
  taskId?: string;
  generatedBy?: string;
  priority?: number;
}

interface MergedEvent {
  id: string;
  title: string;
  type: "human" | "ai_task" | "ai_workflow" | "bot_generated" | "task_due";
  startDate: Date;
  endDate?: Date;
  executedAt?: number;
  recurring?: {
    rule: string;
  };
  color: string;
  agentId?: string;
  agentName?: string;
  priority?: string;
}

type EventTypeFilter = "all" | "tasks" | "cron" | "human";

/**
 * Calendar View — Source of truth for all scheduled work
 *
 * Shows scheduled events from calendarEvents table:
 * - ai_task: Agent-scheduled task blocks
 * - ai_workflow: Multi-step automated workflows
 * - bot_generated: Cron jobs and automations
 * - human: Human-created events
 *
 * Fallback: Task due dates for unscheduled tasks
 * Supports month and week views with execution status badges
 */
export function CalendarView({ tasks, agents }: { tasks: Task[]; agents: Agent[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("all");
  const [eventTypeFilter, setEventTypeFilter] = useState<EventTypeFilter>("all");
  const [view, setView] = useState<"month" | "week">("month");

  // Query real calendar events
  const rangeStart = getMonthRangeStart(currentDate);
  const rangeEnd = getMonthRangeEnd(currentDate);

  const calendarEvents = useQuery(api.calendarEvents.getTimelineRange, {
    startTime: rangeStart.getTime(),
    endTime: rangeEnd.getTime(),
  });

  // Merge calendar events with task due dates
  const events = useMemo(() => {
    const merged: MergedEvent[] = [];
    const seenTaskIds = new Set<string>();

    // Add calendarEvents
    (calendarEvents || []).forEach((event: CalendarEventData) => {
      if (event.taskId) {
        seenTaskIds.add(event.taskId);
      }

      const color = colorByType(event.type);
      merged.push({
        id: event._id,
        title: event.title,
        type: event.type,
        startDate: new Date(event.startTime),
        endDate: new Date(event.endTime),
        executedAt: event.executedAt,
        recurring: event.recurring,
        color,
        agentId: event.generatedBy,
        priority: event.type === "ai_task" ? "high" : undefined,
      });
    });

    // Add task due dates (fallback for unscheduled tasks)
    (tasks || []).forEach(task => {
      if (task.dueDate && !seenTaskIds.has(task._id)) {
        merged.push({
          id: `due-${task._id}`,
          title: task.title,
          type: "task_due",
          startDate: new Date(task.dueDate),
          endDate: new Date(task.dueDate),
          color: "#ef4444", // red
          agentId: task.assigneeIds?.[0],
          agentName: agents.find(a => a._id === task.assigneeIds?.[0])?.name,
          priority: task.priority,
        });
      }
    });

    // Apply filters
    let filtered = merged;

    // Agent filter
    if (selectedAgentId !== "all") {
      filtered = filtered.filter(e => e.agentId === selectedAgentId);
    }

    // Event type filter
    if (eventTypeFilter !== "all") {
      if (eventTypeFilter === "tasks") {
        filtered = filtered.filter(e => e.type === "ai_task" || e.type === "task_due");
      } else if (eventTypeFilter === "cron") {
        filtered = filtered.filter(e => e.type === "bot_generated" || e.type === "ai_workflow");
      } else if (eventTypeFilter === "human") {
        filtered = filtered.filter(e => e.type === "human");
      }
    }

    return filtered.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, [calendarEvents, tasks, agents, selectedAgentId, eventTypeFilter]);

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event =>
      event.startDate.toDateString() === date.toDateString()
    );
  };

  const getEventsForWeek = (date: Date) => {
    const dayOfWeek = date.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1);
    const weekStart = new Date(date);
    weekStart.setDate(weekStart.getDate() + mondayOffset);

    return events.filter(event => {
      const eventDate = event.startDate;
      const dayDiff = Math.floor((eventDate.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
      return dayDiff >= 0 && dayDiff < 7;
    });
  };

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
  };

  const today = new Date();
  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const monthName = currentDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  // Stats from calendarEvents
  const scheduledToday = (calendarEvents || []).filter((e: CalendarEventData) => {
    const d = new Date(e.startTime);
    return d.toDateString() === today.toDateString();
  }).length;

  const cronJobs = (calendarEvents || []).filter((e: CalendarEventData) =>
    e.type === "bot_generated" && e.recurring
  ).length;

  const executedToday = (calendarEvents || []).filter((e: CalendarEventData) => {
    if (!e.executedAt) return false;
    const d = new Date(e.executedAt);
    return d.toDateString() === today.toDateString();
  }).length;

  const activeAgentCount = (agents || []).filter(a => a.status === "active").length;

  return (
    <div className="max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold mb-1">Calendar</h2>
          <p className="text-muted-foreground">
            All scheduled work, tasks, and automations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 card p-1">
            {["month", "week"].map((v) => (
              <button
                key={v}
                onClick={() => setView(v as any)}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  view === v ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">{scheduledToday}</p>
              <p className="text-sm text-muted-foreground">Scheduled Today</p>
            </div>
            <Clock className="w-5 h-5 text-warning" />
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">{cronJobs}</p>
              <p className="text-sm text-muted-foreground">Cron Jobs</p>
            </div>
            <Repeat2 className="w-5 h-5 text-success" />
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">{executedToday}</p>
              <p className="text-sm text-muted-foreground">Executed Today</p>
            </div>
            <CheckCircle2 className="w-5 h-5 text-success" />
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">{activeAgentCount}</p>
              <p className="text-sm text-muted-foreground">Active Agents</p>
            </div>
            <Users className="w-5 h-5 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        {/* Agent Filter */}
        <div className="card p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground">Filter by agent:</span>
            <button
              onClick={() => setSelectedAgentId("all")}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                selectedAgentId === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              All Agents
            </button>
            {agents.map(agent => (
              <button
                key={agent._id}
                onClick={() => setSelectedAgentId(agent._id)}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  selectedAgentId === agent._id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                {agent.name}
              </button>
            ))}
          </div>
        </div>

        {/* Event Type Filter */}
        <div className="card p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground">Event type:</span>
            {(["all", "tasks", "cron", "human"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setEventTypeFilter(type)}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  eventTypeFilter === type
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                {type === "all" ? "All" : type === "cron" ? "Cron/Automations" : type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Calendar */}
        <div className="col-span-3 card p-6">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold">{monthName}</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateMonth(-1)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1 text-sm hover:bg-muted rounded transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => navigateMonth(1)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {view === "month" ? (
            // Month Grid
            <div className="grid grid-cols-7 gap-1">
              {/* Day Headers */}
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                  {day}
                </div>
              ))}

              {/* Empty cells for previous month */}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="p-2 h-24" />
              ))}

              {/* Days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNumber = i + 1;
                const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), dayNumber);
                const dayEvents = getEventsForDate(date);
                const isToday = date.toDateString() === today.toDateString();
                const isSelected = selectedDate?.toDateString() === date.toDateString();

                return (
                  <div
                    key={dayNumber}
                    onClick={() => setSelectedDate(date)}
                    className={`p-2 h-24 border rounded-lg cursor-pointer transition-all ${
                      isToday ? "bg-primary/10 border-primary/30" :
                      isSelected ? "bg-muted border-primary/50" :
                      "hover:bg-muted border-transparent"
                    }`}
                  >
                    <div className={`text-sm font-medium mb-1 ${isToday ? "text-primary" : ""}`}>
                      {dayNumber}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 2).map((event) => (
                        <div
                          key={event.id}
                          className="text-xs p-1 rounded truncate text-white"
                          style={{ backgroundColor: event.color }}
                        >
                          {event.title}
                          {event.executedAt && <span className="ml-1">✓</span>}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-xs text-muted-foreground">
                          +{dayEvents.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // Week Grid
            <div className="space-y-4">
              {/* Time slots: 8am to 6pm */}
              <div className="grid grid-cols-8 gap-2">
                {/* Time header */}
                <div className="text-xs font-medium text-muted-foreground py-2">Time</div>

                {/* Day headers */}
                {Array.from({ length: 7 }).map((_, dayIdx) => {
                  const dayDate = new Date(selectedDate || today);
                  const dayOfWeek = dayDate.getDay();
                  const mondayOffset = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1);
                  const weekStart = new Date(dayDate);
                  weekStart.setDate(weekStart.getDate() + mondayOffset);
                  const cellDate = new Date(weekStart);
                  cellDate.setDate(cellDate.getDate() + dayIdx);

                  return (
                    <div key={dayIdx} className="text-center text-xs font-medium">
                      <div>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][dayIdx]}</div>
                      <div className="text-muted-foreground">{cellDate.getDate()}</div>
                    </div>
                  );
                })}

                {/* Time rows */}
                {Array.from({ length: 10 }).map((_, timeIdx) => {
                  const hour = 8 + timeIdx;
                  return (
                    <div key={`time-${hour}`} className="contents">
                      <div className="text-xs text-muted-foreground text-right pr-2 py-4">
                        {hour}:00
                      </div>
                      {/* Day cells */}
                      {Array.from({ length: 7 }).map((_, dayIdx) => {
                        const dayDate = new Date(selectedDate || today);
                        const dayOfWeek = dayDate.getDay();
                        const mondayOffset = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1);
                        const weekStart = new Date(dayDate);
                        weekStart.setDate(weekStart.getDate() + mondayOffset);
                        const cellDate = new Date(weekStart);
                        cellDate.setDate(cellDate.getDate() + dayIdx);

                        const cellEvents = (getEventsForWeek(cellDate) || []).filter(e => {
                          const startHour = e.startDate.getHours();
                          return startHour === hour;
                        });

                        return (
                          <div
                            key={`${dayIdx}-${hour}`}
                            className="border rounded min-h-[60px] bg-muted/20 p-1 text-xs"
                          >
                            {cellEvents.map(event => (
                              <div
                                key={event.id}
                                className="p-1 rounded text-white text-xs truncate mb-1"
                                style={{ backgroundColor: event.color }}
                                title={event.title}
                              >
                                {event.title}
                                {event.executedAt && <span className="ml-1">✓</span>}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - Event Details */}
        <div className="space-y-4">
          {/* Selected Date Events */}
          <div className="card p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {selectedDate ?
                `${selectedDate.toLocaleDateString("en-GB", { month: "short", day: "numeric" })} Events` :
                "Today's Events"
              }
            </h3>
            <div className="space-y-3">
              {getEventsForDate(selectedDate || today).length > 0 ? (
                getEventsForDate(selectedDate || today).map((event) => (
                  <div key={event.id} className="p-3 bg-muted/50 rounded-lg border-l-4" style={{ borderLeftColor: event.color }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate flex items-center gap-2">
                          {event.title}
                          {event.executedAt ? (
                            <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded">✓ Executed</span>
                          ) : event.endDate && event.endDate < today ? (
                            <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded">Missed</span>
                          ) : (
                            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">Scheduled</span>
                          )}
                        </p>
                        {event.agentName && (
                          <p className="text-xs text-muted-foreground mt-1">{event.agentName}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {event.startDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                          {event.endDate && ` - ${event.endDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`}
                        </p>
                        {event.recurring && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Repeat2 className="w-3 h-3" />
                            Recurring
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No events scheduled</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper functions
function getMonthRangeStart(date: Date): Date {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const dayOfWeek = firstDay.getDay();
  const diff = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1);
  firstDay.setDate(firstDay.getDate() + diff);
  return firstDay;
}

function getMonthRangeEnd(date: Date): Date {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const dayOfWeek = lastDay.getDay();
  const diff = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  lastDay.setDate(lastDay.getDate() + diff);
  return lastDay;
}

function colorByType(type: string): string {
  return {
    ai_task: "#8b5cf6",      // purple
    ai_workflow: "#f97316",  // orange
    bot_generated: "#22c55e", // green
    human: "#3b82f6",        // blue
    task_due: "#ef4444",     // red
  }[type] ?? "#6b7280";
}
