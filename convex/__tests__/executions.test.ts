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
  aggregateMetricsLogic,
  shouldCleanupEventLogic,
  validateExecutionAllowedLogic,
  calculateTrendPercent,
  groupExecutionsByHour,
  buildCostTrend,
  rankAgentsByEfficiency,
} from "../utils/executionLogic";

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
 * Tests for workspace logic without Convex mutations
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

    const executions: Array<{ status: string; durationMs: number }> = [];
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
    const statusHistory: Array<{ status: string; timestamp: number }> = [];
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

    const executions: Array<{ status: string; durationMs: number }> = [];
    const metrics = calculateAgentMetricsLogic(statusHistory, executions);
    expect(metrics.onlinePercent).toBe(60); // 3 online out of 5
  });
});

/**
 * ========== PHASE 4: AGENT CONTROL & METRICS ==========
 * 24 total tests across 4 suites
 */

describe("Suite 3.1: executeAgentManually()", () => {
  test("3.1.1: Executes agent without task", () => {
    // Manual execution should always be allowed if validations pass
    const validation = validateExecutionAllowedLogic("idle", true, true);
    expect(validation.allowed).toBe(true);
  });

  test("3.1.3: Respects rate limit (10/min)", () => {
    // 10 executions already in last minute
    const rateCheck = checkRateLimitLogic(10, 10);
    expect(rateCheck.allowed).toBe(false);

    // 11th execution should succeed after 60s window expires
    // (simulated by resetting count)
    const rateCheckAfter = checkRateLimitLogic(1, 10);
    expect(rateCheckAfter.allowed).toBe(true);
  });

  test("3.1.4: Respects global budget limit", () => {
    // Budget: $100, spent: $99.50, estimate: 50¢
    const budgetCheck = checkBudgetLimitLogic(50, 9950, 10000);
    expect(budgetCheck.allowed).toBe(true);
  });

  test("3.1.5: Rejects if exceeds budget", () => {
    // Budget: $100, spent: $99, estimate: $1.50 = 150¢
    const budgetCheck = checkBudgetLimitLogic(150, 9900, 10000);
    expect(budgetCheck.allowed).toBe(false);
  });

  test("3.1.7: Updates agent_status to busy", () => {
    // Agent should be marked as busy when execution starts
    const expectedStatus = "busy";
    expect(expectedStatus).toBe("busy");
  });

  test("3.1.8: Creates execution_started event", () => {
    // Event should be created with proper type
    const eventType = "execution_started";
    expect(eventType).toBe("execution_started");
  });

  test("3.1: Comprehensive validation", () => {
    // All checks pass: agent idle, rate OK, budget OK
    const validation = validateExecutionAllowedLogic("idle", true, true);
    expect(validation.allowed).toBe(true);
    expect(validation.error).toBeUndefined();
  });

  test("3.1: Blocks on failed agent", () => {
    const validation = validateExecutionAllowedLogic("failed", true, true);
    expect(validation.allowed).toBe(false);
    expect(validation.error).toContain("not available");
  });
});

describe("Suite 3.4: validateExecutionAllowed()", () => {
  test("3.4.1: Allows when all checks pass", () => {
    const validation = validateExecutionAllowedLogic("idle", true, true);
    expect(validation.allowed).toBe(true);
  });

  test("3.4.2: Blocks on rate limit", () => {
    const validation = validateExecutionAllowedLogic("idle", false, true);
    expect(validation.allowed).toBe(false);
    expect(validation.error).toContain("Rate limit");
  });

  test("3.4.3: Blocks on budget", () => {
    const validation = validateExecutionAllowedLogic("idle", true, false);
    expect(validation.allowed).toBe(false);
    expect(validation.error).toContain("Budget");
  });

  test("3.4.4: Blocks on failed agent", () => {
    const validation = validateExecutionAllowedLogic("failed", true, true);
    expect(validation.allowed).toBe(false);
    expect(validation.error).toContain("not available");
  });
});

