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
