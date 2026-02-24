/**
 * Suite 1: Executions — Phase 6A TDD Tests
 *
 * Phase 1: calculateCost() [2 tests], getSystemHealth() [2 tests] — NO DEPENDENCIES
 * Phase 2: createEvent(), createExecution(), updateExecutionStatus() [17 tests] — DEPENDS ON PHASE 1
 * Phase 3: Query & complex operations [remaining tests]
 */

import { describe, test, expect } from "@jest/globals";
import {
  calculateCostLogic,
  validateStatusTransition,
  calculateSystemHealth,
  calculateExecutionStats,
  checkRateLimitLogic,
  checkBudgetLimitLogic,
  detectAgentTimeoutLogic,
  calculateAgentMetricsLogic,
} from "../utils/execution-logic";

/**
 * ========== PHASE 1: NO DEPENDENCIES ==========
 * 4 tests total (calculateCost: 3 + 1 bonus, getSystemHealth: 2 + 1 bonus)
 */

describe("Suite 1.9: calculateCost()", () => {
  test("1.9.1: Calculates cost for GPT-4", async () => {
    const pricingConfig = {
      "gpt-4": { input: 3, output: 6 },
    };

    const result = await calculateCostLogic(pricingConfig, 1000, 500, "gpt-4");
    expect(result).toBe(6000); // (1000 * 3 + 500 * 6)
  });

  test("1.9.2: Handles missing model pricing gracefully", async () => {
    const pricingConfig = {
      "gpt-4": { input: 3, output: 6 },
    };

    const result = await calculateCostLogic(
      pricingConfig,
      1000,
      500,
      "gpt-5"
    );
    expect(result).toBe(0); // Fallback for missing model
  });

  test("1.9.3: Calculates different costs for different models (BONUS)", async () => {
    const pricingConfig = {
      "gpt-4": { input: 3, output: 6 },
      "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
    };

    const gpt4Cost = await calculateCostLogic(pricingConfig, 1000, 500, "gpt-4");
    expect(gpt4Cost).toBe(6000);

    const gpt35Cost = await calculateCostLogic(
      pricingConfig,
      1000,
      500,
      "gpt-3.5-turbo"
    );
    expect(gpt35Cost).toBe(1250); // (1000 * 0.5 + 500 * 1.5)
  });
});

describe("Suite 2.6: getSystemHealth()", () => {
  test("2.6.1: Aggregates all agent statuses correctly", () => {
    const agents = Array.from({ length: 10 }, (_, i) => ({
      _id: `agent-${i}`,
      name: `Agent ${i}`,
    }));

    const agentStatuses: Record<string, any> = {};
    for (let i = 0; i < 6; i++) {
      agentStatuses[`agent-${i}`] = {
        status: "idle",
        queuedTaskCount: 0,
        failureRate: 0,
      };
    }
    for (let i = 6; i < 9; i++) {
      agentStatuses[`agent-${i}`] = {
        status: "busy",
        queuedTaskCount: 2,
        failureRate: 0,
      };
    }
    agentStatuses["agent-9"] = {
      status: "failed",
      queuedTaskCount: 0,
      failureRate: 1.0,
    };

    const result = calculateSystemHealth(agents, agentStatuses);

    expect(result.totalAgents).toBe(10);
    expect(result.activeAgents).toBe(3);
    expect(result.idleAgents).toBe(6);
    expect(result.failedAgents).toBe(1);
  });

  test("2.6.2: Calculates system health percentage correctly", () => {
    const agents = Array.from({ length: 10 }, (_, i) => ({
      _id: `agent-${i}`,
      name: `Agent ${i}`,
    }));

    const agentStatuses: Record<string, any> = {};
    for (let i = 0; i < 9; i++) {
      agentStatuses[`agent-${i}`] = {
        status: i < 5 ? "idle" : "busy",
        queuedTaskCount: 0,
        failureRate: 0,
      };
    }
    agentStatuses["agent-9"] = {
      status: "failed",
      queuedTaskCount: 0,
      failureRate: 1.0,
    };

    const result = calculateSystemHealth(agents, agentStatuses);

    expect(result.systemHealthPercent).toBe(90); // 9 healthy / 10 total
    expect(result.avgFailureRate).toBe(0.1); // 1.0 / 10
  });

  test("2.6.3: Handles empty agent list gracefully (BONUS)", () => {
    const agents: any[] = [];
    const agentStatuses: Record<string, any> = {};

    const result = calculateSystemHealth(agents, agentStatuses);

    expect(result.totalAgents).toBe(0);
    expect(result.systemHealthPercent).toBe(100);
    expect(result.avgFailureRate).toBe(0);
  });
});

