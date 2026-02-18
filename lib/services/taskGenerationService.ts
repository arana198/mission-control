/**
 * Task Generation Service
 * 
 * Analyzes goals + memory to generate high-leverage tasks
 * Powers the daily morning review and weekly strategic planning
 */

import { getMemoryService, type MemorySection } from './memoryService';
import { ConvexClient } from 'convex/browser';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

/** Convex client type - accepts both browser and HTTP clients */
type ConvexClientType = ConvexClient | ConvexHttpClient;

interface Goal {
  _id: Id<'goals'>;
  title: string;
  description: string;
  category: string;
  status: string;
  progress: number;
  relatedTaskIds: Id<'tasks'>[];
  relatedMemoryRefs: string[];
  keyResults?: string[];
}

interface TaskInput {
  title: string;
  description: string;
  goalIds: Id<'goals'>[];
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  impact: 'P0' | 'P1' | 'P2' | 'P3';
  estimatedHours: number;
  generatedBy: string; // Agent name
  generationReason: string;
  relatedMemoryKeys: string[];
}

interface StrategicReview {
  dailyTasks: TaskInput[];
  focusPriorities: string[];
  emergencies: string[];
  context: {
    totalActiveGoals: number;
    blockedGoalsCount: number;
    overallProgress: number;
  };
}

interface WeeklyPlan {
  tasks: TaskInput[];
  report: {
    week: number;
    year: number;
    goalsReview: {
      activeGoals: number;
      completedThisWeek: Id<'goals'>[];
      blockedGoals: Id<'goals'>[];
      acceleratingGoals: Id<'goals'>[];
    };
    taskMetrics: {
      tasksGenerated: number;
      tasksCompleted: number;
      avgCompletionRate: number;
      avgTimePerTask: number;
      blockedBy: string[];
    };
    insights: string[];
    recommendations: string[];
  };
  recommendations: string[];
}

class TaskGenerationService {
  private memoryService = getMemoryService();
  private convexClient: ConvexClientType;

  constructor(convexClient: ConvexClientType) {
    this.convexClient = convexClient;
  }

  /**
   * Daily Morning Review
   * 
   * Called at 08:00 each day
   * Reviews goals, identifies blockers, generates 3-5 high-impact tasks
   */
  async generateDailyTasks(goals: Goal[]): Promise<StrategicReview> {
    const activeGoals = goals.filter(g => g.status === 'active');
    const blockedGoals = activeGoals.filter(g => g.progress <= 25);
    const overallProgress = activeGoals.length > 0
      ? Math.round(activeGoals.reduce((sum, g) => sum + g.progress, 0) / activeGoals.length)
      : 0;

    // Identify what needs focus
    const focusPriorities = this.identifyFocusAreas(activeGoals);
    const emergencies = this.detectEmergencies(blockedGoals);

    // Generate tasks
    const tasks: TaskInput[] = [];

    // Priority 1: Unblock stuck goals
    for (const goal of blockedGoals.slice(0, 2)) {
      const unblockTask = await this.generateUnblockingTask(goal);
      if (unblockTask) tasks.push(unblockTask);
    }

    // Priority 2: Advance top goals
    for (const goal of activeGoals.slice(0, 3)) {
      if (goal.progress < 100) {
        const advanceTask = await this.generateAdvancingTask(goal);
        if (advanceTask) tasks.push(advanceTask);
      }
    }

    // Limit to 5 tasks per day (avoid overwhelm)
    const finalTasks = this.prioritizeTasks(tasks).slice(0, 5);

    return {
      dailyTasks: finalTasks,
      focusPriorities,
      emergencies,
      context: {
        totalActiveGoals: activeGoals.length,
        blockedGoalsCount: blockedGoals.length,
        overallProgress,
      },
    };
  }