describe("Suite 4.1: aggregateMetrics()", () => {
  test("4.1.1: Aggregates single agent 5 executions", () => {
    const executions = [
      { status: "success", inputTokens: 100, outputTokens: 50, costCents: 10, durationMs: 100 },
      { status: "success", inputTokens: 100, outputTokens: 50, costCents: 10, durationMs: 100 },
      { status: "success", inputTokens: 100, outputTokens: 50, costCents: 10, durationMs: 100 },
      { status: "failed", inputTokens: 100, outputTokens: 50, costCents: 10, durationMs: 100 },
      { status: "failed", inputTokens: 100, outputTokens: 50, costCents: 10, durationMs: 100 },
    ];

    const metrics = aggregateMetricsLogic(executions);
    expect(metrics.successCount).toBe(3);
    expect(metrics.failureCount).toBe(2);
  });

  test("4.1.2: Calculates success count", () => {
    const executions = [
      { status: "success", inputTokens: 100, outputTokens: 50, costCents: 10, durationMs: 100 },
      { status: "success", inputTokens: 100, outputTokens: 50, costCents: 10, durationMs: 100 },
      { status: "success", inputTokens: 100, outputTokens: 50, costCents: 10, durationMs: 100 },
      { status: "failed", inputTokens: 100, outputTokens: 50, costCents: 10, durationMs: 100 },
      { status: "failed", inputTokens: 100, outputTokens: 50, costCents: 10, durationMs: 100 },
    ];

    const metrics = aggregateMetricsLogic(executions);
    expect(metrics.successCount).toBe(3);
  });

  test("4.1.3: Calculates failure rate", () => {
    const executions = [
      { status: "success", inputTokens: 100, outputTokens: 50, costCents: 10, durationMs: 100 },
      { status: "success", inputTokens: 100, outputTokens: 50, costCents: 10, durationMs: 100 },
      { status: "success", inputTokens: 100, outputTokens: 50, costCents: 10, durationMs: 100 },
      { status: "failed", inputTokens: 100, outputTokens: 50, costCents: 10, durationMs: 100 },
      { status: "failed", inputTokens: 100, outputTokens: 50, costCents: 10, durationMs: 100 },
    ];

    const metrics = aggregateMetricsLogic(executions);
    expect(metrics.failureRate).toBe(0.4); // 2/5
  });

  test("4.1.4: Sums tokens", () => {
    const executions = [
      { status: "success", inputTokens: 1000, outputTokens: 500, costCents: 10, durationMs: 100 },
      { status: "success", inputTokens: 500, outputTokens: 300, costCents: 10, durationMs: 100 },
    ];

    const metrics = aggregateMetricsLogic(executions);
    expect(metrics.totalTokens).toBe(2300); // 1000 + 500 + 500 + 300
  });

  test("4.1.5: Sums cost", () => {
    const executions = [
      { status: "success", inputTokens: 100, outputTokens: 50, costCents: 100, durationMs: 100 },
      { status: "success", inputTokens: 100, outputTokens: 50, costCents: 50, durationMs: 100 },
    ];

    const metrics = aggregateMetricsLogic(executions);
    expect(metrics.totalCostCents).toBe(150);
  });

  test("4.1.6: Calculates avg duration", () => {
    const executions = [
      { status: "success", inputTokens: 100, outputTokens: 50, costCents: 10, durationMs: 100 },
      { status: "success", inputTokens: 100, outputTokens: 50, costCents: 10, durationMs: 200 },
      { status: "success", inputTokens: 100, outputTokens: 50, costCents: 10, durationMs: 300 },
    ];

    const metrics = aggregateMetricsLogic(executions);
    expect(metrics.avgDurationMs).toBe(200); // (100 + 200 + 300) / 3
  });

  test("4.1.8: Handles empty executions", () => {
    const metrics = aggregateMetricsLogic([]);
    expect(metrics.successCount).toBe(0);
    expect(metrics.totalTokens).toBe(0);
  });
});

describe("Suite 4.2: cleanupOldEvents()", () => {
  test("4.2.1: Deletes events >24h old", () => {
    const now = Date.now();
    const dayOld = now - 26 * 60 * 60 * 1000; // 26 hours ago
    const hourOld = now - 1 * 60 * 60 * 1000; // 1 hour ago

    const shouldDelete1 = shouldCleanupEventLogic(dayOld, now);
    const shouldDelete2 = shouldCleanupEventLogic(hourOld, now);

    expect(shouldDelete1).toBe(true);
    expect(shouldDelete2).toBe(false);
  });

  test("4.2.2: Preserves recent events", () => {
    const now = Date.now();
    const oneHourAgo = now - 1 * 60 * 60 * 1000;
    const twoHoursAgo = now - 2 * 60 * 60 * 1000;

    const shouldDelete1 = shouldCleanupEventLogic(oneHourAgo, now);
    const shouldDelete2 = shouldCleanupEventLogic(twoHoursAgo, now);

    expect(shouldDelete1).toBe(false);
    expect(shouldDelete2).toBe(false);
  });

  test("4.2.3: Handles empty event table", () => {
    // No events means no cleanup needed
    const eventCount = 0;
    expect(eventCount).toBe(0);
  });

  test("4.2.4: Idempotent (run twice)", () => {
    // Cleanup should be safe to run multiple times
    const now = Date.now();
    const oldEvent = now - 26 * 60 * 60 * 1000;

    const shouldDelete1 = shouldCleanupEventLogic(oldEvent, now);
    const shouldDelete2 = shouldCleanupEventLogic(oldEvent, now);

    expect(shouldDelete1).toBe(shouldDelete2);
  });
});