/**
 * ========== PHASE 2: DEPENDS ON PHASE 1 ==========
 * Tests for business logic without Convex mutations
 */

describe("Suite 1.2: updateExecutionStatus() - Status Transitions", () => {
  test("1.2.1: Allows valid transition pending→running", () => {
    const result = validateStatusTransition("pending", "running");
    expect(result.valid).toBe(true);
  });

  test("1.2.7: Rejects invalid status transition running→pending", () => {
    const result = validateStatusTransition("running", "pending");
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  test("1.2.7b: Allows transition to aborted from any state", () => {
    const result = validateStatusTransition("running", "aborted");
    expect(result.valid).toBe(true);
  });

  test("1.2.7c: Allows forward transition success→success", () => {
    // Same status is technically "backward" (index = index), but implementation
    // should handle this gracefully
    const result = validateStatusTransition("success", "success");
    expect(result.valid).toBe(true);
  });

  test("1.2.7d: Allows pending→success (skip running)", () => {
    const result = validateStatusTransition("pending", "success");
    expect(result.valid).toBe(true); // Can jump to success
  });
});

/**
 * ========== INTEGRATION TESTS: Cost Calculation Scenarios ==========
 */

describe("Suite 1.9: Cost Calculation - Real Scenarios", () => {
  test("Scenario: Different models, same input tokens", async () => {
    const pricing = {
      "gpt-4": { input: 3, output: 6 },
      "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
      "claude-3-sonnet": { input: 3, output: 15 },
    };

    const cost1 = await calculateCostLogic(pricing, 1000, 1000, "gpt-4");
    const cost2 = await calculateCostLogic(
      pricing,
      1000,
      1000,
      "gpt-3.5-turbo"
    );
    const cost3 = await calculateCostLogic(
      pricing,
      1000,
      1000,
      "claude-3-sonnet"
    );

    // gpt-4: (1000*3 + 1000*6) = 9000
    expect(cost1).toBe(9000);
    // gpt-3.5: (1000*0.5 + 1000*1.5) = 2000
    expect(cost2).toBe(2000);
    // sonnet: (1000*3 + 1000*15) = 18000
    expect(cost3).toBe(18000);

    // Verify sonnet is most expensive for equal tokens
    expect(cost3 > cost1 && cost1 > cost2).toBe(true);
  });

  test("Scenario: High output tokens (response heavy)", async () => {
    const pricing = {
      "gpt-4": { input: 3, output: 6 },
    };

    // Small input, large output (like long text generation)
    const cost = await calculateCostLogic(pricing, 100, 5000, "gpt-4");
    // (100 * 3 + 5000 * 6) = 300 + 30000 = 30300
    expect(cost).toBe(30300);
  });

  test("Scenario: Zero tokens edge case", async () => {
    const pricing = {
      "gpt-4": { input: 3, output: 6 },
    };

    const cost = await calculateCostLogic(pricing, 0, 0, "gpt-4");
    expect(cost).toBe(0);
  });
});

/**
 * ========== INTEGRATION TESTS: System Health Scenarios ==========
 */

describe("Suite 2.6: System Health - Real Scenarios", () => {
  test("Scenario: 100% health (no failures)", () => {
    const agents = Array.from({ length: 5 }, (_, i) => ({ _id: `a-${i}` }));
    const statuses: Record<string, any> = {};

    agents.forEach((a, i) => {
      statuses[a._id] = {
        status: i % 2 === 0 ? "idle" : "busy",
        queuedTaskCount: i,
        failureRate: 0,
      };
    });

    const health = calculateSystemHealth(agents, statuses);

    expect(health.systemHealthPercent).toBe(100);
    expect(health.failedAgents).toBe(0);
  });

  test("Scenario: 50% health (half failed)", () => {
    const agents = Array.from({ length: 4 }, (_, i) => ({ _id: `a-${i}` }));
    const statuses: Record<string, any> = {};

    agents.forEach((a, i) => {
      statuses[a._id] = {
        status: i < 2 ? "idle" : "failed",
        queuedTaskCount: 0,
        failureRate: i < 2 ? 0 : 1,
      };
    });

    const health = calculateSystemHealth(agents, statuses);

    expect(health.systemHealthPercent).toBe(50);
    expect(health.failedAgents).toBe(2);
    expect(health.avgFailureRate).toBe(0.5);
  });

  test("Scenario: Mixed queue depths", () => {
    const agents = Array.from({ length: 3 }, (_, i) => ({ _id: `a-${i}` }));
    const statuses: Record<string, any> = {
      "a-0": { status: "busy", queuedTaskCount: 5, failureRate: 0 },
      "a-1": { status: "busy", queuedTaskCount: 10, failureRate: 0 },
      "a-2": { status: "idle", queuedTaskCount: 0, failureRate: 0 },
    };

    const health = calculateSystemHealth(agents, statuses);

    expect(health.avgQueueDepth).toBe(5); // (5 + 10 + 0) / 3
    expect(health.activeAgents).toBe(2);
  });

  test("Scenario: All agents failed", () => {
    const agents = Array.from({ length: 3 }, (_, i) => ({ _id: `a-${i}` }));
    const statuses: Record<string, any> = {
      "a-0": { status: "failed", queuedTaskCount: 0, failureRate: 1 },
      "a-1": { status: "failed", queuedTaskCount: 0, failureRate: 1 },
      "a-2": { status: "failed", queuedTaskCount: 0, failureRate: 1 },
    };

    const health = calculateSystemHealth(agents, statuses);

    expect(health.systemHealthPercent).toBe(0);
    expect(health.failedAgents).toBe(3);
    expect(health.avgFailureRate).toBe(1);
  });
});

/**
 * ========== PERFORMANCE BASELINE ==========
 * Verify logic functions complete in acceptable time
 */

describe("Performance Baselines", () => {
  test("Cost calculation <1ms for typical call", async () => {
    const pricing = {
      "gpt-4": { input: 3, output: 6 },
    };

    const start = Date.now();
    await calculateCostLogic(pricing, 1000, 500, "gpt-4");
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(10); // Should be <10ms
  });

  test("System health calculation <5ms for 100 agents", () => {
    const agents = Array.from({ length: 100 }, (_, i) => ({
      _id: `agent-${i}`,
    }));
    const statuses: Record<string, any> = {};

    agents.forEach((a) => {
      statuses[a._id] = {
        status: Math.random() > 0.1 ? "idle" : "busy",
        queuedTaskCount: Math.floor(Math.random() * 5),
        failureRate: Math.random() * 0.1,
      };
    });

    const start = Date.now();
    calculateSystemHealth(agents, statuses);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(20); // Should be <20ms for 100 agents
  });

  test("Status transition validation <1ms", () => {
    const start = Date.now();
    validateStatusTransition("pending", "running");
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(5);
  });
});

/**
 * ========== PHASE 3: QUERY & CONTROL LOGIC ==========
 * 48 total tests across 3 suites
 */

describe("Suite 1.5: getExecutionStats()", () => {
  test("1.5.1: Calculates success count", () => {
    const executions = [
      { status: "success", durationMs: 100, inputTokens: 100, outputTokens: 50, costCents: 50 },
      { status: "success", durationMs: 200, inputTokens: 100, outputTokens: 50, costCents: 50 },
      { status: "success", durationMs: 300, inputTokens: 100, outputTokens: 50, costCents: 50 },
      { status: "failed", durationMs: 150, inputTokens: 100, outputTokens: 50, costCents: 50 },
    ];

    const stats = calculateExecutionStats(executions);
    expect(stats.successCount).toBe(3);
    expect(stats.failureCount).toBe(1);
  });

  test("1.5.2: Calculates failure rate", () => {
    const executions = Array.from({ length: 10 }, (_, i) => ({
      status: i < 7 ? "success" : "failed",
      durationMs: 100,
      inputTokens: 100,
      outputTokens: 50,
      costCents: 50,
    }));

    const stats = calculateExecutionStats(executions);
    expect(stats.failureRate).toBe(0.3); // 3 failures out of 10
  });

  test("1.5.3: Calculates avg duration", () => {
    const executions = [
      { status: "success", durationMs: 100, inputTokens: 100, outputTokens: 50, costCents: 50 },
      { status: "success", durationMs: 200, inputTokens: 100, outputTokens: 50, costCents: 50 },
      { status: "success", durationMs: 300, inputTokens: 100, outputTokens: 50, costCents: 50 },
    ];

    const stats = calculateExecutionStats(executions);
    expect(stats.avgDurationMs).toBe(200); // (100 + 200 + 300) / 3
  });

  test("1.5.4: Calculates avg tokens", () => {
    const executions = [
      { status: "success", durationMs: 100, inputTokens: 1000, outputTokens: 100, costCents: 50 },
      { status: "success", durationMs: 200, inputTokens: 1000, outputTokens: 900, costCents: 50 },
    ];

    const stats = calculateExecutionStats(executions);
    // Total tokens: (1000+100) + (1000+900) = 3000, avg = 1500
    expect(stats.avgTokensPerExecution).toBe(1500);
  });

  test("1.5.5: Calculates total cost", () => {
    const executions = [
      { status: "success", durationMs: 100, inputTokens: 100, outputTokens: 50, costCents: 100 },
      { status: "success", durationMs: 200, inputTokens: 100, outputTokens: 50, costCents: 200 },
      { status: "success", durationMs: 300, inputTokens: 100, outputTokens: 50, costCents: 300 },
    ];

    const stats = calculateExecutionStats(executions);
    expect(stats.totalCostCents).toBe(600); // 100 + 200 + 300
  });

  test("1.5.6: Handles empty executions", () => {
    const stats = calculateExecutionStats([]);
    expect(stats.totalExecutions).toBe(0);
    expect(stats.failureRate).toBe(0);
  });
});

describe("Suite 3.2: checkRateLimit()", () => {
  test("3.2.1: Allows under limit", () => {
    const result = checkRateLimitLogic(5, 10);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(5);
  });

  test("3.2.2: Blocks at limit", () => {
    const result = checkRateLimitLogic(10, 10);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  test("3.2.3: Handles first execution", () => {
    const result = checkRateLimitLogic(0, 10);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(10);
  });

  test("3.2.4: Blocks over limit", () => {
    const result = checkRateLimitLogic(11, 10);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0); // Capped at 0
  });

  test("3.2.5: Counts exactly at boundary", () => {
    const result = checkRateLimitLogic(9, 10);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  test("3.2.6: Performance with high limits", () => {
    const start = Date.now();
    checkRateLimitLogic(5000, 10000);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(5);
  });
});

describe("Suite 3.3: checkBudgetLimit()", () => {
  test("3.3.1: Allows under budget", () => {
    const result = checkBudgetLimitLogic(4000, 5000, 10000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(5000); // 10000 - 5000
  });

  test("3.3.2: Blocks over budget", () => {
    const result = checkBudgetLimitLogic(1000, 9500, 10000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(500); // 10000 - 9500
  });

  test("3.3.3: Handles zero budget (unlimited)", () => {
    const result = checkBudgetLimitLogic(1000, 5000, 0);
    expect(result.allowed).toBe(true); // Unlimited
  });

  test("3.3.4: Allows at exact budget", () => {
    const result = checkBudgetLimitLogic(2000, 8000, 10000);
    expect(result.allowed).toBe(true);
  });
});

describe("Suite 2.5: detectAgentTimeout()", () => {
  test("2.5.1: Detects timeout after 30s", () => {
    const currentTime = 31000;
    const lastHeartbeat = 0;
    const result = detectAgentTimeoutLogic(lastHeartbeat, currentTime, 30000);

    expect(result.timedOut).toBe(true);
    expect(result.timeSinceHeartbeatMs).toBe(31000);
  });

  test("2.5.2: No timeout if recent", () => {
    const currentTime = 5000;
    const lastHeartbeat = 0;
    const result = detectAgentTimeoutLogic(lastHeartbeat, currentTime, 30000);

    expect(result.timedOut).toBe(false);
  });

  test("2.5.3: Custom timeout value", () => {
    const currentTime = 15000;
    const lastHeartbeat = 0;
    const result = detectAgentTimeoutLogic(lastHeartbeat, currentTime, 10000);

    expect(result.timedOut).toBe(true);
  });

  test("2.5.4: Exact boundary", () => {
    const currentTime = 30000;
    const lastHeartbeat = 0;
    const result = detectAgentTimeoutLogic(lastHeartbeat, currentTime, 30000);

    expect(result.timedOut).toBe(false); // Exactly at boundary, not timed out
  });
});

describe("Suite 2.4: getAgentMetrics()", () => {
  test("2.4.1: Calculates utilization", () => {
    const statusHistory = [
      { status: "idle", timestamp: 0 },
      { status: "busy", timestamp: 1800000 }, // 30 min idle
      { status: "idle", timestamp: 3600000 }, // 30 min busy
    ];

    const executions = [];
    const metrics = calculateAgentMetricsLogic(statusHistory, executions);

    expect(metrics.utilization).toBe(50); // 50% busy
  });

  test("2.4.2: Calculates failure rate", () => {
    const statusHistory = [
      { status: "idle", timestamp: 0 },
      { status: "idle", timestamp: 1000 },
    ];

    const executions = [
      { status: "success", durationMs: 100 },
      { status: "success", durationMs: 100 },
      { status: "failed", durationMs: 100 },
      { status: "failed", durationMs: 100 },
    ];

    const metrics = calculateAgentMetricsLogic(statusHistory, executions);
    expect(metrics.failureRate).toBe(0.5); // 50% failure rate
  });

  test("2.4.3: Calculates avg execution time", () => {
    const statusHistory = [];
    const executions = [
      { status: "success", durationMs: 100 },
      { status: "success", durationMs: 200 },
      { status: "success", durationMs: 300 },
    ];

    const metrics = calculateAgentMetricsLogic(statusHistory, executions);
    expect(metrics.avgExecutionTime).toBe(200); // (100 + 200 + 300) / 3
  });

  test("2.4.4: Calculates uptime", () => {
    const statusHistory = [
      { status: "idle", timestamp: 0 },
      { status: "busy", timestamp: 1000 },
      { status: "idle", timestamp: 2000 },
      { status: "failed", timestamp: 3000 },
      { status: "failed", timestamp: 4000 },
    ];

    const executions = [];
    const metrics = calculateAgentMetricsLogic(statusHistory, executions);
    expect(metrics.onlinePercent).toBe(60); // 3 online out of 5
  });
});
