"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { 
  Calendar, Clock, Users, ChevronLeft, ChevronRight, 
  Plus, Zap, Bell, Target, CheckCircle2, AlertCircle,
  CalendarDays, Repeat, Bot, Settings, Coffee, Moon
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

interface CalendarEvent {
  id: string;
  title: string;
  type: "task" | "automation" | "meeting" | "brief" | "heartbeat";
  date: Date;
  time?: string;
  description?: string;
  priority?: string;
  agent?: string;
  recurring?: boolean;
}

export function CalendarView({ tasks, agents }: { tasks: Task[]; agents: Agent[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [view, setView] = useState<"month" | "week" | "day">("month");

  // Generate calendar events from tasks and automation
  const events = useMemo(() => {
    const eventList: CalendarEvent[] = [];
    const now = new Date();

    // Task due dates
    tasks.forEach(task => {
      if (task.dueDate) {
        eventList.push({
          id: `task-${task._id}`,
          title: task.title,
          type: "task",
          date: new Date(task.dueDate),
          time: "9:00 AM",
          description: `${task.priority} priority task`,
          priority: task.priority,
          agent: task.assigneeIds.length > 0 ? 
            agents.find(a => a._id === task.assigneeIds[0])?.name : undefined
        });
      }
    });

    // Daily automations
    const automations = [
      {
        id: "morning-brief",
        title: "Morning Brief",
        type: "brief" as const,
        time: "7:00 AM",
        description: "Daily automated report with news, tasks, and recommendations",
        recurring: true
      },
      {
        id: "agent-heartbeat",
        title: "Agent Heartbeat Check",
        type: "heartbeat" as const,
        time: "Every 15 mins",
        description: "Automated health check for all 10 agents",
        recurring: true
      },
      {
        id: "task-distribution",
        title: "Task Auto-Assignment",
        type: "automation" as const,
        time: "9:30 AM",
        description: "Smart task distribution to available agents",
        recurring: true
      },
      {
        id: "daily-standup",
        title: "Team Standup Report",
        type: "automation" as const,
        time: "10:00 AM", 
        description: "Automated standup summary for all agents",
        recurring: true
      }
    ];

    // Add automation events for the next 30 days
    for (let i = 0; i < 30; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() + i);
      
      automations.forEach(automation => {
        eventList.push({
          ...automation,
          id: `${automation.id}-${date.toISOString().split('T')[0]}`,
          date: new Date(date),
        });
      });
    }

    return eventList.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [tasks, agents]);

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event => 
      event.date.toDateString() === date.toDateString()
    );
  };

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
  };

  const today = new Date();
  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const monthName = currentDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold mb-1">Calendar & Automation</h2>
          <p className="text-muted-foreground">
            Track tasks, events, and OpenClaw's automated operations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 card p-1">
            {["month", "week", "day"].map((v) => (
              <button
                key={v}
                onClick={() => setView(v as any)}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  view === v ? "bg-blue-500 text-white" : "hover:bg-muted"
                }`}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <button className="btn btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Add Event
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">{tasks.filter(t => t.dueDate && new Date(t.dueDate).toDateString() === today.toDateString()).length}</p>
              <p className="text-sm text-muted-foreground">Due Today</p>
            </div>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">4</p>
              <p className="text-sm text-muted-foreground">Daily Automations</p>
            </div>
            <Bot className="w-5 h-5 text-blue-500" />
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">{tasks.filter(t => t.dueDate && new Date(t.dueDate) > today).length}</p>
              <p className="text-sm text-muted-foreground">Upcoming Tasks</p>
            </div>
            <Target className="w-5 h-5 text-green-500" />
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">{agents.filter(a => a.status === "active").length}</p>
              <p className="text-sm text-muted-foreground">Active Agents</p>
            </div>
            <Users className="w-5 h-5 text-purple-500" />
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

          {/* Calendar Grid */}
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
                    isToday ? "bg-blue-50 border-blue-200" : 
                    isSelected ? "bg-muted border-blue-300" :
                    "hover:bg-muted border-transparent"
                  }`}
                >
                  <div className={`text-sm font-medium mb-1 ${isToday ? "text-blue-600" : ""}`}>
                    {dayNumber}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 2).map((event) => (
                      <div 
                        key={event.id}
                        className={`text-xs p-1 rounded truncate ${
                          event.type === "task" ? "bg-red-100 text-red-700" :
                          event.type === "automation" ? "bg-blue-100 text-blue-700" :
                          event.type === "brief" ? "bg-green-100 text-green-700" :
                          event.type === "heartbeat" ? "bg-purple-100 text-purple-700" :
                          "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {event.title}
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
        </div>

        {/* Sidebar - Event Details */}
        <div className="space-y-4">
          {/* Today's Events */}
          <div className="card p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {selectedDate ? 
                `${selectedDate.toLocaleDateString("en-GB", { month: "short", day: "numeric" })} Events` :
                "Today's Events"
              }
            </h3>
            <div className="space-y-2">
              {getEventsForDate(selectedDate || today).map((event) => (
                <div key={event.id} className="p-2 bg-muted/50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <div className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${
                      event.type === "task" ? "bg-red-500" :
                      event.type === "automation" ? "bg-blue-500" :
                      event.type === "brief" ? "bg-green-500" :
                      event.type === "heartbeat" ? "bg-purple-500" :
                      "bg-slate-500"
                    }`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{event.title}</p>
                      {event.time && (
                        <p className="text-xs text-muted-foreground">{event.time}</p>
                      )}
                      {event.description && (
                        <p className="text-xs text-muted-foreground mt-1">{event.description}</p>
                      )}
                      {event.recurring && (
                        <div className="flex items-center gap-1 mt-1">
                          <Repeat className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Recurring</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {getEventsForDate(selectedDate || today).length === 0 && (
                <p className="text-sm text-muted-foreground">No events scheduled</p>
              )}
            </div>
          </div>

          {/* Automation Status */}
          <div className="card p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Automation Status
            </h3>
            <div className="space-y-3">
              {[
                { name: "Morning Brief", status: "active", next: "7:00 AM Tomorrow", icon: Coffee },
                { name: "Agent Heartbeats", status: "active", next: "Next in 12 mins", icon: Bell },
                { name: "Task Distribution", status: "active", next: "9:30 AM Tomorrow", icon: Zap },
                { name: "Night Shift Mode", status: "scheduled", next: "10:00 PM Today", icon: Moon }
              ].map((automation) => (
                <div key={automation.name} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <automation.icon className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{automation.name}</p>
                      <p className="text-xs text-muted-foreground">{automation.next}</p>
                    </div>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${
                    automation.status === "active" ? "bg-green-500" : "bg-amber-500"
                  }`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}