/**
 * Strategic Planning Engine
 * 
 * Generates weekly reports, identifies bottlenecks, and makes recommendations
 * Integrates with GoalService + ExecutionLog + MemoryService
 * 
 * Core Logic:
 * - Analyze goal progress (calculate from linked tasks)
 * - Detect bottlenecks (goals stuck <25% for >1 week)
 * - Generate insights (patterns in execution logs)
 * - Recommend actions (based on leverage analysis)
 */

import { ConvexClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { getMemoryService } from './memoryService';
import { Id } from '@/convex/_generated/dataModel';

interface GoalProgress {
  goalId: Id<'goals'>;
  title: string;
  progress: number;
  relatedTasksCount: number;
  completedTasksCount: number;
  blockedTasksCount: number;
  status: 'accelerating' | 'onTrack' | 'atRisk' | 'blocked';
  lastUpdated: number;
}

interface ExecutionMetrics {
  tasksGenerated: number;
  tasksCompleted: number;
  tasksBlocked: number;
  avgCompletionTime: number; // hours
  avgCompletionRate: number; // percentage
  totalTimeInProgress: number; // hours
}

interface Bottleneck {
  goalId: Id<'goals'>;
  goalTitle: string;
  severity: 'critical' | 'high' | 'medium'; // critical if <25%, high if <50%
  description: string;
  blockedTasks: string[];
  suggestedActions: string[];
  relatedMemory: string[];
}

interface StrategicInsight {
  category: 'pattern' | 'trend' | 'anomaly' | 'opportunity';
  title: string;
  description: string;
  dataPoints: number;
  recommendation: string;
  impact: 'high' | 'medium' | 'low';
}

interface WeeklyReport {
  week: number;
  year: number;
  generatedAt: number;
  
  // Analysis
  goalAnalysis: {
    accelerating: GoalProgress[];
    onTrack: GoalProgress[];
    atRisk: GoalProgress[];
    blocked: GoalProgress[];
  };
  
  executionMetrics: ExecutionMetrics;
  bottlenecks: Bottleneck[];
  insights: StrategicInsight[];
  recommendations: string[];
  
  // Context
  memoryReferences: string[];
  nextActions: Array<{
    action: string;
    priority: 'P0' | 'P1' | 'P2' | 'P3';
    estimatedHours: number;
  }>;
}

export class StrategicPlanningEngine {
  private memoryService = getMemoryService();
  private client: any; // Accept both ConvexClient and ConvexHttpClient

  constructor(client: any) {
    this.client = client;
  }

  /**
   * Generate weekly strategic report
   * 
   * Called every Sunday evening or manually triggered
   * Analyzes last 7 days of execution + goal progress
   */
  async generateWeeklyReport(): Promise<WeeklyReport> {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    
    // Get all data in parallel
    const [goals, executionLogs, activities] = await Promise.all([
      this.client.query(api.goals.getByProgress),
      this.client.query(api.executionLog.getByStatus, {
        status: 'success',
      }),
      this.client.query(api.activities.getRecent, {
        limit: 100,
      }),
    ]);

    // Filter execution logs to last 7 days client-side
    const recentExecutionLogs = Array.isArray(executionLogs)
      ? executionLogs.filter((log: any) => log._creationTime >= weekAgo)
      : [];

    // Calculate goal progress
    const goalAnalysis = this.analyzeGoalProgress(goals);
    
    // Calculate execution metrics
    const executionMetrics = this.calculateExecutionMetrics(recentExecutionLogs);
    
    // Detect bottlenecks
    const bottlenecks = await this.detectBottlenecks(goalAnalysis, recentExecutionLogs);
    
    // Generate insights from patterns
    const insights = await this.generateInsights(
      goalAnalysis,
      executionMetrics,
      activities
    );
    
    // Surface relevant memory
    const memoryReferences = await this.surfaceRelevantMemory(goalAnalysis);
    
    // Create recommendations
    const recommendations = this.createRecommendations(
      bottlenecks,
      insights,
      goalAnalysis
    );
    
    // Generate next actions
    const nextActions = this.generateNextActions(
      recommendations,
      goalAnalysis,
      bottlenecks
    );

    // Calculate week number
    const date = new Date(now);
    const weekNumber = this.getWeekNumber(date);
    const year = date.getFullYear();

    return {
      week: weekNumber,
      year,
      generatedAt: now,
      goalAnalysis,
      executionMetrics,
      bottlenecks,
      insights,
      recommendations,
      memoryReferences,
      nextActions,
    };
  }

  /**
   * Analyze goal progress and categorize
   * Uses pre-computed progress from getByProgress query
   */
  private analyzeGoalProgress(goalsData: any): WeeklyReport['goalAnalysis'] {
    const accelerating: GoalProgress[] = [];
    const onTrack: GoalProgress[] = [];
    const atRisk: GoalProgress[] = [];
    const blocked: GoalProgress[] = [];

    // goalsData comes from api.goals.getByProgress and has structure:
    // { accelerating: [], onTrack: [], atRisk: [], blocked: [] }
    const allGoals = [
      ...(goalsData.accelerating || []),
      ...(goalsData.onTrack || []),
      ...(goalsData.atRisk || []),
      ...(goalsData.blocked || []),
    ];

    for (const goal of allGoals) {
      const goalData = goal as any;
      // Progress is already calculated by the Convex query
      const progress = goalData.progress || 0;
      const status = this.categorizeGoalStatus(progress);

      const progressData: GoalProgress = {
        goalId: goalData._id,
        title: goalData.title,
        progress,
        relatedTasksCount: goalData.relatedTaskIds?.length || 0,
        completedTasksCount: Math.round(goalData.relatedTaskIds?.length * (progress / 100)) || 0,
        blockedTasksCount: 0, // Will be calculated from execution logs
        status,
        lastUpdated: goalData.updatedAt,
      };

      switch (status) {
        case 'accelerating':
          accelerating.push(progressData);
          break;
        case 'onTrack':
          onTrack.push(progressData);
          break;
        case 'atRisk':
          atRisk.push(progressData);
          break;
        case 'blocked':
          blocked.push(progressData);
          break;
      }
    }

    return {
      accelerating: accelerating.sort((a, b) => b.progress - a.progress),
      onTrack: onTrack.sort((a, b) => b.progress - a.progress),
      atRisk: atRisk.sort((a, b) => b.progress - a.progress),
      blocked: blocked.sort((a, b) => b.progress - a.progress),
    };
  }

  /**
   * Categorize goal status by progress
   */
  private categorizeGoalStatus(
    progress: number
  ): 'accelerating' | 'onTrack' | 'atRisk' | 'blocked' {
    if (progress >= 75) return 'accelerating';
    if (progress >= 50) return 'onTrack';
    if (progress >= 25) return 'atRisk';
    return 'blocked';
  }

  /**
   * Calculate execution metrics for the period
   */
  private calculateExecutionMetrics(executionLogs: any[]): ExecutionMetrics {
    const completed = executionLogs.filter(
      (log: any) => log.status === 'success'
    ).length;
    const blocked = executionLogs.filter(
      (log: any) => log.status === 'failed'
    ).length;
    const total = executionLogs.length;

    const avgCompletionTime =
      completed > 0
        ? executionLogs
            .filter((log: any) => log.status === 'success')
            .reduce((sum: number, log: any) => sum + (log.timeSpent || 0), 0) /
          completed /
          60
        : 0;

    const totalTimeSpent = executionLogs.reduce(
      (sum: number, log: any) => sum + (log.timeSpent || 0),
      0
    );

    return {
      tasksGenerated: total,
      tasksCompleted: completed,
      tasksBlocked: blocked,
      avgCompletionTime: Math.round(avgCompletionTime * 10) / 10,
      avgCompletionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      totalTimeInProgress: Math.round((totalTimeSpent / 60) * 10) / 10,
    };
  }

  /**
   * Detect bottlenecks (goals stuck <25% for >1 week)
   */
  private async detectBottlenecks(
    goalAnalysis: WeeklyReport['goalAnalysis'],
    executionLogs: any[]
  ): Promise<Bottleneck[]> {
    const bottlenecks: Bottleneck[] = [];

    // Focus on blocked goals
    for (const goal of goalAnalysis.blocked) {
      const tasksForGoal = executionLogs.filter(
        (log: any) => log.taskId === goal.goalId
      );
      const failedTasks = tasksForGoal.filter(
        (log: any) => log.status === 'failed'
      );

      if (tasksForGoal.length > 0) {
        const failureRate = (failedTasks.length / tasksForGoal.length) * 100;

        // Determine severity
        let severity: 'critical' | 'high' | 'medium' = 'medium';
        if (goal.progress < 10 && failureRate > 50) severity = 'critical';
        else if (goal.progress < 25 && failureRate > 25) severity = 'high';

        const commonErrors = this.extractCommonErrors(failedTasks);

        bottlenecks.push({
          goalId: goal.goalId,
          goalTitle: goal.title,
          severity,
          description: `Goal at ${goal.progress}% completion with ${failureRate.toFixed(0)}% task failure rate`,
          blockedTasks: failedTasks
            .map((log: any) => log.taskId)
            .slice(0, 3),
          suggestedActions: this.suggestBottleneckActions(
            goal,
            failedTasks,
            commonErrors
          ),
          relatedMemory: await this.findRelatedMemory(goal.title),
        });
      }
    }

    return bottlenecks.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  /**
   * Extract common error patterns
   */
  private extractCommonErrors(failedTasks: any[]): string[] {
    const errorCounts: Record<string, number> = {};

    for (const task of failedTasks) {
      const error = task.error || 'unknown';
      errorCounts[error] = (errorCounts[error] || 0) + 1;
    }

    return Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([error]) => error);
  }

  /**
   * Suggest actions to resolve bottleneck
   */
  private suggestBottleneckActions(
    goal: GoalProgress,
    failedTasks: any[],
    errors: string[]
  ): string[] {
    const actions: string[] = [];

    if (errors.includes('timeout')) {
      actions.push('Increase task execution timeout or break into smaller tasks');
    }
    if (errors.includes('dependency_blocked')) {
      actions.push('Resolve upstream task dependencies');
    }
    if (goal.blockedTasksCount > goal.completedTasksCount) {
      actions.push('Consider reprioritizing or simplifying task requirements');
    }
    if (failedTasks.length > 2) {
      actions.push('Review goal scope and redefine measurable outcomes');
    }

    return actions.length > 0
      ? actions
      : ['Manually review goal requirements and strategy'];
  }

  /**
   * Generate strategic insights from patterns
   */
  private async generateInsights(
    goalAnalysis: WeeklyReport['goalAnalysis'],
    executionMetrics: ExecutionMetrics,
    activities: any[]
  ): Promise<StrategicInsight[]> {
    const insights: StrategicInsight[] = [];

    // Insight 1: Completion rate trend
    if (executionMetrics.avgCompletionRate >= 80) {
      insights.push({
        category: 'trend',
        title: 'Strong execution velocity',
        description: `${executionMetrics.avgCompletionRate}% of tasks completed successfully`,
        dataPoints: executionMetrics.tasksCompleted,
        recommendation:
          'Maintain current strategy; consider increasing scope slightly',
        impact: 'high',
      });
    } else if (executionMetrics.avgCompletionRate < 50) {
      insights.push({
        category: 'anomaly',
        title: 'Low completion rate detected',
        description: `Only ${executionMetrics.avgCompletionRate}% of tasks completed successfully`,
        dataPoints: executionMetrics.tasksBlocked,
        recommendation:
          'Investigate task complexity; may need to reduce scope or improve execution',
        impact: 'high',
      });
    }

    // Insight 2: Goal acceleration
    const acceleratingCount = goalAnalysis.accelerating.length;
    if (acceleratingCount > 0) {
      insights.push({
        category: 'trend',
        title: `${acceleratingCount} goals accelerating`,
        description: `${goalAnalysis.accelerating.map((g) => g.title).join(', ')}`,
        dataPoints: acceleratingCount,
        recommendation:
          'Prioritize resources to these goals; they have momentum',
        impact: 'medium',
      });
    }

    // Insight 3: Time efficiency
    if (executionMetrics.avgCompletionTime > 8) {
      insights.push({
        category: 'pattern',
        title: 'High average task duration',
        description: `Tasks taking ${executionMetrics.avgCompletionTime}h on average`,
        dataPoints: executionMetrics.tasksCompleted,
        recommendation:
          'Consider breaking tasks into smaller, more manageable units',
        impact: 'medium',
      });
    }

    return insights;
  }

  /**
   * Find related memory sections for a goal
   */
  private async findRelatedMemory(goalTitle: string): Promise<string[]> {
    const results = await this.memoryService.searchMemory(goalTitle, 3);
    return results.map((r) => r.path);
  }

  /**
   * Surface relevant memory context for a goal
   */
  private async surfaceRelevantMemory(
    goalAnalysis: WeeklyReport['goalAnalysis']
  ): Promise<string[]> {
    const allGoals = [
      ...goalAnalysis.accelerating,
      ...goalAnalysis.onTrack,
      ...goalAnalysis.atRisk,
      ...goalAnalysis.blocked,
    ];

    const memoryRefs = new Set<string>();
    for (const goal of allGoals.slice(0, 5)) {
      const refs = await this.findRelatedMemory(goal.title);
      refs.forEach((ref) => memoryRefs.add(ref));
    }

    return Array.from(memoryRefs);
  }

  /**
   * Create recommendations based on analysis
   */
  private createRecommendations(
    bottlenecks: Bottleneck[],
    insights: StrategicInsight[],
    goalAnalysis: WeeklyReport['goalAnalysis']
  ): string[] {
    const recommendations: string[] = [];

    // From bottlenecks
    for (const bottleneck of bottlenecks) {
      recommendations.push(
        `[${bottleneck.severity.toUpperCase()}] ${bottleneck.goalTitle}: ${bottleneck.suggestedActions[0]}`
      );
    }

    // From insights
    for (const insight of insights.filter((i) => i.impact === 'high')) {
      recommendations.push(`${insight.title}: ${insight.recommendation}`);
    }

    // General strategic recommendations
    if (goalAnalysis.blocked.length > goalAnalysis.accelerating.length) {
      recommendations.push(
        'More goals are blocked than accelerating. Review prioritization strategy.'
      );
    }

    return recommendations.slice(0, 5); // Top 5
  }

  /**
   * Generate actionable next steps
   */
  private generateNextActions(
    recommendations: string[],
    goalAnalysis: WeeklyReport['goalAnalysis'],
    bottlenecks: Bottleneck[]
  ): Array<{
    action: string;
    priority: 'P0' | 'P1' | 'P2' | 'P3';
    estimatedHours: number;
  }> {
    const actions: Array<{
      action: string;
      priority: 'P0' | 'P1' | 'P2' | 'P3';
      estimatedHours: number;
    }> = [];

    // P0: Critical bottlenecks
    for (const bottleneck of bottlenecks.filter(
      (b) => b.severity === 'critical'
    )) {
      actions.push({
        action: `Fix critical blocker for ${bottleneck.goalTitle}`,
        priority: 'P0',
        estimatedHours: 4,
      });
    }

    // P1: Accelerate high-momentum goals
    for (const goal of goalAnalysis.accelerating.slice(0, 2)) {
      actions.push({
        action: `Allocate resources to accelerate ${goal.title}`,
        priority: 'P1',
        estimatedHours: 3,
      });
    }

    // P2: Address at-risk goals
    for (const goal of goalAnalysis.atRisk.slice(0, 1)) {
      actions.push({
        action: `Review and adjust strategy for ${goal.title}`,
        priority: 'P2',
        estimatedHours: 2,
      });
    }

    return actions.slice(0, 5);
  }

  /**
   * Helper: Get ISO week number
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(
      ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
    );
  }
}

export function getStrategicPlanningEngine(
  client: any // Accept both ConvexClient and ConvexHttpClient
): StrategicPlanningEngine {
  return new StrategicPlanningEngine(client);
}
