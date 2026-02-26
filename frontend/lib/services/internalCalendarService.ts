/**
 * Internal Calendar Service
 * 
 * Mission Control native calendar (no external dependencies)
 * - Time-block tasks to specific times/days
 * - Track agent availability + capacity
 * - Detect conflicts (overlaps, overload)
 * - Shared visibility: user + all 10 agents
 */

import { Id } from '@/convex/_generated/dataModel';

interface CalendarEvent {
  id: string;
  taskId: Id<'tasks'>;
  title: string;
  description?: string;
  startTime: number; // timestamp
  endTime: number;
  agentId?: string;
  type: 'task' | 'break' | 'sync' | 'review';
  recurring?: {
    frequency: 'daily' | 'weekly' | 'biweekly';
    endDate?: number;
  };
  createdBy: string;
}

interface AgentAvailability {
  agentId: string;
  name: string;
  available: boolean;
  capacity: number; // 0-100, time available this week
  scheduledHours: number;
  maxHoursPerWeek: number;
  busyBlocks: CalendarEvent[];
  breakTimes: { start: number; end: number }[];
}

interface CalendarConflict {
  type: 'agent_overload' | 'time_overlap' | 'task_duration_mismatch';
  severity: 'critical' | 'warning';
  event1: CalendarEvent;
  event2?: CalendarEvent;
  agent?: AgentAvailability;
  resolution: string;
}

interface CalendarMetrics {
  totalEventsScheduled: number;
  agentsAvailable: number;
  agentsOverloaded: number;
  conflictCount: number;
  weekUtilization: number; // percentage
  avgTaskDuration: number; // hours
}

export class InternalCalendarService {
  private events: Map<string, CalendarEvent> = new Map();
  private agentAvailability: Map<string, AgentAvailability> = new Map();
  private conflicts: CalendarConflict[] = [];

  /**
   * Initialize calendar for 10 agents
   */
  initializeAgents(agents: any[]): void {
    for (const agent of agents.slice(0, 10)) {
      this.agentAvailability.set(agent._id, {
        agentId: agent._id,
        name: agent.name,
        available: true,
        capacity: 100,
        scheduledHours: 0,
        maxHoursPerWeek: 40,
        busyBlocks: [],
        breakTimes: this.getDefaultBreakTimes(),
      });
    }
  }

  /**
   * Schedule task to calendar
   * Auto-detects conflicts, suggests best agent
   */
  scheduleTask(
    task: any,
    startTime: number,
    estimatedHours: number,
    preferredAgentId?: string
  ): {
    success: boolean;
    eventId?: string;
    conflicts: CalendarConflict[];
    suggestedAgent?: string;
  } {
    const endTime = startTime + estimatedHours * 60 * 60 * 1000;
    const event: CalendarEvent = {
      id: `event-${Date.now()}`,
      taskId: task._id,
      title: task.title,
      description: task.description,
      startTime,
      endTime,
      agentId: preferredAgentId,
      type: 'task',
      createdBy: 'system',
    };

    // Check conflicts
    const conflicts = this.detectConflicts(event);

    if (conflicts.length > 0 && preferredAgentId) {
      // Try to find alternative agent
      const alternativeAgent = this.findBestAgent(startTime, endTime, estimatedHours);
      if (alternativeAgent) {
        event.agentId = alternativeAgent;
        const alternativeConflicts = this.detectConflicts(event);
        if (alternativeConflicts.length === 0) {
          // Schedule with alternative agent
          this.events.set(event.id, event);
          this.updateAgentAvailability(alternativeAgent, event);
          return {
            success: true,
            eventId: event.id,
            conflicts: [],
            suggestedAgent: alternativeAgent || undefined,
          };
        }
      }

      // Has conflicts
      return {
        success: false,
        conflicts,
        suggestedAgent: alternativeAgent || undefined,
      };
    }

    // No conflicts, schedule
    if (event.agentId) {
      this.events.set(event.id, event);
      this.updateAgentAvailability(event.agentId, event);
    }

    return {
      success: true,
      eventId: event.id,
      conflicts,
    };
  }

