/**
 * Execution Logic - Pure functions for testing
 *
 * These functions contain the business logic for executions
 * and can be tested independently from Convex mutations.
 */

/**
 * Calculate cost based on tokens and model pricing.
 *
 * Pure function that takes pricing config as parameter.
 */
export async function calculateCostLogic(
  pricingConfig: Record<string, { input: number; output: number }>,
  inputTokens: number,
  outputTokens: number,
  model: string
): Promise<number> {
  const modelPricing = pricingConfig[model];

  if (!modelPricing) {
    console.warn(`Missing pricing for model: ${model}`);
    return 0;
  }

  const inputRate = modelPricing.input || 0;
  const outputRate = modelPricing.output || 0;

  const totalCostCents = inputTokens * inputRate + outputTokens * outputRate;
  return totalCostCents;
}

/**
 * Validate status transition.
 *
 * Status order: pending → running → success/failed/aborted
 * Can always transition to aborted.
 */
export function validateStatusTransition(
  currentStatus: string,
  newStatus: string
): { valid: boolean; error?: string } {
  const statusOrder = ["pending", "running", "success", "failed", "aborted"];

  // Can always transition to aborted
  if (newStatus === "aborted") {
    return { valid: true };
  }

  const currentIndex = statusOrder.indexOf(currentStatus);
  const newIndex = statusOrder.indexOf(newStatus);

  if (newIndex < currentIndex) {
    return {
      valid: false,
      error: `Invalid status transition: ${currentStatus} → ${newStatus}`,
    };
  }

  return { valid: true };
}

/**
 * Calculate agent health from statuses.
 */
export function calculateSystemHealth(
  agents: any[],
  agentStatuses: Record<string, any>
): {
  totalAgents: number;
  activeAgents: number;
  idleAgents: number;
  failedAgents: number;
  avgQueueDepth: number;
  systemHealthPercent: number;
  avgFailureRate: number;
} {
  if (agents.length === 0) {
    return {
      totalAgents: 0,
      activeAgents: 0,
      idleAgents: 0,
      failedAgents: 0,
      avgQueueDepth: 0,
      systemHealthPercent: 100,
      avgFailureRate: 0,
    };
  }

  let idleCount = 0;
  let busyCount = 0;
  let failedCount = 0;
  let totalQueueDepth = 0;
  let totalFailureRate = 0;

  for (const agent of agents) {
    const status = agentStatuses[agent._id];

    if (status) {
      switch (status.status) {
        case "idle":
          idleCount++;
          break;
        case "busy":
          busyCount++;
          break;
        case "failed":
        case "stopped":
          failedCount++;
          break;
      }

      totalQueueDepth += status.queuedTaskCount || 0;
      totalFailureRate += status.failureRate || 0;
    } else {
      idleCount++;
    }
  }

  const totalAgents = agents.length;
  const activeAgents = busyCount;
  const avgQueueDepth = totalQueueDepth / totalAgents;
  const healthyAgents = totalAgents - failedCount;
  const systemHealthPercent = Math.round((healthyAgents / totalAgents) * 100);
  const avgFailureRate = Math.round((totalFailureRate / totalAgents) * 100) / 100;

  return {
    totalAgents,
    activeAgents,
    idleAgents: idleCount,
    failedAgents: failedCount,
    avgQueueDepth: Math.round(avgQueueDepth * 100) / 100,
    systemHealthPercent,
    avgFailureRate,
  };
}

/**
 * ========== PHASE 3: QUERY & CONTROL LOGIC ==========
 */

/**
 * Calculate execution statistics from a list of executions.
 */
export function calculateExecutionStats(
  executions: any[],
  daysFilter = 7
): {
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  avgDurationMs: number;
  avgTokensPerExecution: number;
  totalCostCents: number;
  failureRate: number;
} {
  if (executions.length === 0) {
    return {
      totalExecutions: 0,
      successCount: 0,
      failureCount: 0,
      avgDurationMs: 0,
      avgTokensPerExecution: 0,
      totalCostCents: 0,
      failureRate: 0,
    };
  }

  let successCount = 0;
  let failureCount = 0;
  let totalDuration = 0;
  let totalTokens = 0;
  let totalCost = 0;

  for (const exec of executions) {
    if (exec.status === "success") successCount++;
    if (exec.status === "failed") failureCount++;

    totalDuration += exec.durationMs || 0;
    totalTokens += (exec.inputTokens || 0) + (exec.outputTokens || 0);
    totalCost += exec.costCents || 0;
  }

  const totalExecutions = executions.length;
  const avgDurationMs = Math.round(totalDuration / totalExecutions);
  const avgTokensPerExecution = Math.round(totalTokens / totalExecutions);
  const failureRate = Math.round((failureCount / totalExecutions) * 100) / 100;

  return {
    totalExecutions,
    successCount,
    failureCount,
    avgDurationMs,
    avgTokensPerExecution,
    totalCostCents: totalCost,
    failureRate,
  };
}

/**
 * Check if agent has exceeded rate limit.
 */
