/**
 * Pure Logic Functions for Workflow Validation
 *
 * Zero Convex dependencies. All functions are deterministic and testable in isolation.
 * Used by Convex mutations to validate workflows before persisting.
 */

/**
 * Represents a workflow execution status.
 */
export type WorkflowExecutionStatus =
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "aborted";

/**
 * Represents a step execution status.
 */
export type StepExecutionStatus =
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "skipped";

/**
 * Result of workflow validation.
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Represents a workflow node/step.
 */
export interface WorkflowNode {
  agentId?: string;
  taskTemplate: {
    title: string;
    description: string;
    priority?: string;
    timeEstimate?: string;
    tags?: string[];
  };
  retryPolicy?: {
    maxAttempts: number;
    delayMs: number;
  };
  timeoutMs?: number;
  inputMapping?: Record<string, unknown>;
  outputMapping?: Record<string, unknown>;
}

/**
 * Represents a workflow definition.
 */
export interface WorkflowDefinition {
  nodes: Record<string, WorkflowNode>;
  edges: Record<string, string[]>; // fromNodeId -> [toNodeId, ...]
  entryNodeId: string;
  conditionalBranches?: Record<string, unknown>;
}

/**
 * Detect if a workflow graph contains a cycle using DFS.
 *
 * @param nodes - Map of node IDs to node objects
 * @param edges - Map of node IDs to arrays of successor node IDs
 * @returns true if a cycle is detected, false otherwise
 */