  /**
   * Detect conflicts for an event
   */
  private detectConflicts(event: CalendarEvent): CalendarConflict[] {
    const conflicts: CalendarConflict[] = [];

    if (!event.agentId) return conflicts;

    const agent = this.agentAvailability.get(event.agentId);
    if (!agent) return conflicts;

    // Check 1: Agent capacity
    const newHours = (event.endTime - event.startTime) / (60 * 60 * 1000);
    if (agent.scheduledHours + newHours > agent.maxHoursPerWeek) {
      conflicts.push({
        type: 'agent_overload',
        severity: agent.scheduledHours + newHours > agent.maxHoursPerWeek * 1.2 ? 'critical' : 'warning',
        event1: event,
        agent,
        resolution: `${agent.name} would have ${Math.round(agent.scheduledHours + newHours)}h/week (max ${agent.maxHoursPerWeek}h). Reassign to lighter agent.`,
      });
    }

    // Check 2: Time overlaps
    for (const existingEvent of agent.busyBlocks) {
      if (event.startTime < existingEvent.endTime && event.endTime > existingEvent.startTime) {
        conflicts.push({
          type: 'time_overlap',
          severity: 'critical',
          event1: event,
          event2: existingEvent,
          agent,
          resolution: `${event.title} overlaps with ${existingEvent.title}. Choose different time or agent.`,
        });
      }
    }

    // Check 3: Break times
    for (const breakTime of agent.breakTimes) {
      if (event.startTime < breakTime.end && event.endTime > breakTime.start) {
        conflicts.push({
          type: 'task_duration_mismatch',
          severity: 'warning',
          event1: event,
          agent,
          resolution: `Task scheduled during ${agent.name}'s break time (${new Date(breakTime.start).toLocaleTimeString()}). Reschedule.`,
        });
      }
    }

    return conflicts;
  }

  /**
   * Find best available agent for time slot
   */
  private findBestAgent(
    startTime: number,
    endTime: number,
    estimatedHours: number
  ): string | null {
    const hours = estimatedHours;
    let bestAgent: [string, AgentAvailability] | null = null;

    for (const [agentId, agent] of this.agentAvailability) {
      if (!agent.available) continue;
      if (agent.scheduledHours + hours > agent.maxHoursPerWeek) continue;

      // Check time overlap
      let hasConflict = false;
      for (const busyBlock of agent.busyBlocks) {
        if (startTime < busyBlock.endTime && endTime > busyBlock.startTime) {
          hasConflict = true;
          break;
        }
      }

      if (!hasConflict) {
        // Prefer agent with lowest current load
        if (!bestAgent || agent.scheduledHours < bestAgent[1].scheduledHours) {
          bestAgent = [agentId, agent];
        }
      }
    }

    return bestAgent ? bestAgent[0] : null;
  }

  /**
   * Update agent availability after scheduling event
   */
  private updateAgentAvailability(agentId: string, event: CalendarEvent): void {
    const agent = this.agentAvailability.get(agentId);
    if (!agent) return;

    agent.busyBlocks.push(event);
    const hours = (event.endTime - event.startTime) / (60 * 60 * 1000);
    agent.scheduledHours += hours;
    agent.capacity = Math.max(0, 100 - (agent.scheduledHours / agent.maxHoursPerWeek) * 100);
  }

  /**
   * Get calendar view for time range
   */
  getCalendarView(startTime: number, endTime: number): {
    events: CalendarEvent[];
    agentAvailability: AgentAvailability[];
    conflicts: CalendarConflict[];
  } {
    const events = Array.from(this.events.values()).filter(
      (e) => e.startTime < endTime && e.endTime > startTime
    );

    const availability = Array.from(this.agentAvailability.values());

    return {
      events,
      agentAvailability: availability,
      conflicts: this.conflicts,
    };
  }