  /**
   * Weekly Strategic Review
   * 
   * Deep analysis of progress, bottlenecks, and strategy pivots
   */
  async generateWeeklyPlan(
    goals: Goal[],
    completedTasks: any[]
  ): Promise<WeeklyPlan> {
    const activeGoals = goals.filter(g => g.status === 'active');
    const blockedGoals = activeGoals.filter(g => g.progress <= 25);
    const acceleratingGoals = activeGoals.filter(g => g.progress >= 75);

    // Calculate metrics
    const thisWeekCompleted = completedTasks.filter(
      t => t.completedAt && Date.now() - t.completedAt < 7 * 24 * 60 * 60 * 1000
    );

    const totalThisWeek = thisWeekCompleted.length + 5; // Assume 5 new tasks today
    const completionRate = totalThisWeek > 0
      ? Math.round((thisWeekCompleted.length / totalThisWeek) * 100)
      : 0;

    const avgTime = thisWeekCompleted.length > 0
      ? thisWeekCompleted.reduce((sum, t) => sum + (t.actualHours || 0), 0) /
        thisWeekCompleted.length
      : 0;

    // Generate weekly tasks (more ambitious)
    const tasks: TaskInput[] = [];

    // 1. Unblock high-impact goals
    for (const goal of blockedGoals.slice(0, 1)) {
      const blockAnalysis = await this.analyzeBlockers(goal);
      const task = await this.generateUnblockingTask(goal);
      if (task && blockAnalysis.root) {
        task.generationReason = `Unblock "${goal.title}": ${blockAnalysis.root}`;
        tasks.push(task);
      }
    }

    // 2. Push accelerating goals (compound momentum)
    for (const goal of acceleratingGoals.slice(0, 2)) {
      const scaleTask = await this.generateScalingTask(goal);
      if (scaleTask) tasks.push(scaleTask);
    }

    // 3. Strategic research for top goals
    for (const goal of activeGoals.slice(0, 2)) {
      const researchTask = await this.generateResearchTask(goal);
      if (researchTask) tasks.push(researchTask);
    }

    const finalTasks = this.prioritizeTasks(tasks).slice(0, 5);

    // Generate insights
    const insights = this.generateInsights(
      activeGoals,
      blockedGoals,
      completionRate
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      blockedGoals,
      acceleratingGoals,
      completionRate
    );

    // Calculate week/year
    const now = new Date();
    const week = Math.ceil(
      (now.getDate() -
        new Date(now.getFullYear(), 0, 1).getDate()) / 7
    );

    return {
      tasks: finalTasks,
      report: {
        week,
        year: now.getFullYear(),
        goalsReview: {
          activeGoals: activeGoals.length,
          completedThisWeek: goals.filter(g => g.status === 'completed')
            .map(g => g._id)
            .slice(0, 10) as Id<'goals'>[],
          blockedGoals: blockedGoals.map(g => g._id),
          acceleratingGoals: acceleratingGoals.map(g => g._id),
        },
        taskMetrics: {
          tasksGenerated: finalTasks.length,
          tasksCompleted: thisWeekCompleted.length,
          avgCompletionRate: completionRate,
          avgTimePerTask: avgTime,
          blockedBy: blockedGoals.map(g => g.title),
        },
        insights,
        recommendations,
      },
      recommendations,
    };
  }

  /**
   * Generate a task to unblock a stuck goal
   */
  private async generateUnblockingTask(goal: Goal): Promise<TaskInput | null> {
    const context = await this.memoryService.getEntityContext(
      goal.title,
      'goal'
    );

    if (!context.relevantSections.length) {
      return null;
    }

    const blockAnalysis = await this.analyzeBlockers(goal);

    return {
      title: `Unblock: ${goal.title}`,
      description: `
Goal: ${goal.title}
Current blocker: ${blockAnalysis.blockers[0] || 'unclear'}
Required action: ${blockAnalysis.requiredAction}

Context: ${context.relevantSections[0]?.snippet || 'See memory'}
      `.trim(),
      goalIds: [goal._id],
      priority: 'P0',
      impact: 'P0',
      estimatedHours: 2,
      generatedBy: 'StrategicPlannerEngine',
      generationReason: `Goal "${goal.title}" is blocked (${goal.progress}% progress)`,
      relatedMemoryKeys: context.relevantSections.map((s: any) => s.path),
    };
  }

  /**
   * Generate a task to advance progress on a goal
   */
  private async generateAdvancingTask(goal: Goal): Promise<TaskInput | null> {
    const context = await this.memoryService.getEntityContext(
      goal.title,
      'goal'
    );

    return {
      title: `Advance: ${goal.title}`,
      description: `
Goal: ${goal.title}
Current progress: ${goal.progress}%
Next milestone: Reach ${Math.min(goal.progress + 25, 100)}%

Key results: ${goal.keyResults?.join(', ') || 'TBD'}
Related context: ${context.relevantSections[0]?.snippet || 'See memory'}
      `.trim(),
      goalIds: [goal._id],
      priority: 'P1',
      impact: 'P1',
      estimatedHours: 3,
      generatedBy: 'StrategicPlannerEngine',
      generationReason: `Advance goal "${goal.title}" from ${goal.progress}% progress`,
      relatedMemoryKeys: context.relevantSections.map((s: any) => s.path),
    };
  }

  /**
   * Generate a research task for strategic exploration
   */
  private async generateResearchTask(goal: Goal): Promise<TaskInput | null> {
    const context = await this.memoryService.getEntityContext(
      goal.title,
      'goal'
    );

    if (goal.progress > 75) return null; // Skip if already advanced

    return {
      title: `Research: ${goal.title} strategy`,
      description: `
Objective: Gather strategic insights for "${goal.title}"

Current understanding: ${goal.description.substring(0, 200)}

Search for:
- Market dynamics
- Competitive approaches
- Success patterns
- Failure modes

Document findings in memory.
      `.trim(),
      goalIds: [goal._id],
      priority: 'P2',
      impact: 'P2',
      estimatedHours: 1.5,
      generatedBy: 'StrategicPlannerEngine',
      generationReason: `Research strategy for "${goal.title}"`,
      relatedMemoryKeys: context.relevantSections.map((s: any) => s.path),
    };
  }