export function detectWorkflowCycle(
  nodes: Record<string, WorkflowNode>,
  edges: Record<string, string[]>
): boolean {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const successors = edges[nodeId] || [];
    for (const successor of successors) {
      if (!visited.has(successor)) {
        if (dfs(successor)) {
          return true;
        }
      } else if (recursionStack.has(successor)) {
        // Back edge found — cycle detected
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  for (const nodeId of Object.keys(nodes)) {
    if (!visited.has(nodeId)) {
      if (dfs(nodeId)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Topologically sort workflow nodes using Kahn's algorithm.
 *
 * @param nodes - Map of node IDs to node objects
 * @param edges - Map of node IDs to arrays of successor node IDs
 * @returns Array of node IDs in topological order, or null if a cycle is detected
 */
export function topologicalSort(
  nodes: Record<string, WorkflowNode>,
  edges: Record<string, string[]>
): string[] | null {
  // If no nodes, return empty array
  if (Object.keys(nodes).length === 0) {
    return [];
  }

  // Detect cycle first
  if (detectWorkflowCycle(nodes, edges)) {
    return null;
  }

  // Calculate in-degree for each node
  const inDegree: Record<string, number> = {};
  for (const nodeId of Object.keys(nodes)) {
    inDegree[nodeId] = 0;
  }

  for (const successors of Object.values(edges)) {
    for (const successor of successors) {
      inDegree[successor] = (inDegree[successor] || 0) + 1;
    }
  }

  // Find all nodes with in-degree 0
  const queue: string[] = [];
  for (const nodeId of Object.keys(nodes)) {
    if (inDegree[nodeId] === 0) {
      queue.push(nodeId);
    }
  }

  const result: string[] = [];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    result.push(nodeId);

    const successors = edges[nodeId] || [];
    for (const successor of successors) {
      inDegree[successor]--;
      if (inDegree[successor] === 0) {
        queue.push(successor);
      }
    }
  }

  // If we processed all nodes, the sort is valid
  if (result.length === Object.keys(nodes).length) {
    return result;
  }

  // Otherwise, there's a cycle (shouldn't happen since we checked above)
  return null;
}

/**
 * Compute which workflow steps are ready to run given the current completion state.
 *
 * A step is ready if:
 * 1. It is not yet completed
 * 2. All of its predecessors (steps that must run before it) are completed
 *
 * @param nodes - Map of node IDs to node objects
 * @param edges - Map of node IDs to arrays of successor node IDs
 * @param completedNodeIds - Array of node IDs that have been completed
 * @returns Array of node IDs that are ready to execute
 */
export function getReadySteps(
  nodes: Record<string, WorkflowNode>,
  edges: Record<string, string[]>,
  completedNodeIds: string[]
): string[] {
  const completed = new Set(completedNodeIds);

  // Build reverse edges (predecessors)
  const predecessors: Record<string, Set<string>> = {};
  for (const nodeId of Object.keys(nodes)) {
    predecessors[nodeId] = new Set();
  }

  for (const [fromNodeId, toNodeIds] of Object.entries(edges)) {
    for (const toNodeId of toNodeIds) {
      predecessors[toNodeId].add(fromNodeId);
    }
  }

  const ready: string[] = [];

  for (const nodeId of Object.keys(nodes)) {
    // Skip if already completed
    if (completed.has(nodeId)) {
      continue;
    }

    // Check if all predecessors are completed
    const preds = predecessors[nodeId];
    let allPredsComplete = true;

    for (const predId of preds) {
      if (!completed.has(predId)) {
        allPredsComplete = false;
        break;
      }
    }

    if (allPredsComplete) {
      ready.push(nodeId);
    }
  }

  return ready;
}

/**
 * Validate a workflow definition.
 *
 * Checks:
 * - Definition has at least one node
 * - Entry node exists in nodes
 * - All edges reference existing nodes
 * - Graph has no cycles
 *
 * @param definition - The workflow definition to validate
 * @returns ValidationResult with valid flag and any error messages
 */
export function validateWorkflowDefinition(
  definition: WorkflowDefinition
): ValidationResult {
  const errors: string[] = [];

  // Check nodes exist
  if (!definition.nodes || Object.keys(definition.nodes).length === 0) {
    errors.push("Workflow must have at least one node");
    return { valid: false, errors };
  }

  // Check entry node exists
  if (!definition.entryNodeId || !definition.nodes[definition.entryNodeId]) {
    errors.push(
      `Entry node "${definition.entryNodeId}" does not exist in workflow nodes`
    );
  }

  // Check all edges reference existing nodes
  if (definition.edges) {
    for (const [fromNodeId, toNodeIds] of Object.entries(definition.edges)) {
      if (!definition.nodes[fromNodeId]) {
        errors.push(`Edge source node "${fromNodeId}" does not exist`);
      }

      for (const toNodeId of toNodeIds) {
        if (!definition.nodes[toNodeId]) {
          errors.push(`Edge target node "${toNodeId}" does not exist`);
        }
      }
    }
  }

  // Check for cycles
  if (detectWorkflowCycle(definition.nodes, definition.edges || {})) {
    errors.push("Workflow graph contains a cycle");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if a workflow execution can transition from one status to another.
 *
 * Valid transitions:
 * - pending → running
 * - running → success, failed, aborted
 *
 * Invalid transitions:
 * - Backward transitions (terminal states cannot transition)
 * - Skipping running state
 *
 * @param from - Current workflow status
 * @param to - Target workflow status
 * @returns true if transition is allowed, false otherwise
 */
export function isWorkflowTransitionAllowed(
  from: WorkflowExecutionStatus,
  to: WorkflowExecutionStatus
): boolean {
  // Allowed state machines:
  // pending -> running
  // running -> success | failed | aborted
  // success, failed, aborted are terminal states

  if (from === "pending") {
    return to === "running";
  }

  if (from === "running") {
    return to === "success" || to === "failed" || to === "aborted";
  }

  // Terminal states cannot transition
  return false;
}

/**
 * Check if a workflow step can transition from one status to another.
 *
 * Valid transitions:
 * - pending → running, skipped (cancellation)
 * - running → success, failed
 *
 * Invalid transitions:
 * - Backward transitions
 * - Skipping non-pending steps (can't cancel already-running steps)
 *
 * @param from - Current step status
 * @param to - Target step status
 * @returns true if transition is allowed, false otherwise
 */
export function isStepTransitionAllowed(
  from: StepExecutionStatus,
  to: StepExecutionStatus
): boolean {
  // Allowed state machines:
  // pending -> running, skipped
  // running -> success, failed
  // success, failed, skipped are terminal states

  if (from === "pending") {
    return to === "running" || to === "skipped";
  }

  if (from === "running") {
    return to === "success" || to === "failed";
  }

  // Terminal states cannot transition
  return false;
}

/**
 * Compute the overall workflow execution status based on its step statuses.
 *
 * Priority:
 * 1. failed (any step failed → workflow failed)
 * 2. running (any step running → workflow running)
 * 3. success/skipped (all steps success or skipped → workflow success)
 * 4. pending (all steps pending → workflow pending)
 *
 * @param stepStatuses - Map of step IDs to their execution status
 * @returns The computed workflow execution status
 */
export function computeWorkflowStatus(
  stepStatuses: Record<string, StepExecutionStatus>
): WorkflowExecutionStatus {
  const statuses = Object.values(stepStatuses);

  // Check for failed steps (highest priority)
  if (statuses.some((s) => s === "failed")) {
    return "failed";
  }

  // Check for running steps
  if (statuses.some((s) => s === "running")) {
    return "running";
  }

  // Check for pending steps
  if (statuses.some((s) => s === "pending")) {
    return "pending";
  }

  // All steps are success or skipped
  return "success";
}