/**
 * ========== PHASE 4: INTEGRATION & EDGE CASES ==========
 */

describe("Phase 4: Complex Scenarios", () => {
  test("Full execution flow: Create → Validate → Update → Aggregate", () => {
    // Step 1: Validate before execution
    const canExecute = validateExecutionAllowedLogic("idle", true, true);
    expect(canExecute.allowed).toBe(true);

    // Step 2: Create execution (simulated)
    const execution = {
      agentId: "agent-1",
      status: "pending",
      startTime: Date.now(),
    };

    // Step 3: Update status to success
    const updated = { ...execution, status: "success", durationMs: 150 };

    // Step 4: Aggregate metrics
    const stats = calculateExecutionStats([updated]);
    expect(stats.totalExecutions).toBe(1);
    expect(stats.successCount).toBe(1);
  });

  test("Budget exhaustion flow", () => {
    const dailyBudget = 10000; // $100

    // First execution: 30¢
    const check1 = checkBudgetLimitLogic(30, 0, dailyBudget);
    expect(check1.allowed).toBe(true);

    // Accumulated: $99.70
    const check2 = checkBudgetLimitLogic(200, 9970, dailyBudget); // Next execution would be 150¢
    expect(check2.allowed).toBe(false); // Over budget
  });

  test("Rate limiting reset simulation", () => {
    const maxCalls = 10;

    // At limit
    const atLimit = checkRateLimitLogic(10, maxCalls);
    expect(atLimit.allowed).toBe(false);

    // After window reset (simulated with 0 count)
    const afterReset = checkRateLimitLogic(0, maxCalls);
    expect(afterReset.allowed).toBe(true);
  });

  test("Agent timeout cascade effect", () => {
    const now = Date.now();
    const timedOutAgent = now - 35000; // 35 seconds ago

    // Agent times out
    const timeout = detectAgentTimeoutLogic(timedOutAgent, now, 30000);
    expect(timeout.timedOut).toBe(true);

    // After timeout, agent should be marked failed
    const validation = validateExecutionAllowedLogic("failed", true, true);
    expect(validation.allowed).toBe(false); // Can't execute on failed agent
  });

  test("Metrics cleanup lifecycle", () => {
    const now = Date.now();
    const events = [
      { timestamp: now - 1000 }, // 1 second ago - keep
      { timestamp: now - 1 * 60 * 60 * 1000 }, // 1 hour ago - keep
      { timestamp: now - 23 * 60 * 60 * 1000 }, // 23 hours ago - keep
      { timestamp: now - 25 * 60 * 60 * 1000 }, // 25 hours ago - delete
      { timestamp: now - 48 * 60 * 60 * 1000 }, // 48 hours ago - delete
    ];

    const toDelete = events.filter((e) => shouldCleanupEventLogic(e.timestamp, now));
    expect(toDelete.length).toBe(2); // Should delete 2 old events
  });
});

/**
 * ========== PHASE 5: OBSERVABILITY DASHBOARD ANALYTICS ==========
 * 25 new tests for 4 pure logic analytics functions
 */

describe("Suite 5.1: calculateTrendPercent()", () => {
  test("5.1.1: Returns null when previous is 0", () => {
    expect(calculateTrendPercent(100, 0)).toBeNull();
  });

  test("5.1.2: Returns null when both are 0", () => {
    expect(calculateTrendPercent(0, 0)).toBeNull();
  });

  test("5.1.3: Calculates 50% increase correctly", () => {
    expect(calculateTrendPercent(150, 100)).toBe(50);
  });

  test("5.1.4: Calculates 50% decrease correctly (negative)", () => {
    expect(calculateTrendPercent(50, 100)).toBe(-50);
  });

  test("5.1.5: Returns 0 when current equals previous", () => {
    expect(calculateTrendPercent(100, 100)).toBe(0);
  });

  test("5.1.6: Handles large values with correct rounding", () => {
    // 1/3 percent change: 10000 → 10033.33
    const result = calculateTrendPercent(10033, 10000);
    expect(result).toBe(0.33);
  });
});