  /**
   * Generate a scaling task for accelerating goals
   */
  private async generateScalingTask(goal: Goal): Promise<TaskInput | null> {
    return {
      title: `Scale: ${goal.title}`,
      description: `
Goal: ${goal.title} (${goal.progress}% complete)

Current velocity is strong. Identify:
- How to 2x output
- Key bottleneck to remove
- Resource requirements
- Timeline to next milestone

Document scaling plan.
      `.trim(),
      goalIds: [goal._id],
      priority: 'P1',
      impact: 'P1',
      estimatedHours: 2,
      generatedBy: 'StrategicPlannerEngine',
      generationReason: `Accelerate "${goal.title}" (${goal.progress}% progress)`,
      relatedMemoryKeys: [],
    };
  }

  /**
   * Analyze what's blocking a goal
   */
  private async analyzeBlockers(goal: Goal): Promise<{
    blockers: string[];
    root: string | null;
    requiredAction: string;
  }> {
    // Fetch related tasks to see what's stuck
    const taskIds = goal.relatedTaskIds.slice(0, 10);

    // Note: In real implementation, would fetch task statuses
    // For now, return generic analysis

    return {
      blockers: [
        'Unclear next steps',
        'Resource constraint',
        'External dependency',
      ],
      root: 'Momentum loss from previous week',
      requiredAction: 'Review goal scope and identify one critical next action',
    };
  }

  /**
   * Identify key focus areas from goal portfolio
   */
  private identifyFocusAreas(goals: Goal[]): string[] {
    const categories = new Map<string, number>();

    goals.forEach(g => {
      categories.set(g.category, (categories.get(g.category) || 0) + 1);
    });

    return Array.from(categories.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat, count]) => `${cat} (${count} active goals)`);
  }

  /**
   * Detect emergencies (severely blocked goals)
   */
  private detectEmergencies(blockedGoals: Goal[]): string[] {
    return blockedGoals
      .filter(g => g.progress === 0)
      .slice(0, 2)
      .map(g => `${g.title} (0% progress)`);
  }

  /**
   * Prioritize tasks by impact + urgency
   */
  private prioritizeTasks(tasks: TaskInput[]): TaskInput[] {
    const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };

    return [...tasks].sort((a, b) => {
      const impactDiff =
        priorityOrder[a.impact as keyof typeof priorityOrder] -
        priorityOrder[b.impact as keyof typeof priorityOrder];

      if (impactDiff !== 0) return impactDiff;

      // Secondary sort by priority
      return (
        priorityOrder[a.priority as keyof typeof priorityOrder] -
        priorityOrder[b.priority as keyof typeof priorityOrder]
      );
    });
  }

  /**
   * Generate week insights
   */
  private generateInsights(
    goals: Goal[],
    blockedGoals: Goal[],
    completionRate: number
  ): string[] {
    const insights: string[] = [];

    if (blockedGoals.length > 0) {
      insights.push(
        `${blockedGoals.length} goal(s) are blocked or stalled. Prioritize unblocking.`
      );
    }

    if (completionRate < 50) {
      insights.push('Task completion rate is below 50%. Reduce scope or increase resources.');
    }

    if (goals.length > 10) {
      insights.push('Portfolio is large. Consider consolidating or pausing low-impact goals.');
    }

    if (insights.length === 0) {
      insights.push('Progress is steady. Maintain current pace.');
    }

    return insights;
  }

  /**
   * Generate strategic recommendations
   */
  private generateRecommendations(
    blockedGoals: Goal[],
    acceleratingGoals: Goal[],
    completionRate: number
  ): string[] {
    const recommendations: string[] = [];

    // Unblocking strategy
    if (blockedGoals.length > 0) {
      recommendations.push(
        `Unblock highest-impact goal: "${blockedGoals[0].title}"`
      );
    }

    // Acceleration strategy
    if (acceleratingGoals.length > 0) {
      recommendations.push(
        `Accelerate momentum on "${acceleratingGoals[0].title}" (${acceleratingGoals[0].progress}% complete)`
      );
    }

    // Velocity strategy
    if (completionRate > 80) {
      recommendations.push('Take on additional strategic goals next week');
    } else if (completionRate < 50) {
      recommendations.push('Focus on completing in-progress work before starting new tasks');
    }

    return recommendations;
  }
}

let instance: TaskGenerationService | null = null;

export function getTaskGenerationService(client: any): TaskGenerationService {
  if (!instance) {
    instance = new TaskGenerationService(client);
  }
  return instance;
}

export { TaskGenerationService };
export type { TaskInput, StrategicReview, WeeklyPlan };
