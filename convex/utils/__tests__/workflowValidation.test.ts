/**
 * Unit Tests for Workflow Validation Logic
 *
 * Tests all pure functions in isolation — no Convex dependencies.
 * TDD: write tests first (RED), then implement functions (GREEN).
 */

import {
  detectWorkflowCycle,
  topologicalSort,
  getReadySteps,
  validateWorkflowDefinition,
  isWorkflowTransitionAllowed,
  isStepTransitionAllowed,
  computeWorkflowStatus,
} from "../workflowValidation";

describe("detectWorkflowCycle", () => {
  test("empty graph has no cycle", () => {
    const result = detectWorkflowCycle({}, {});
    expect(result).toBe(false);
  });

  test("single node with no edges has no cycle", () => {
    const nodes = { step_1: { label: "Step 1" } };
    const edges = {};
    expect(detectWorkflowCycle(nodes, edges)).toBe(false);
  });

  test("two-node chain (step_1 -> step_2) has no cycle", () => {
    const nodes = { step_1: { label: "Step 1" }, step_2: { label: "Step 2" } };
    const edges = { step_1: ["step_2"] };
    expect(detectWorkflowCycle(nodes, edges)).toBe(false);
  });

  test("three-node diamond (step_1 -> step_2,3; step_2,3 -> step_4) has no cycle", () => {
    const nodes = {
      step_1: { label: "Step 1" },
      step_2: { label: "Step 2" },
      step_3: { label: "Step 3" },
      step_4: { label: "Step 4" },
    };
    const edges = {
      step_1: ["step_2", "step_3"],
      step_2: ["step_4"],
      step_3: ["step_4"],
    };
    expect(detectWorkflowCycle(nodes, edges)).toBe(false);
  });

  test("direct self-loop (step_1 -> step_1) is a cycle", () => {
    const nodes = { step_1: { label: "Step 1" } };
    const edges = { step_1: ["step_1"] };
    expect(detectWorkflowCycle(nodes, edges)).toBe(true);
  });

  test("two-node cycle (step_1 -> step_2, step_2 -> step_1) is detected", () => {
    const nodes = { step_1: { label: "Step 1" }, step_2: { label: "Step 2" } };
    const edges = {
      step_1: ["step_2"],
      step_2: ["step_1"],
    };
    expect(detectWorkflowCycle(nodes, edges)).toBe(true);
  });

  test("transitive cycle (step_1 -> step_2 -> step_3 -> step_1) is detected", () => {
    const nodes = {
      step_1: { label: "Step 1" },
      step_2: { label: "Step 2" },
      step_3: { label: "Step 3" },
    };
    const edges = {
      step_1: ["step_2"],
      step_2: ["step_3"],
      step_3: ["step_1"],
    };
    expect(detectWorkflowCycle(nodes, edges)).toBe(true);
  });
});

describe("topologicalSort", () => {
  test("empty graph returns empty array", () => {
    const result = topologicalSort({}, {});
    expect(result).toEqual([]);
  });

  test("single node returns [nodeId]", () => {
    const nodes = { step_1: { label: "Step 1" } };
    const edges = {};
    expect(topologicalSort(nodes, edges)).toEqual(["step_1"]);
  });

  test("linear chain (step_1 -> step_2 -> step_3) sorts in order", () => {
    const nodes = {
      step_1: { label: "Step 1" },
      step_2: { label: "Step 2" },
      step_3: { label: "Step 3" },
    };
    const edges = {
      step_1: ["step_2"],
      step_2: ["step_3"],
    };
    const result = topologicalSort(nodes, edges);
    const step_1_idx = result!.indexOf("step_1");
    const step_2_idx = result!.indexOf("step_2");
    const step_3_idx = result!.indexOf("step_3");
    expect(step_1_idx).toBeLessThan(step_2_idx);
    expect(step_2_idx).toBeLessThan(step_3_idx);
  });

  test("diamond (step_1 -> [step_2, step_3] -> step_4) sorts with step_1 first, step_4 last", () => {
    const nodes = {
      step_1: { label: "Step 1" },
      step_2: { label: "Step 2" },
      step_3: { label: "Step 3" },
      step_4: { label: "Step 4" },
    };
    const edges = {
      step_1: ["step_2", "step_3"],
      step_2: ["step_4"],
      step_3: ["step_4"],
    };
    const result = topologicalSort(nodes, edges);
    expect(result![0]).toBe("step_1");
    expect(result![result!.length - 1]).toBe("step_4");
    expect(result!.indexOf("step_2")).toBeGreaterThan(0);
    expect(result!.indexOf("step_3")).toBeGreaterThan(0);
  });

  test("cycle returns null (non-topological graph)", () => {
    const nodes = { step_1: { label: "Step 1" }, step_2: { label: "Step 2" } };
    const edges = {
      step_1: ["step_2"],
      step_2: ["step_1"],
    };
    expect(topologicalSort(nodes, edges)).toBeNull();
  });
});

