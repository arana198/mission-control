/**
 * Execution Service
 * 
 * Runs AI tasks autonomously via OpenClaw sessions_spawn
 * Handles retries, status updates, and completion tracking
 */

import { ConvexClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

interface ExecutionResult {
  success: boolean;
  output: string;
  timeSpent: number;  // minutes
  nextAction?: string;
  error?: string;
}

interface ExecutionConfig {
  maxRetries: number;
  timeoutMinutes: number;
  agentId?: string;
}

const DEFAULT_CONFIG: ExecutionConfig = {
  maxRetries: 2,
  timeoutMinutes: 30,
};

class ExecutionService {
  private client: ConvexClient;

  constructor(client: ConvexClient) {
    this.client = client;
  }

  /**
   * Execute a task immediately
   * 
   * Spawns a sub-agent session to run the task
   * Updates task status and logs execution
   */
  async executeTask(
    taskId: Id<'tasks'>,
    config: Partial<ExecutionConfig> = {}
  ): Promise<ExecutionResult> {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };

    // Get task details
    const task = await this.client.query(api.tasks.getTaskById, { taskId });
    if (!task) {
      return {
        success: false,
        output: '',
        timeSpent: 0,
        error: 'Task not found',
      };
    }

    // Mark as in progress
    await this.client.mutation(api.tasks.moveStatus, {
      taskId,
      fromStatus: task.status,
      toStatus: 'in_progress',
    });

    const startTime = Date.now();
    let result: ExecutionResult = {
      success: false,
      output: '',
      timeSpent: 0,
    };

    try {
      // Execute via OpenClaw (spawns sub-agent)
      result = await this.spawnExecution(task, finalConfig);
    } catch (error) {
      result = {
        success: false,
        output: '',
        timeSpent: Math.round((Date.now() - startTime) / 1000 / 60),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    const endTime = Date.now();
    const timeSpentMs = endTime - startTime;
    const timeSpentHours = timeSpentMs / 1000 / 60 / 60;

    // Update task with result
    await this.client.mutation(api.tasks.update, {
      id: taskId,
      status: result.success ? 'done' : 'blocked',
      actualHours: timeSpentHours,
      completionNotes: result.output || result.error || 'No output',
      completedAt: result.success ? endTime : undefined,
    } as any);

    // Log execution
    await this.logExecution({
      taskId,
      status: result.success ? 'success' : 'failed',
      output: result.output,
      error: result.error,
      timeSpent: Math.round(timeSpentMs / 1000 / 60),
      attemptNumber: 1,
    });

    return result;
  }

  /**
   * Schedule task for future execution
   * 
   * Finds a free time slot and creates calendar event
   */
  async scheduleForExecution(
    taskId: Id<'tasks'>,
    when: 'now' | 'today' | 'tomorrow' | number,
    estimatedHours: number = 1
  ): Promise<{ eventId: Id<'calendarEvents'>; scheduledFor: number }> {
    const task = await this.client.query(api.tasks.getTaskById, { taskId });
    if (!task) {
      throw new Error('Task not found');
    }

    // Determine start time
    let startTime: number;

    if (when === 'now') {
      startTime = Date.now();
    } else if (when === 'today') {
      const now = new Date();
      startTime = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        14,
        0 // 2 PM
      ).getTime();
    } else if (when === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      startTime = new Date(
        tomorrow.getFullYear(),
        tomorrow.getMonth(),
        tomorrow.getDate(),
        9,
        0 // 9 AM
      ).getTime();
    } else {
      startTime = when;
    }

    // Schedule calendar event
    const eventId = await this.client.mutation(
      api.calendarEvents.scheduleTaskEvent,
      {
        taskId,
        startTime,
        durationHours: estimatedHours,
        generatedBy: 'ExecutionService',
        goalIds: task.goalIds,
      }
    );

    return { eventId, scheduledFor: startTime };
  }

  /**
   * Retry a failed task
   */
  async retryFailedTask(
    taskId: Id<'tasks'>,
    reason: string,
    delayMinutes: number = 30
  ): Promise<void> {
    const task = await this.client.query(api.tasks.getTaskById, { taskId });
    if (!task) throw new Error('Task not found');

    // Log retry attempt
    await this.logExecution({
      taskId,
      status: 'retry',
      output: `Scheduled for retry: ${reason}`,
      timeSpent: 0,
      attemptNumber: 1,
    });

    // Schedule for future execution
    const retryTime = Date.now() + delayMinutes * 60 * 1000;
    await this.scheduleForExecution(taskId, retryTime);
  }

  /**
   * Spawn execution via OpenClaw sessions_spawn
   * 
   * In production, this would call OpenClaw's sessions_spawn API
   * For now, we stub it to return a result
   */
  private async spawnExecution(
    task: any,
    config: ExecutionConfig
  ): Promise<ExecutionResult> {
    // Build task prompt
    const prompt = `
Task: ${task.title}

Description:
${task.description}

Requirements:
- Complete the work described above
- Take appropriate actions
- Report results clearly

You have ${config.timeoutMinutes} minutes to complete this task.
    `.trim();

    try {
      // In production: await sessions_spawn({ task: prompt, label: `exec:${task._id}` })
      // For now, return success stub
      return {
        success: true,
        output: `Task completed: ${task.title}\n\nWork completed successfully.`,
        timeSpent: 15,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Log execution to execution log
   */
  private async logExecution(args: {
    taskId: Id<'tasks'>;
    status: 'started' | 'success' | 'failed' | 'incomplete' | 'retry';
    output?: string;
    error?: string;
    timeSpent: number;
    attemptNumber: number;
  }): Promise<void> {
    try {
      await this.client.mutation(api.executionLog.create, {
        taskId: args.taskId,
        status: args.status as any,
        output: args.output,
        error: args.error,
        timeSpent: args.timeSpent,
        attemptNumber: args.attemptNumber,
      });
    } catch (error) {
      console.error('Failed to log execution:', error);
    }
  }

  /**
   * Get execution history for a task
   */
  async getExecutionHistory(taskId: Id<'tasks'>): Promise<any[]> {
    return this.client.query(api.executionLog.getByTask, { taskId });
  }
}

export { ExecutionService };
export type { ExecutionResult, ExecutionConfig };
