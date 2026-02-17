/**
 * Autonomous Execution Scaling
 * 
 * Manages parallel execution of 10+ concurrent sub-agents
 * Queue management, load balancing, agent pool monitoring
 * Transforms sequential execution → parallel
 * 
 * Real-time execution dashboard + metrics
 */

import { Id } from '@/convex/_generated/dataModel';

interface QueuedTask {
  taskId: Id<'tasks'>;
  title: string;
  description: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  estimatedHours: number;
  createdAt: number;
  queuedAt: number;
}

interface AgentWorker {
  agentId: string;
  name: string;
  status: 'idle' | 'active' | 'busy' | 'unavailable';
  currentTaskId?: Id<'tasks'>;
  tasksCompleted: number;
  avgCompletionTime: number; // minutes
  successRate: number; // percentage
  capacity: 'light' | 'medium' | 'heavy'; // workload tolerance
  lastHeartbeat: number;
}

interface ExecutionPool {
  poolId: string;
  workers: AgentWorker[];
  queue: QueuedTask[];
  activeTasks: Map<Id<'tasks'>, { agentId: string; startTime: number }>;
  metrics: {
    totalQueued: number;
    totalActive: number;
    totalCompleted: number;
    avgQueueWaitTime: number;
    throughput: number; // tasks/hour
    avgCompletionTime: number;
  };
}

interface ExecutionMetrics {
  queueDepth: number;
  activeExecutions: number;
  totalCompleted: number;
  avgWaitTime: number; // minutes
  avgDuration: number; // minutes
  throughput: number; // tasks/hour
  successRate: number; // percentage
  bottlenecks: string[];
}

export class ExecutionScalingService {
  private pool: ExecutionPool;

  constructor() {
    this.pool = {
      poolId: `pool-${Date.now()}`,
      workers: [],
      queue: [],
      activeTasks: new Map(),
      metrics: {
        totalQueued: 0,
        totalActive: 0,
        totalCompleted: 0,
        avgQueueWaitTime: 0,
        throughput: 0,
        avgCompletionTime: 0,
      },
    };
  }

  /**
   * Initialize agent pool (10 default agents)
   */
  initializePool(agents: any[]): void {
    this.pool.workers = agents.slice(0, 10).map((agent) => ({
      agentId: agent._id,
      name: agent.name,
      status: 'idle',
      tasksCompleted: 0,
      avgCompletionTime: 30, // initial estimate
      successRate: 100,
      capacity: 'medium',
      lastHeartbeat: Date.now(),
    }));
  }

  /**
   * Queue task for execution
   * Determines priority based on task metadata
   */
  queueTask(task: any): QueuedTask {
    const queued: QueuedTask = {
      taskId: task._id,
      title: task.title,
      description: task.description,
      priority: task.priority || 'P2',
      estimatedHours: task.estimatedHours || 2,
      createdAt: task.createdAt,
      queuedAt: Date.now(),
    };

    // Insert by priority (P0 first)
    const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
    const insertIdx = this.pool.queue.findIndex(
      (t) => priorityOrder[t.priority] > priorityOrder[queued.priority]
    );
    if (insertIdx === -1) {
      this.pool.queue.push(queued);
    } else {
      this.pool.queue.splice(insertIdx, 0, queued);
    }

    this.pool.metrics.totalQueued++;
    return queued;
  }

  /**
   * Smart assignment: Match task to best available agent
   * Consider: workload, skill match, success rate, availability
   */
  assignNextTask(): { taskId: Id<'tasks'>; agentId: string } | null {
    if (this.pool.queue.length === 0) return null;

    // Find best available agent
    const availableAgents = this.pool.workers.filter(
      (w) => w.status === 'idle'
    );
    if (availableAgents.length === 0) return null;

    // Score agents by: success rate, workload, availability
    const scoredAgents = availableAgents.map((agent) => ({
      agent,
      score:
        agent.successRate * 0.5 + // Success rate (50%)
        (100 - (Date.now() - agent.lastHeartbeat) / 1000) * 0.3 + // Recency (30%)
        (100 / (agent.tasksCompleted + 1)) * 0.2, // Balancing (20%)
    }));

    const best = scoredAgents.sort((a, b) => b.score - a.score)[0];
    const task = this.pool.queue.shift()!;

    // Assign
    best.agent.status = 'active';
    best.agent.currentTaskId = task.taskId;
    this.pool.activeTasks.set(task.taskId, {
      agentId: best.agent.agentId,
      startTime: Date.now(),
    });

    this.pool.metrics.totalActive++;
    return { taskId: task.taskId, agentId: best.agent.agentId };
  }

