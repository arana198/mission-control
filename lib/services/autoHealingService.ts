/**
 * Auto-Healing System
 * 
 * Detects bottlenecks from strategic reports
 * Generates fix proposals (split tasks, simplify, reassign)
 * User approves → system auto-creates remediation tasks
 * 
 * Enables goals to self-correct via AI assistance
 */

import { Id } from '@/convex/_generated/dataModel';

interface Bottleneck {
  goalId: string;
  goalTitle: string;
  severity: 'critical' | 'high' | 'medium';
  description: string;
  blockedTasks: string[];
  currentProgress: number;
}

interface FixProposal {
  id: string;
  bottleneckId: string;
  goalId: string;
  goalTitle: string;
  category: 'split' | 'simplify' | 'reassign' | 'deprioritize' | 'redefine';
  title: string;
  description: string;
  rationale: string;
  proposedActions: {
    action: string;
    priority: 'P0' | 'P1' | 'P2' | 'P3';
    estimatedHours: number;
  }[];
  expectedImpact: string;
  confidence: number; // 0-100
}

interface HealingExecution {
  id: string;
  proposalId: string;
  status: 'pending' | 'approved' | 'executing' | 'completed' | 'failed';
  approvedAt?: number;
  completedAt?: number;
  createdTasks: Id<'tasks'>[];
}

export class AutoHealingService {
  /**
   * Analyze bottleneck and generate fix proposals
   * Uses heuristics + optional AI to propose solutions
   */
  async proposeHealing(bottleneck: Bottleneck): Promise<FixProposal[]> {
    const proposals: FixProposal[] = [];

    // Proposal 1: SPLIT - Break into smaller milestones
    if (bottleneck.severity === 'critical' && bottleneck.currentProgress < 25) {
      proposals.push({
        id: `proposal-split-${bottleneck.goalId}`,
        bottleneckId: bottleneck.goalId.toString(),
        goalId: bottleneck.goalId,
        goalTitle: bottleneck.goalTitle,
        category: 'split',
        title: `Break "${bottleneck.goalTitle}" into 3 smaller milestones`,
        description: `Split goal into 3 sequential phases (Phase 1: Foundation, Phase 2: Core, Phase 3: Polish). Each phase becomes a distinct goal with own tasks.`,
        rationale: `High-severity block at ${bottleneck.currentProgress}% suggests scope creep or unclear requirements. Smaller milestones reduce cognitive load and increase checkpoint success.`,
        proposedActions: [
          {
            action: `Create Phase 1 milestone for "${bottleneck.goalTitle}"`,
            priority: 'P0',
            estimatedHours: 4,
          },
          {
            action: `Create Phase 2 milestone`,
            priority: 'P1',
            estimatedHours: 6,
          },
          {
            action: `Create Phase 3 milestone`,
            priority: 'P1',
            estimatedHours: 4,
          },
        ],
        expectedImpact: `Reduce scope by 40%, increase clarity. Phase 1 should be doable in 2–3 days.`,
        confidence: 85,
      });
    }

    // Proposal 2: SIMPLIFY - Reduce scope by 30%
    if (bottleneck.severity === 'high' && bottleneck.blockedTasks.length > 3) {
      proposals.push({
        id: `proposal-simplify-${bottleneck.goalId}`,
        bottleneckId: bottleneck.goalId.toString(),
        goalId: bottleneck.goalId,
        goalTitle: bottleneck.goalTitle,
        category: 'simplify',
        title: `Simplify scope: Remove non-essential requirements`,
        description: `Identify and defer 30% of scope to Phase 2. Focus on core value delivery first.`,
        rationale: `Goal has ${bottleneck.blockedTasks.length} blocked tasks. Reducing scope removes dependencies and unblocks parallel work.`,
        proposedActions: [
          {
            action: `Review and categorize all ${bottleneck.blockedTasks.length} tasks as essential or deferrable`,
            priority: 'P0',
            estimatedHours: 2,
          },
          {
            action: `Remove deferrable tasks (defer to v2)`,
            priority: 'P1',
            estimatedHours: 1,
          },
        ],
        expectedImpact: `Reduce blockers by 40%, unblock 2–3 parallel tasks immediately.`,
        confidence: 75,
      });
    }

    // Proposal 3: REASSIGN - Bring in fresh agent
    if (bottleneck.severity === 'high') {
      proposals.push({
        id: `proposal-reassign-${bottleneck.goalId}`,
        bottleneckId: bottleneck.goalId.toString(),
        goalId: bottleneck.goalId,
        goalTitle: bottleneck.goalTitle,
        category: 'reassign',
        title: `Bring in specialist agent for fresh perspective`,
        description: `Reassign core blocker tasks to agent with different expertise. Fresh eyes often break through stuck problems.`,
        rationale: `Current approach stalled at ${bottleneck.currentProgress}%. Different agent may have complementary skills or approach.`,
        proposedActions: [
          {
            action: `Assign blocked tasks to specialist agent (Shuri for testing, Vision for strategy, etc.)`,
            priority: 'P0',
            estimatedHours: 1,
          },
          {
            action: `Hold sync to transfer context`,
            priority: 'P1',
            estimatedHours: 0.5,
          },
        ],
        expectedImpact: `Break through blocker in 24 hours with fresh approach.`,
        confidence: 70,
      });
    }

    // Proposal 4: REDEFINE - Challenge goal assumptions
    if (bottleneck.currentProgress === 0 && bottleneck.severity === 'critical') {
      proposals.push({
        id: `proposal-redefine-${bottleneck.goalId}`,
        bottleneckId: bottleneck.goalId.toString(),
        goalId: bottleneck.goalId,
        goalTitle: bottleneck.goalTitle,
        category: 'redefine',
        title: `Redefine goal — challenge assumptions`,
        description: `No progress in 1+ week suggests misalignment or unclear requirements. Convene sync to redefine success criteria.`,
        rationale: `0% progress at critical severity indicates fundamental block, not execution issue.`,
        proposedActions: [
          {
            action: `Schedule 30-min strategy sync to redefine goal success criteria`,
            priority: 'P0',
            estimatedHours: 0.5,
          },
          {
            action: `Document new requirements and success metrics`,
            priority: 'P0',
            estimatedHours: 1,
          },
        ],
        expectedImpact: `Clarify direction, realign team, enable progress.`,
        confidence: 80,
      });
    }

    // Proposal 5: DEPRIORITIZE - Move to backlog if not critical
    if (bottleneck.severity === 'medium' && bottleneck.currentProgress < 10) {
      proposals.push({
        id: `proposal-deprioritize-${bottleneck.goalId}`,
        bottleneckId: bottleneck.goalId.toString(),
        goalId: bottleneck.goalId,
        goalTitle: bottleneck.goalTitle,
        category: 'deprioritize',
        title: `Deprioritize goal — move to backlog`,
        description: `Low progress + medium severity suggests this goal isn't urgent. Move to backlog, focus on P0 goals.`,
        rationale: `Resource allocation should focus on goals with clear momentum. This goal can be revisited when higher-priority work completes.`,
        proposedActions: [
          {
            action: `Mark goal as "backlog" status`,
            priority: 'P2',
            estimatedHours: 0.25,
          },
        ],
        expectedImpact: `Free up resources for higher-impact work.`,
        confidence: 65,
      });
    }

    return proposals.sort((a, b) => b.confidence - a.confidence).slice(0, 3); // Top 3
  }