export function checkRateLimitLogic(
  recentExecutionCount: number,
  maxCallsPerMinute: number
): {
  allowed: boolean;
  remaining: number;
} {
  const remaining = Math.max(0, maxCallsPerMinute - recentExecutionCount);
  const allowed = recentExecutionCount < maxCallsPerMinute;

  return { allowed, remaining };
}

/**
 * Check if budget is available for execution.
 */
export function checkBudgetLimitLogic(
  estimatedCostCents: number,
  spentTodayCents: number,
  dailyBudgetCents: number
): {
  allowed: boolean;
  remaining: number;
} {
  if (dailyBudgetCents === 0) {
    // Unlimited budget
    return { allowed: true, remaining: estimatedCostCents };
  }

  const totalCost = spentTodayCents + estimatedCostCents;
  const remaining = Math.max(0, dailyBudgetCents - spentTodayCents);
  const allowed = totalCost <= dailyBudgetCents;

  return { allowed, remaining };
}

/**
 * Detect if agent has timed out.
 */
export function detectAgentTimeoutLogic(
  lastHeartbeatMs: number,
  currentTimeMs: number,
  timeoutMs: number
): {
  timedOut: boolean;
  timeSinceHeartbeatMs: number;
} {
  const timeSinceHeartbeat = currentTimeMs - lastHeartbeatMs;
  const timedOut = timeSinceHeartbeat > timeoutMs;

  return { timedOut, timeSinceHeartbeatMs: timeSinceHeartbeat };
}

/**
 * Calculate agent metrics (utilization, uptime, etc).
 */
export function calculateAgentMetricsLogic(
  statusHistory: Array<{ status: string; timestamp: number }>,
  executions: any[]
): {
  utilization: number;
  failureRate: number;
  avgExecutionTime: number;
  onlinePercent: number;
} {
  // Calculate utilization from status transitions
  let busyTime = 0;
  let totalTime = 0;

  for (let i = 0; i < statusHistory.length - 1; i++) {
    const current = statusHistory[i];
    const next = statusHistory[i + 1];
    const duration = next.timestamp - current.timestamp;

    totalTime += duration;
    if (current.status === "busy") {
      busyTime += duration;
    }
  }

  const utilization = totalTime > 0 ? Math.round((busyTime / totalTime) * 100) : 0;

  // Calculate failure rate and avg execution time
  let failureCount = 0;
  let totalExecutionTime = 0;

  for (const exec of executions) {
    if (exec.status === "failed") failureCount++;
    totalExecutionTime += exec.durationMs || 0;
  }

  const failureRate =
    executions.length > 0
      ? Math.round((failureCount / executions.length) * 100) / 100
      : 0;
  const avgExecutionTime =
    executions.length > 0 ? Math.round(totalExecutionTime / executions.length) : 0;

  // Calculate uptime (% of time agent was online vs failed/stopped)
  let onlineTime = 0;
  for (const status of statusHistory) {
    if (status.status !== "failed" && status.status !== "stopped") {
      onlineTime++;
    }
  }

  const onlinePercent =
    statusHistory.length > 0
      ? Math.round((onlineTime / statusHistory.length) * 100)
      : 0;

  return {
    utilization,
    failureRate,
    avgExecutionTime,
    onlinePercent,
  };
}

/**
 * ========== PHASE 4: AGENT CONTROL & METRICS ==========
 */

/**
 * Aggregate execution metrics for a specific hour.
 */
export function aggregateMetricsLogic(
  executions: any[]
): {
  successCount: number;
  failureCount: number;
  totalTokens: number;
  totalCostCents: number;
  avgDurationMs: number;
  failureRate: number;
} {
  if (executions.length === 0) {
    return {
      successCount: 0,
      failureCount: 0,
      totalTokens: 0,
      totalCostCents: 0,
      avgDurationMs: 0,
      failureRate: 0,
    };
  }

  let successCount = 0;
  let failureCount = 0;
  let totalTokens = 0;
  let totalCost = 0;
  let totalDuration = 0;

  for (const exec of executions) {
    if (exec.status === "success") successCount++;
    if (exec.status === "failed") failureCount++;

    totalTokens += (exec.inputTokens || 0) + (exec.outputTokens || 0);
    totalCost += exec.costCents || 0;
    totalDuration += exec.durationMs || 0;
  }

  const failureRate = Math.round((failureCount / executions.length) * 100) / 100;
  const avgDurationMs = Math.round(totalDuration / executions.length);

  return {
    successCount,
    failureCount,
    totalTokens,
    totalCostCents: totalCost,
    avgDurationMs,
    failureRate,
  };
}

/**
 * Check if events should be cleaned up based on age.
 */
export function shouldCleanupEventLogic(
  eventTimestampMs: number,
  currentTimeMs: number,
  maxAgeMs: number = 24 * 60 * 60 * 1000 // 24 hours
): boolean {
  return currentTimeMs - eventTimestampMs > maxAgeMs;
}

/**
 * Validate all execution prerequisites.
 */