  /**
   * Complete task execution
   * Update agent metrics, record completion
   */
  completeTask(
    taskId: Id<'tasks'>,
    success: boolean,
    output?: string
  ): void {
    const execution = this.pool.activeTasks.get(taskId);
    if (!execution) return;

    const agent = this.pool.workers.find((w) => w.agentId === execution.agentId);
    if (!agent) return;

    const duration = Date.now() - execution.startTime;
    const durationMinutes = duration / 60000;

    // Update agent metrics
    agent.tasksCompleted++;
    agent.avgCompletionTime =
      (agent.avgCompletionTime * (agent.tasksCompleted - 1) + durationMinutes) /
      agent.tasksCompleted;

    if (success) {
      agent.successRate =
        agent.successRate * 0.9 + 10; // Increase on success
    } else {
      agent.successRate =
        agent.successRate * 0.95; // Slight decrease on failure
    }

    // Move back to idle
    agent.status = 'idle';
    agent.currentTaskId = undefined;

    // Update pool metrics
    this.pool.metrics.totalActive--;
    this.pool.metrics.totalCompleted++;
    this.pool.metrics.avgCompletionTime =
      (this.pool.metrics.avgCompletionTime * (this.pool.metrics.totalCompleted - 1) +
        durationMinutes) /
      this.pool.metrics.totalCompleted;

    this.pool.activeTasks.delete(taskId);

    // Trigger next assignment
    this.assignNextTask();
  }

  /**
   * Get current metrics
   */
  getMetrics(): ExecutionMetrics {
    const activeWorkload = this.pool.workers.filter((w) => w.status !== 'idle');
    const avgWaitTime =
      this.pool.queue.length > 0
        ? this.pool.queue.reduce((sum, t) => sum + (Date.now() - t.queuedAt), 0) /
          this.pool.queue.length /
          1000 /
          60
        : 0;

    const throughput =
      this.pool.metrics.totalCompleted /
      ((Date.now() - Date.parse(new Date().toISOString().split('T')[0])) / 3600000);

    const bottlenecks: string[] = [];
    if (this.pool.queue.length > 5) {
      bottlenecks.push(`Queue backed up: ${this.pool.queue.length} tasks waiting`);
    }
    if (activeWorkload.length === 0 && this.pool.queue.length > 0) {
      bottlenecks.push('No agents available — pool at capacity');
    }
    const slowAgents = this.pool.workers.filter((w) => w.successRate < 70);
    if (slowAgents.length > 2) {
      bottlenecks.push(
        `${slowAgents.length} agents underperforming — consider reassignment`
      );
    }

    return {
      queueDepth: this.pool.queue.length,
      activeExecutions: activeWorkload.length,
      totalCompleted: this.pool.metrics.totalCompleted,
      avgWaitTime,
      avgDuration: this.pool.metrics.avgCompletionTime,
      throughput,
      successRate: this.getPoolSuccessRate(),
      bottlenecks,
    };
  }

  /**
   * Get agent pool status
   */
  getPoolStatus(): {
    workers: AgentWorker[];
    queue: QueuedTask[];
    activeTasks: number;
  } {
    return {
      workers: this.pool.workers,
      queue: this.pool.queue,
      activeTasks: this.pool.activeTasks.size,
    };
  }

  /**
   * Rebalance pool: redistribute work if agents struggling
   */
  rebalancePool(): void {
    const underperformers = this.pool.workers.filter((w) => w.successRate < 70);
    const overperformers = this.pool.workers.filter((w) => w.successRate > 90);

    if (underperformers.length > 0 && overperformers.length > 0) {
      // Pause underperformers, route tasks to overperformers
      underperformers.forEach((w) => {
        w.status = 'unavailable';
      });

      // Log rebalance event (would notify user in real implementation)
      console.log(
        `Rebalanced pool: paused ${underperformers.length} underperformers, routing to ${overperformers.length} overperformers`
      );
    }
  }

  /**
   * Helper: Get pool success rate average
   */
  private getPoolSuccessRate(): number {
    if (this.pool.workers.length === 0) return 100;
    return (
      this.pool.workers.reduce((sum, w) => sum + w.successRate, 0) /
      this.pool.workers.length
    );
  }
}

let instance: ExecutionScalingService | null = null;

export function getExecutionScalingService(): ExecutionScalingService {
  if (!instance) {
    instance = new ExecutionScalingService();
  }
  return instance;
}