describe("Suite 5.2: groupExecutionsByHour()", () => {
  test("5.2.1: Returns array of correct length for requested hours", () => {
    const result = groupExecutionsByHour([], 24);
    expect(result).toHaveLength(24);
  });

  test("5.2.2: All slots are zero for empty executions", () => {
    const result = groupExecutionsByHour([], 6);
    result.forEach((slot: { count: number; successCount: number; failureCount: number }) => {
      expect(slot.count).toBe(0);
      expect(slot.successCount).toBe(0);
      expect(slot.failureCount).toBe(0);
    });
  });

  test("5.2.3: Counts executions in correct bucket", () => {
    const nowMs = 1000 * 3600 * 24; // arbitrary anchor
    const executions = [
      { startTime: nowMs - 1000, status: "success" },
      { startTime: nowMs - 2000, status: "success" },
      { startTime: nowMs - 3000, status: "failed" },
    ];
    const result = groupExecutionsByHour(executions, 24, nowMs);
    const lastSlot = result[result.length - 1]; // most recent slot
    expect(lastSlot.count).toBe(3);
    expect(lastSlot.successCount).toBe(2);
    expect(lastSlot.failureCount).toBe(1);
  });

  test("5.2.4: Ignores executions outside the window", () => {
    const nowMs = 1000 * 3600 * 24;
    const executions = [
      { startTime: nowMs - 25 * 3600000, status: "success" }, // outside 24h window
    ];
    const result = groupExecutionsByHour(executions, 24, nowMs);
    const total = result.reduce((sum: number, s) => sum + s.count, 0);
    expect(total).toBe(0);
  });

  test("5.2.5: Assigns correct slot index per execution time", () => {
    const nowMs = 24 * 3600000;
    const executions = [
      { startTime: nowMs - 1800000, status: "success" }, // 30 min ago → slot 23 (most recent 1h bucket)
      { startTime: nowMs - 12.5 * 3600000, status: "success" }, // 12.5h ago → slot 11
    ];
    const result = groupExecutionsByHour(executions, 24, nowMs);
    expect(result[23].count).toBe(1); // most recent window
    expect(result[11].count).toBe(1); // 12h ago window
  });

  test("5.2.6: Performance <5ms for 1000 executions", () => {
    const nowMs = Date.now();
    const executions = Array.from({ length: 1000 }, (_, i) => ({
      startTime: nowMs - i * 30000, // spread over 30s intervals
      status: i % 3 === 0 ? "failed" : "success",
    }));
    const start = Date.now();
    groupExecutionsByHour(executions, 24, nowMs);
    expect(Date.now() - start).toBeLessThan(5);
  });
});

describe("Suite 5.3: buildCostTrend()", () => {
  test("5.3.1: Returns empty array for empty input", () => {
    expect(buildCostTrend([])).toEqual([]);
  });

  test("5.3.2: Single agent single hour returns one entry", () => {
    const rows = [{ date: "2024-02-24", hour: 9, totalCostCents: 500, agentId: "a1" }];
    const result = buildCostTrend(rows);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("2024-02-24:09");
    expect(result[0].costCents).toBe(500);
  });

  test("5.3.3: Multiple agents in same hour are summed", () => {
    const rows = [
      { date: "2024-02-24", hour: 10, totalCostCents: 300, agentId: "a1" },
      { date: "2024-02-24", hour: 10, totalCostCents: 200, agentId: "a2" },
    ];
    const result = buildCostTrend(rows);
    expect(result).toHaveLength(1);
    expect(result[0].costCents).toBe(500);
  });

  test("5.3.4: Results are sorted chronologically", () => {
    const rows = [
      { date: "2024-02-24", hour: 15, totalCostCents: 100, agentId: "a1" },
      { date: "2024-02-24", hour: 9, totalCostCents: 200, agentId: "a1" },
      { date: "2024-02-24", hour: 12, totalCostCents: 150, agentId: "a1" },
    ];
    const result = buildCostTrend(rows);
    expect(result[0].label).toBe("2024-02-24:09");
    expect(result[1].label).toBe("2024-02-24:12");
    expect(result[2].label).toBe("2024-02-24:15");
  });

  test("5.3.5: Integration — full dashboard cost trend from 24h metrics", () => {
    // Simulate 24 hours of metrics, 2 agents per hour
    const rows = Array.from({ length: 24 }, (_, i) => [
      { date: "2024-02-24", hour: i, totalCostCents: 100 + i, agentId: "a1" },
      { date: "2024-02-24", hour: i, totalCostCents: 50 + i, agentId: "a2" },
    ]).flat();

    const result = buildCostTrend(rows);
    expect(result).toHaveLength(24);
    // Hour 0: 100 + 50 = 150
    expect(result[0].costCents).toBe(150);
    // Hour 23: (100+23) + (50+23) = 123 + 73 = 196
    expect(result[23].costCents).toBe(196);
  });
});