export function validateExecutionAllowedLogic(
  agentStatus: string,
  rateLimitAllowed: boolean,
  budgetAllowed: boolean
): {
  allowed: boolean;
  error?: string;
} {
  // Check agent status first
  if (agentStatus === "failed" || agentStatus === "stopped") {
    return {
      allowed: false,
      error: `Agent not available (status: ${agentStatus})`,
    };
  }

  // Check rate limit
  if (!rateLimitAllowed) {
    return {
      allowed: false,
      error: "Rate limit exceeded",
    };
  }

  // Check budget
  if (!budgetAllowed) {
    return {
      allowed: false,
      error: "Budget exceeded",
    };
  }

  return { allowed: true };
}

/**
 * ========== PHASE 5: OBSERVABILITY DASHBOARD ANALYTICS ==========
 */

/**
 * Calculate percent change between two values.
 * Returns null when previous is 0 (division-by-zero guard).
 */
export function calculateTrendPercent(
  current: number,
  previous: number
): number | null {
  if (previous === 0) {
    return null;
  }
  const change = ((current - previous) / previous) * 100;
  return Math.round(change * 100) / 100;
}

/**
 * Group executions into hourly time slots.
 * Returns dense array (all slots present, even if count is 0).
 * Slots are oldest-first (index 0 = oldest).
 * nowMs is injectable for testing (defaults to Date.now()).
 */
export function groupExecutionsByHour(
  executions: Array<{ startTime: number; status: string }>,
  hours: number,
  nowMs: number = Date.now()
): Array<{ hour: number; count: number; successCount: number; failureCount: number }> {
  const slotDurationMs = 3600000; // 1 hour in ms
  const windowStartMs = nowMs - hours * slotDurationMs;

  // Initialize all slots to zero
  const slots = Array.from({ length: hours }, (_, i) => ({
    hour: i,
    count: 0,
    successCount: 0,
    failureCount: 0,
  }));

  for (const exec of executions) {
    if (exec.startTime < windowStartMs || exec.startTime >= nowMs) continue;
    const slotIndex = Math.floor((exec.startTime - windowStartMs) / slotDurationMs);
    if (slotIndex < 0 || slotIndex >= hours) continue;
    slots[slotIndex].count++;
    if (exec.status === "success") slots[slotIndex].successCount++;
    if (exec.status === "failed") slots[slotIndex].failureCount++;
  }

  return slots;
}

/**
 * Build cost trend from metrics table rows.
 * Aggregates per agent into per-hour totals, sorted chronologically.
 */
export function buildCostTrend(
  metricsRows: Array<{
    date: string;
    hour: number;
    totalCostCents: number;
    agentId: string;
  }>
): Array<{ label: string; costCents: number }> {
  const hourMap = new Map<string, number>();

  for (const row of metricsRows) {
    const label = `${row.date}:${String(row.hour).padStart(2, "0")}`;
    hourMap.set(label, (hourMap.get(label) ?? 0) + row.totalCostCents);
  }

  return Array.from(hourMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, costCents]) => ({ label, costCents }));
}

/**
 * Agent efficiency input interface.
 */
export interface AgentEfficiencyInput {
  agentId: string;
  agentName: string;
  successCount: number;
  totalExecutions: number;
  totalDurationMs: number;
}

/**
 * Rank agents by efficiency: successRate * normalizedThroughput.
 */
export function rankAgentsByEfficiency(
  agentMetrics: AgentEfficiencyInput[]
): Array<{
  agentId: string;
  agentName: string;
  successRate: number;
  throughputScore: number;
  efficiencyScore: number;
  rank: number;
}> {
  if (agentMetrics.length === 0) return [];

  // Compute raw throughput (executions per ms) for each agent
  const withThroughput = agentMetrics.map((a) => {
    const successRate =
      a.totalExecutions > 0 ? a.successCount / a.totalExecutions : 0;
    const rawThroughput =
      a.totalDurationMs > 0 ? a.totalExecutions / a.totalDurationMs : 0;
    return { ...a, successRate, rawThroughput };
  });

  // Normalize throughput: divide by max so scores are 0-1
  const maxThroughput = Math.max(...withThroughput.map((a) => a.rawThroughput));

  const scored = withThroughput.map((a) => {
    const throughputScore =
      maxThroughput > 0 ? a.rawThroughput / maxThroughput : 0;
    const efficiencyScore =
      Math.round(a.successRate * throughputScore * 10000) / 10000;
    return {
      agentId: a.agentId,
      agentName: a.agentName,
      successRate: Math.round(a.successRate * 10000) / 10000,
      throughputScore: Math.round(throughputScore * 10000) / 10000,
      efficiencyScore,
    };
  });

  // Sort descending by efficiencyScore, ties broken by agentId ascending
  scored.sort((a, b) =>
    b.efficiencyScore !== a.efficiencyScore
      ? b.efficiencyScore - a.efficiencyScore
      : a.agentId.localeCompare(b.agentId)
  );

  // Assign 1-based ranks
  return scored.map((a, i) => ({ ...a, rank: i + 1 }));
}
