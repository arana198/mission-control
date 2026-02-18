/**
 * Auto-healing service tests
 */

import {
  AutoHealingService,
  getAutoHealingService,
} from "../autoHealingService";
import { Id } from "@/convex/_generated/dataModel";

describe("AutoHealingService", () => {
  let service: AutoHealingService;

  beforeEach(() => {
    service = new AutoHealingService();
  });

  describe("proposeHealing", () => {
    describe("split proposal", () => {
      it("generates split proposal for critical bottleneck at <25% progress", async () => {
        const bottleneck = {
          goalId: "goal-1" as Id<"goals">,
          goalTitle: "Build MVP",
          severity: "critical" as const,
          description: "Stuck on foundation",
          blockedTasks: ["task-1", "task-2"],
          currentProgress: 10,
        };

        const proposals = await service.proposeHealing(bottleneck);

        expect(proposals).toContainEqual(
          expect.objectContaining({
            category: "split",
            confidence: 85,
          })
        );
      });

      it("does not generate split proposal for non-critical or >25% progress", async () => {
        const bottleneck = {
          goalId: "goal-1" as Id<"goals">,
          goalTitle: "Build MVP",
          severity: "high" as const,
          description: "Some progress",
          blockedTasks: ["task-1"],
          currentProgress: 30,
        };

        const proposals = await service.proposeHealing(bottleneck);

        const splitProposal = proposals.find((p) => p.category === "split");
        expect(splitProposal).toBeUndefined();
      });
    });

    describe("simplify proposal", () => {
      it("generates simplify proposal for high severity with >3 blocked tasks", async () => {
        const bottleneck = {
          goalId: "goal-2" as Id<"goals">,
          goalTitle: "Release v2",
          severity: "high" as const,
          description: "Too many blockers",
          blockedTasks: ["task-1", "task-2", "task-3", "task-4"],
          currentProgress: 40,
        };

        const proposals = await service.proposeHealing(bottleneck);

        expect(proposals).toContainEqual(
          expect.objectContaining({
            category: "simplify",
            confidence: 75,
          })
        );
      });

      it("does not generate simplify for <=3 blocked tasks", async () => {
        const bottleneck = {
          goalId: "goal-2" as Id<"goals">,
          goalTitle: "Release v2",
          severity: "high" as const,
          description: "Few blockers",
          blockedTasks: ["task-1", "task-2"],
          currentProgress: 40,
        };

        const proposals = await service.proposeHealing(bottleneck);

        const simplifyProposal = proposals.find((p) => p.category === "simplify");
        expect(simplifyProposal).toBeUndefined();
      });
    });

    describe("reassign proposal", () => {
      it("generates reassign proposal for high severity", async () => {
        const bottleneck = {
          goalId: "goal-3" as Id<"goals">,
          goalTitle: "Infrastructure",
          severity: "high" as const,
          description: "Needs expertise",
          blockedTasks: ["task-1"],
          currentProgress: 20,
        };

        const proposals = await service.proposeHealing(bottleneck);

        expect(proposals).toContainEqual(
          expect.objectContaining({
            category: "reassign",
            confidence: 70,
          })
        );
      });

      it("does not generate reassign for non-high severity", async () => {
        const bottleneck = {
          goalId: "goal-3" as Id<"goals">,
          goalTitle: "Infrastructure",
          severity: "medium" as const,
          description: "Needs expertise",
          blockedTasks: ["task-1"],
          currentProgress: 20,
        };

        const proposals = await service.proposeHealing(bottleneck);

        const reassignProposal = proposals.find((p) => p.category === "reassign");
        expect(reassignProposal).toBeUndefined();
      });
    });

    describe("redefine proposal", () => {
      it("generates redefine proposal for critical with 0% progress", async () => {
        const bottleneck = {
          goalId: "goal-4" as Id<"goals">,
          goalTitle: "Strategy",
          severity: "critical" as const,
          description: "No progress at all",
          blockedTasks: ["task-1"],
          currentProgress: 0,
        };

        const proposals = await service.proposeHealing(bottleneck);

        expect(proposals).toContainEqual(
          expect.objectContaining({
            category: "redefine",
            confidence: 80,
          })
        );
      });

      it("does not generate redefine for non-critical or >0% progress", async () => {
        const bottleneck = {
          goalId: "goal-4" as Id<"goals">,
          goalTitle: "Strategy",
          severity: "critical" as const,
          description: "Some progress",
          blockedTasks: ["task-1"],
          currentProgress: 5,
        };

        const proposals = await service.proposeHealing(bottleneck);

        const redefineProposal = proposals.find((p) => p.category === "redefine");
        expect(redefineProposal).toBeUndefined();
      });
    });

    describe("deprioritize proposal", () => {
      it("generates deprioritize proposal for medium severity with <10% progress", async () => {
        const bottleneck = {
          goalId: "goal-5" as Id<"goals">,
          goalTitle: "Nice to have",
          severity: "medium" as const,
          description: "Low priority",
          blockedTasks: ["task-1"],
          currentProgress: 5,
        };

        const proposals = await service.proposeHealing(bottleneck);

        expect(proposals).toContainEqual(
          expect.objectContaining({
            category: "deprioritize",
            confidence: 65,
          })
        );
      });

      it("does not generate deprioritize for non-medium or >=10% progress", async () => {
        const bottleneck = {
          goalId: "goal-5" as Id<"goals">,
          goalTitle: "Nice to have",
          severity: "medium" as const,
          description: "Some progress",
          blockedTasks: ["task-1"],
          currentProgress: 15,
        };

        const proposals = await service.proposeHealing(bottleneck);

        const deprioritizeProposal = proposals.find(
          (p) => p.category === "deprioritize"
        );
        expect(deprioritizeProposal).toBeUndefined();
      });
    });

    describe("multiple proposals", () => {
      it("returns top 3 proposals sorted by confidence descending", async () => {
        const bottleneck = {
          goalId: "goal-complex" as Id<"goals">,
          goalTitle: "Complex Goal",
          severity: "critical" as const,
          description: "All triggers met",
          blockedTasks: ["task-1", "task-2", "task-3", "task-4"],
          currentProgress: 0,
        };

        const proposals = await service.proposeHealing(bottleneck);

        // Should have multiple proposals
        expect(proposals.length).toBeGreaterThan(1);
        expect(proposals.length).toBeLessThanOrEqual(3);

        // Should be sorted by confidence descending
        for (let i = 0; i < proposals.length - 1; i++) {
          expect(proposals[i].confidence).toBeGreaterThanOrEqual(
            proposals[i + 1].confidence
          );
        }
      });

      it("returns empty array when no conditions are met", async () => {
        const bottleneck = {
          goalId: "goal-none" as Id<"goals">,
          goalTitle: "Trivial Goal",
          severity: "medium" as const,
          description: "No triggers",
          blockedTasks: ["task-1"],
          currentProgress: 50,
        };

        const proposals = await service.proposeHealing(bottleneck);

        expect(proposals).toEqual([]);
      });
    });

    describe("proposal structure", () => {
      it("proposal has all required fields", async () => {
        const bottleneck = {
          goalId: "goal-struct" as Id<"goals">,
          goalTitle: "Test Goal",
          severity: "critical" as const,
          description: "Test",
          blockedTasks: ["task-1"],
          currentProgress: 10,
        };

        const proposals = await service.proposeHealing(bottleneck);

        expect(proposals[0]).toMatchObject({
          id: expect.any(String),
          bottleneckId: expect.any(String),
          goalId: "goal-struct",
          goalTitle: "Test Goal",
          category: expect.any(String),
          title: expect.any(String),
          description: expect.any(String),
          rationale: expect.any(String),
          proposedActions: expect.any(Array),
          expectedImpact: expect.any(String),
          confidence: expect.any(Number),
        });
      });

      it("proposed actions have required fields", async () => {
        const bottleneck = {
          goalId: "goal-actions" as Id<"goals">,
          goalTitle: "Test Goal",
          severity: "critical" as const,
          description: "Test",
          blockedTasks: ["task-1"],
          currentProgress: 10,
        };

        const proposals = await service.proposeHealing(bottleneck);

        proposals.forEach((proposal) => {
          proposal.proposedActions.forEach((action) => {
            expect(action).toMatchObject({
              action: expect.any(String),
              priority: expect.stringMatching(/^P[0-3]$/),
              estimatedHours: expect.any(Number),
            });
          });
        });
      });
    });
  });

  describe("executeHealing", () => {
    it("returns execution object with initial state", async () => {
      const proposal = {
        id: "proposal-1",
        bottleneckId: "goal-1",
        goalId: "goal-1" as Id<"goals">,
        goalTitle: "Test",
        category: "split" as const,
        title: "Split",
        description: "Split goal",
        rationale: "Too broad",
        proposedActions: [{ action: "Task 1", priority: "P0" as const, estimatedHours: 2 }],
        expectedImpact: "Faster progress",
        confidence: 85,
      };

      const execution = await service.executeHealing(proposal, "goal-1" as Id<"goals">);

      expect(execution).toMatchObject({
        id: expect.stringMatching(/^healing-exec-\d+$/),
        proposalId: "proposal-1",
        status: "executing",
        approvedAt: expect.any(Number),
        createdTasks: expect.any(Array),
      });
    });

    it("creates task ID for each proposed action", async () => {
      const proposal = {
        id: "proposal-multi",
        bottleneckId: "goal-2",
        goalId: "goal-2" as Id<"goals">,
        goalTitle: "Multi-action",
        category: "simplify" as const,
        title: "Simplify",
        description: "Reduce scope",
        rationale: "Too many tasks",
        proposedActions: [
          { action: "Review", priority: "P0" as const, estimatedHours: 2 },
          { action: "Remove", priority: "P1" as const, estimatedHours: 1 },
        ],
        expectedImpact: "Clearer scope",
        confidence: 75,
      };

      const execution = await service.executeHealing(proposal, "goal-2" as Id<"goals">);

      expect(execution.createdTasks).toHaveLength(2);
      execution.createdTasks.forEach((taskId) => {
        expect(taskId).toBeTruthy();
      });
    });
  });

  describe("monitorHealing", () => {
    it("returns monitoring status object", async () => {
      const execution = {
        id: "healing-1",
        proposalId: "proposal-1",
        status: "executing" as const,
        approvedAt: Date.now(),
        createdTasks: ["task-1"],
      };

      const status = await service.monitorHealing(execution);

      expect(status).toMatchObject({
        status: expect.stringMatching(/^(progressing|stalled|completed)$/),
        progressPercent: expect.any(Number),
      });
    });
  });

  describe("captureHealing", () => {
    it("returns learning capture object", async () => {
      const execution = {
        id: "healing-final",
        proposalId: "proposal-final",
        status: "executing" as const,
        approvedAt: Date.now(),
        createdTasks: ["task-1"],
      };

      const capture = await service.captureHealing(execution);

      expect(capture).toMatchObject({
        proposal: "proposal-final",
        outcome: expect.stringMatching(/^(success|partial|failed)$/),
        lessonLearned: expect.any(String),
        effectiveness: expect.any(Number),
      });
    });
  });

  describe("getAutoHealingService factory", () => {
    it("returns AutoHealingService instance", () => {
      const svc = getAutoHealingService();
      expect(svc).toBeInstanceOf(AutoHealingService);
    });

    it("returns new instance each time", () => {
      const svc1 = getAutoHealingService();
      const svc2 = getAutoHealingService();
      expect(svc1).not.toBe(svc2);
    });
  });
});