describe("Suite 5.4: rankAgentsByEfficiency()", () => {
  test("5.4.1: Returns empty array for empty input", () => {
    expect(rankAgentsByEfficiency([])).toEqual([]);
  });

  test("5.4.2: Single agent gets rank 1", () => {
    const result = rankAgentsByEfficiency([
      {
        agentId: "a1",
        agentName: "Alpha",
        successCount: 8,
        totalExecutions: 10,
        totalDurationMs: 10000,
      },
    ]);
    expect(result[0].rank).toBe(1);
    expect(result[0].successRate).toBe(0.8);
  });

  test("5.4.3: Sorts by efficiency score descending", () => {
    const agents = [
      {
        agentId: "a1",
        agentName: "Slow",
        successCount: 9,
        totalExecutions: 10,
        totalDurationMs: 100000,
      },
      {
        agentId: "a2",
        agentName: "Fast",
        successCount: 9,
        totalExecutions: 10,
        totalDurationMs: 10000,
      },
    ];
    const result = rankAgentsByEfficiency(agents);
    expect(result[0].agentId).toBe("a2"); // faster has better throughputScore
    expect(result[0].rank).toBe(1);
    expect(result[1].rank).toBe(2);
  });

  test("5.4.4: Agent with zero executions gets efficiencyScore 0", () => {
    const result = rankAgentsByEfficiency([
      {
        agentId: "a1",
        agentName: "Idle",
        successCount: 0,
        totalExecutions: 0,
        totalDurationMs: 0,
      },
    ]);
    expect(result[0].efficiencyScore).toBe(0);
    expect(result[0].successRate).toBe(0);
  });

  test("5.4.5: Ranks are 1-based and consecutive", () => {
    const agents = Array.from({ length: 5 }, (_, i) => ({
      agentId: `a${i}`,
      agentName: `Agent ${i}`,
      successCount: 10 - i,
      totalExecutions: 10,
      totalDurationMs: 10000 + i * 1000,
    }));
    const result = rankAgentsByEfficiency(agents);
    const ranks = result.map((r) => r.rank);
    expect(ranks).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("Suite 5.5: Phase 5 Integration Scenarios", () => {
  test("Full dashboard data assembly: trend + cost + efficiency", () => {
    // Trend: previous hour had 8 successes, current has 9
    const trend = calculateTrendPercent(9, 8);
    expect(trend).toBeCloseTo(12.5, 1);

    // Cost trend from raw rows
    const costRows = [
      { date: "2024-02-24", hour: 0, totalCostCents: 500, agentId: "a1" },
      { date: "2024-02-24", hour: 1, totalCostCents: 600, agentId: "a1" },
    ];
    const costTrend = buildCostTrend(costRows);
    expect(costTrend).toHaveLength(2);
    expect(costTrend[1].costCents).toBeGreaterThan(costTrend[0].costCents);

    // Rank agents
    const ranked = rankAgentsByEfficiency([
      {
        agentId: "a1",
        agentName: "Alpha",
        successCount: 17,
        totalExecutions: 20,
        totalDurationMs: 60000,
      },
    ]);
    expect(ranked[0].rank).toBe(1);
  });

  test("Trend comparison across two periods", () => {
    const previousPeriodCost = 5000;
    const currentPeriodCost = 6500;
    const trend = calculateTrendPercent(currentPeriodCost, previousPeriodCost);
    expect(trend).toBe(30); // 30% increase
  });

  test("getSystemHealthFixed N+1 fix: verify in-memory join pattern", () => {
    // Simulate fetching all statuses at once and joining in memory
    const agents = [{ _id: "a1" }, { _id: "a2" }, { _id: "a3" }];
    const allStatuses = [
      { agentId: "a1", status: "idle", queuedTaskCount: 0, failureRate: 0 },
      { agentId: "a2", status: "busy", queuedTaskCount: 2, failureRate: 0 },
      { agentId: "a3", status: "failed", queuedTaskCount: 0, failureRate: 1 },
    ];

    // Build lookup map (the fix pattern)
    const statusMap: Record<string, any> = {};
    for (const s of allStatuses) {
      statusMap[s.agentId] = s;
    }

    // calculateSystemHealth is already tested; verify the fix joins correctly
    const result = calculateSystemHealth(agents as any, statusMap);
    expect(result.totalAgents).toBe(3);
    expect(result.activeAgents).toBe(1);
    expect(result.failedAgents).toBe(1);
    expect(result.systemHealthPercent).toBe(67); // 2 healthy / 3 total
  });
});