describe("getReadySteps", () => {
  test("with no steps completed, only entry node is ready", () => {
    const nodes = { step_1: { label: "Step 1" } };
    const edges = {};
    // Assume step_1 is entry node (for now, just get nodes with no predecessors)
    const result = getReadySteps(nodes, edges, []);
    expect(result).toContain("step_1");
  });

  test("when step_1 completed in (step_1 -> step_2) chain, step_2 becomes ready", () => {
    const nodes = {
      step_1: { label: "Step 1" },
      step_2: { label: "Step 2" },
    };
    const edges = { step_1: ["step_2"] };
    const result = getReadySteps(nodes, edges, ["step_1"]);
    expect(result).toContain("step_2");
    expect(result).not.toContain("step_1");
  });

  test("parallel fanout: when step_1 completed, both step_2 and step_3 become ready", () => {
    const nodes = {
      step_1: { label: "Step 1" },
      step_2: { label: "Step 2" },
      step_3: { label: "Step 3" },
    };
    const edges = { step_1: ["step_2", "step_3"] };
    const result = getReadySteps(nodes, edges, ["step_1"]);
    expect(result).toContain("step_2");
    expect(result).toContain("step_3");
  });

  test("diamond: when step_1 done, step_2,3 ready; when step_2,3 done, step_4 ready", () => {
    const nodes = {
      step_1: { label: "Step 1" },
      step_2: { label: "Step 2" },
      step_3: { label: "Step 3" },
      step_4: { label: "Step 4" },
    };
    const edges = {
      step_1: ["step_2", "step_3"],
      step_2: ["step_4"],
      step_3: ["step_4"],
    };
    // After step_1 done
    let result = getReadySteps(nodes, edges, ["step_1"]);
    expect(result).toContain("step_2");
    expect(result).toContain("step_3");
    expect(result).not.toContain("step_4");

    // After step_1, step_2, step_3 done
    result = getReadySteps(nodes, edges, ["step_1", "step_2", "step_3"]);
    expect(result).toContain("step_4");
  });

  test("with all steps completed, nothing is ready", () => {
    const nodes = {
      step_1: { label: "Step 1" },
      step_2: { label: "Step 2" },
    };
    const edges = { step_1: ["step_2"] };
    const result = getReadySteps(nodes, edges, ["step_1", "step_2"]);
    expect(result).toHaveLength(0);
  });

  test("steps with multiple predecessors require all predecessors done", () => {
    const nodes = {
      step_1: { label: "Step 1" },
      step_2: { label: "Step 2" },
      step_3: { label: "Step 3" }, // requires both step_1 and step_2
    };
    const edges = {
      step_1: ["step_3"],
      step_2: ["step_3"],
    };
    // Only step_1 done — step_3 not ready yet
    let result = getReadySteps(nodes, edges, ["step_1"]);
    expect(result).not.toContain("step_3");

    // Both done — step_3 ready
    result = getReadySteps(nodes, edges, ["step_1", "step_2"]);
    expect(result).toContain("step_3");
  });
});