  /**
   * Get agent schedule for week
   */
  getAgentSchedule(agentId: string): {
    agent: AgentAvailability | null;
    events: CalendarEvent[];
    conflicts: CalendarConflict[];
    metrics: {
      hoursScheduled: number;
      capacity: number;
      isOverloaded: boolean;
    };
  } {
    const agent = this.agentAvailability.get(agentId);
    if (!agent) {
      return {
        agent: null,
        events: [],
        conflicts: [],
        metrics: { hoursScheduled: 0, capacity: 0, isOverloaded: false },
      };
    }

    const events = Array.from(this.events.values()).filter((e) => e.agentId === agentId);
    const agentConflicts = this.conflicts.filter((c) => c.agent?.agentId === agentId);

    return {
      agent,
      events,
      conflicts: agentConflicts,
      metrics: {
        hoursScheduled: agent.scheduledHours,
        capacity: agent.capacity,
        isOverloaded: agent.scheduledHours > agent.maxHoursPerWeek * 1.1,
      },
    };
  }

  /**
   * Get calendar metrics
   */
  getMetrics(): CalendarMetrics {
    const agents = Array.from(this.agentAvailability.values());
    const overloaded = agents.filter((a) => a.scheduledHours > a.maxHoursPerWeek);
    const avgTaskDuration =
      this.events.size > 0
        ? Array.from(this.events.values()).reduce((sum, e) => sum + (e.endTime - e.startTime), 0) /
          this.events.size /
          (60 * 60 * 1000)
        : 0;

    const totalCapacity = agents.reduce((sum, a) => sum + a.maxHoursPerWeek, 0);
    const usedCapacity = agents.reduce((sum, a) => sum + a.scheduledHours, 0);

    return {
      totalEventsScheduled: this.events.size,
      agentsAvailable: agents.filter((a) => a.available && a.capacity > 0).length,
      agentsOverloaded: overloaded.length,
      conflictCount: this.conflicts.length,
      weekUtilization: Math.round((usedCapacity / totalCapacity) * 100),
      avgTaskDuration: Math.round(avgTaskDuration * 10) / 10,
    };
  }

  /**
   * Rebalance: Move tasks from overloaded agents to available ones
   */
  rebalanceSchedule(): {
    moved: number;
    conflicts: CalendarConflict[];
  } {
    let moved = 0;
    const agents = Array.from(this.agentAvailability.values());
    const overloaded = agents.filter((a) => a.scheduledHours > a.maxHoursPerWeek);

    for (const overloadedAgent of overloaded) {
      // Get last scheduled task
      const lastTask = overloadedAgent.busyBlocks.sort((a, b) => b.endTime - a.endTime)[0];
      if (!lastTask) continue;

      // Find alternative agent
      const alternative = this.findBestAgent(lastTask.startTime, lastTask.endTime, 
        (lastTask.endTime - lastTask.startTime) / (60 * 60 * 1000));

      if (alternative && alternative !== overloadedAgent.agentId) {
        // Move task
        lastTask.agentId = alternative;
        this.updateAgentAvailability(alternative, lastTask);
        moved++;
      }
    }

    return {
      moved,
      conflicts: this.conflicts,
    };
  }

  /**
   * Get default break times for agent (9-5, lunch 12-1)
   */
  private getDefaultBreakTimes(): { start: number; end: number }[] {
    const now = Date.now();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const breakStart = new Date(today);
    breakStart.setHours(12, 0, 0, 0);

    const breakEnd = new Date(today);
    breakEnd.setHours(13, 0, 0, 0);

    return [
      {
        start: breakStart.getTime(),
        end: breakEnd.getTime(),
      },
    ];
  }
}

let instance: InternalCalendarService | null = null;

export function getInternalCalendarService(): InternalCalendarService {
  if (!instance) {
    instance = new InternalCalendarService();
  }
  return instance;
}