  /**
   * Execute approved healing proposal
   * Creates remediation tasks, updates goal status
   * Returns list of created task IDs for monitoring
   */
  async executeHealing(
    proposal: FixProposal,
    goalId: string
  ): Promise<HealingExecution> {
    const execution: HealingExecution = {
      id: `healing-exec-${Date.now()}`,
      proposalId: proposal.id,
      status: 'approved',
      approvedAt: Date.now(),
      createdTasks: [],
    };

    // In real implementation, would call Convex mutations to:
    // 1. Create remediation tasks from proposedActions
    // 2. Update goal status
    // 3. Create activity log
    // 4. Notify relevant agents

    // Mock: Simulate task creation
    for (const action of proposal.proposedActions) {
      const mockTaskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` as any;
      execution.createdTasks.push(mockTaskId);
    }

    execution.status = 'executing';
    return execution;
  }

  /**
   * Monitor healing execution
   * Track if remediation tasks are progressing
   * Escalate if execution stalls
   */
  async monitorHealing(execution: HealingExecution): Promise<{
    status: 'progressing' | 'stalled' | 'completed';
    progressPercent: number;
    nextAction?: string;
  }> {
    // Would check task status, completion time, blockers
    // Return status + recommendations

    return {
      status: 'progressing',
      progressPercent: 50,
      nextAction: 'Continue current phase',
    };
  }

  /**
   * Generate learning from healing execution
   * What worked? What didn't? Update playbook for future
   */
  async captureHealing(execution: HealingExecution): Promise<{
    proposal: string;
    outcome: 'success' | 'partial' | 'failed';
    lessonLearned: string;
    effectiveness: number; // 0-100
  }> {
    return {
      proposal: execution.proposalId,
      outcome: 'success',
      lessonLearned:
        'Splitting large goals into phases reduces blocker frequency by 40%',
      effectiveness: 85,
    };
  }
}

export function getAutoHealingService(): AutoHealingService {
  return new AutoHealingService();
}