describe("validateWorkflowDefinition", () => {
  test("valid simple definition (single step) passes", () => {
    const definition = {
      nodes: {
        step_1: {
          agentId: "agent_1",
          taskTemplate: {
            title: "Task 1",
            description: "Do something",
          },
        },
      },
      edges: {},
      entryNodeId: "step_1",
    };
    const result = validateWorkflowDefinition(definition);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("valid chain definition passes", () => {
    const definition = {
      nodes: {
        step_1: {
          agentId: "agent_1",
          taskTemplate: {
            title: "Task 1",
            description: "Do something",
          },
        },
        step_2: {
          agentId: "agent_2",
          taskTemplate: {
            title: "Task 2",
            description: "Do something else",
          },
        },
      },
      edges: { step_1: ["step_2"] },
      entryNodeId: "step_1",
    };
    const result = validateWorkflowDefinition(definition);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("empty nodes object fails", () => {
    const definition = {
      nodes: {},
      edges: {},
      entryNodeId: "step_1",
    };
    const result = validateWorkflowDefinition(definition);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("missing entryNodeId fails", () => {
    const definition = {
      nodes: {
        step_1: {
          agentId: "agent_1",
          taskTemplate: { title: "Task 1", description: "Do something" },
        },
      },
      edges: {},
      entryNodeId: "missing_step",
    };
    const result = validateWorkflowDefinition(definition);
    expect(result.valid).toBe(false);
  });

  test("cycle in graph fails validation", () => {
    const definition = {
      nodes: {
        step_1: {
          agentId: "agent_1",
          taskTemplate: { title: "Task 1", description: "Do something" },
        },
        step_2: {
          agentId: "agent_2",
          taskTemplate: { title: "Task 2", description: "Do something else" },
        },
      },
      edges: {
        step_1: ["step_2"],
        step_2: ["step_1"], // cycle!
      },
      entryNodeId: "step_1",
    };
    const result = validateWorkflowDefinition(definition);
    expect(result.valid).toBe(false);
  });

  test("edge references non-existent node fails", () => {
    const definition = {
      nodes: {
        step_1: {
          agentId: "agent_1",
          taskTemplate: { title: "Task 1", description: "Do something" },
        },
      },
      edges: {
        step_1: ["non_existent_step"], // references missing node
      },
      entryNodeId: "step_1",
    };
    const result = validateWorkflowDefinition(definition);
    expect(result.valid).toBe(false);
  });
});

describe("isWorkflowTransitionAllowed", () => {
  test("pending -> running is allowed", () => {
    expect(isWorkflowTransitionAllowed("pending", "running")).toBe(true);
  });

  test("running -> success is allowed", () => {
    expect(isWorkflowTransitionAllowed("running", "success")).toBe(true);
  });

  test("running -> failed is allowed", () => {
    expect(isWorkflowTransitionAllowed("running", "failed")).toBe(true);
  });

  test("running -> aborted is allowed", () => {
    expect(isWorkflowTransitionAllowed("running", "aborted")).toBe(true);
  });

  test("success -> running is NOT allowed (backward transition)", () => {
    expect(isWorkflowTransitionAllowed("success", "running")).toBe(false);
  });

  test("failed -> running is NOT allowed", () => {
    expect(isWorkflowTransitionAllowed("failed", "running")).toBe(false);
  });

  test("aborted -> running is NOT allowed", () => {
    expect(isWorkflowTransitionAllowed("aborted", "running")).toBe(false);
  });

  test("pending -> success (skip running) is NOT allowed", () => {
    expect(isWorkflowTransitionAllowed("pending", "success")).toBe(false);
  });
});

describe("isStepTransitionAllowed", () => {
  test("pending -> running is allowed", () => {
    expect(isStepTransitionAllowed("pending", "running")).toBe(true);
  });

  test("running -> success is allowed", () => {
    expect(isStepTransitionAllowed("running", "success")).toBe(true);
  });

  test("running -> failed is allowed", () => {
    expect(isStepTransitionAllowed("running", "failed")).toBe(true);
  });

  test("pending -> skipped is allowed (cancellation)", () => {
    expect(isStepTransitionAllowed("pending", "skipped")).toBe(true);
  });

  test("running -> skipped is NOT allowed (can't skip running step)", () => {
    expect(isStepTransitionAllowed("running", "skipped")).toBe(false);
  });

  test("success -> failed is NOT allowed (backward)", () => {
    expect(isStepTransitionAllowed("success", "failed")).toBe(false);
  });
});

describe("computeWorkflowStatus", () => {
  test("all steps pending -> workflow pending", () => {
    const statuses = {
      step_1: "pending" as const,
      step_2: "pending" as const,
    };
    expect(computeWorkflowStatus(statuses)).toBe("pending");
  });

  test("any step running -> workflow running", () => {
    const statuses = {
      step_1: "success" as const,
      step_2: "running" as const,
      step_3: "pending" as const,
    };
    expect(computeWorkflowStatus(statuses)).toBe("running");
  });

  test("all steps success -> workflow success", () => {
    const statuses = {
      step_1: "success" as const,
      step_2: "success" as const,
    };
    expect(computeWorkflowStatus(statuses)).toBe("success");
  });

  test("any step failed -> workflow failed", () => {
    const statuses = {
      step_1: "success" as const,
      step_2: "failed" as const,
      step_3: "success" as const,
    };
    expect(computeWorkflowStatus(statuses)).toBe("failed");
  });

  test("mixed success/skipped (no running/failed) -> workflow success", () => {
    const statuses = {
      step_1: "success" as const,
      step_2: "skipped" as const,
      step_3: "success" as const,
    };
    expect(computeWorkflowStatus(statuses)).toBe("success");
  });

  test("priority: failed > running > success/skipped > pending", () => {
    // Test that failed takes priority
    let statuses = {
      step_1: "failed" as const,
      step_2: "running" as const,
      step_3: "success" as const,
    };
    expect(computeWorkflowStatus(statuses)).toBe("failed");

    // Test that running takes priority over success
    statuses = {
      step_1: "running" as const,
      step_2: "success" as const,
    };
    expect(computeWorkflowStatus(statuses)).toBe("running");
  });
});
