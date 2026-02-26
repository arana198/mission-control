# Architecture Patterns: Workflow Orchestration & Multi-Agent State Machines

**Domain:** Multi-agent workflow orchestration with DAG execution, governance, and audit trail
**Researched:** 2026-02-26
**Overall confidence:** HIGH (verified against existing codebase, industry patterns, and Convex constraints)

---

## Recommended Architecture

Mission Control's workflow engine is a **DAG-based orchestrator with embedded state machines** running on Convex's reactive backend. The architecture splits into five bounded components, each with clear responsibilities and well-defined interfaces.

### System Overview (Text Diagram)

```
                     +-------------------+
                     |   Next.js Frontend |
                     |  (Workflow Builder |
                     |   + Dashboard)    |
                     +--------+----------+
                              |
                     Convex Live Queries + Mutations
                              |
          +-------------------+-------------------+
          |                   |                   |
+---------v-------+ +---------v-------+ +---------v-------+
| Workflow Engine  | | Agent Registry  | | Observability   |
| (DAG Executor)  | | (Registration + | | (Metrics +      |
|                 | |  Discovery)     | |  Events +       |
| - State Machine | | - Heartbeat     | |  Audit Log)     |
| - Step Dispatch | | - Health Check  | |                 |
| - Data Chaining | | - Capabilities  | |                 |
+---------+-------+ +---------+-------+ +---------+-------+
          |                   |                   |
          +-------------------+-------------------+
                              |
                     +--------v----------+
                     | Gateway Bridge    |
                     | (WebSocket RPC    |
                     |  to OpenClaw)     |
                     +-------------------+
                              |
                     +--------v----------+
                     | OpenClaw Gateways |
                     | (Agent Runtime)   |
                     +-------------------+
```

### Data Flow: Workflow Execution Lifecycle

```
1. User creates workflow definition (DAG: nodes + edges)
   --> workflows table (validated: no cycles, edges reference valid nodes)

2. User triggers execution
   --> workflow_executions table (status: "pending")
   --> Budget pre-check: estimatedCost <= budgetCents
   --> Status: pending -> running

3. Workflow Engine resolves ready steps (topological sort + predecessor check)
   --> For each ready step:
       a. Create execution record (executions table, status: "pending")
       b. Merge input data: step.inputMapping + predecessor.outputData
       c. Dispatch to agent via Gateway Bridge (WebSocket RPC)
       d. Step status: pending -> running

4. Agent completes work (via Gateway callback or polling)
   --> Step status: running -> success/failed
   --> Store outputData on execution record
   --> Merge outputData into successor steps' input context
   --> Workflow Engine: re-evaluate ready steps (loop to step 3)

5. All steps complete (or failure halts execution)
   --> workflow_executions status: running -> success/failed
   --> Final cost tally: sum of all step costs
   --> Immutable event log: workflow_completed/workflow_failed
```

---

## Component Boundaries

### Component 1: Workflow Definition Layer

| Aspect | Detail |
|--------|--------|
| **Responsibility** | CRUD for workflow definitions, DAG validation, versioning |
| **Tables** | `workflows` (existing) |
| **Communicates With** | Workflow Engine (provides definition), Frontend (builder UI) |
| **Key Constraint** | Validation MUST happen at write time, not execution time |

**What already exists:** The `workflows` table with `definition.nodes`, `definition.edges`, and `definition.conditionalBranches`. The `workflowValidation.ts` pure logic layer with `detectWorkflowCycle()`, `topologicalSort()`, `getReadySteps()`, `validateWorkflowDefinition()`, and both state machine validators.

**What needs building:**
- Workflow CRUD mutations that call validation before persisting
- Workflow versioning (immutable snapshots per execution)
- Entry node validation (must be reachable, must have zero in-degree)
- Budget estimation at definition time (sum of step cost estimates)

### Component 2: Workflow Engine (DAG Executor)

| Aspect | Detail |
|--------|--------|
| **Responsibility** | Execute workflow runs: advance steps, handle failures, manage data flow |
| **Tables** | `workflow_executions` (existing), `executions` (existing, per-step) |
| **Communicates With** | Definition Layer (reads DAG), Gateway Bridge (dispatches work), Agent Registry (resolves agents), Observability (emits events) |
| **Key Constraint** | Convex mutations are synchronous; long-running steps must be async via actions + callbacks |

**State Machine: Workflow Execution**

```
             +----------+
             |  pending  |
             +----+-----+
                  |
          budget check passes
                  |
             +----v-----+
        +----|  running  |----+
        |    +----+-----+    |
        |         |          |
   all steps   any step   user abort
   succeed     fails
        |         |          |
   +----v--+  +---v---+  +--v----+
   |success|  |failed |  |aborted|
   +-------+  +-------+  +-------+
```

Valid transitions (already implemented in `isWorkflowTransitionAllowed`):
- `pending` -> `running`
- `running` -> `success` | `failed` | `aborted`
- Terminal states: `success`, `failed`, `aborted` (no transitions out)

**State Machine: Step Execution**

```
             +----------+
             |  pending  |
             +----+-----+
                  |
          +-------+-------+
          |               |
    predecessors     workflow aborted
    complete              |
          |          +----v-----+
     +----v-----+   |  skipped  |
     |  running  |   +----------+
     +----+-----+
          |
     +----+-----+
     |          |
  success    failed
     |          |
+----v--+  +---v---+
|success|  |failed |
+-------+  +-------+
```

Valid transitions (already implemented in `isStepTransitionAllowed`):
- `pending` -> `running` | `skipped`
- `running` -> `success` | `failed`
- Terminal states: `success`, `failed`, `skipped`

**Concurrency Model:**
Multiple steps CAN execute concurrently within a single workflow run. The `getReadySteps()` function (already implemented) returns all steps whose predecessors are complete, enabling fan-out parallelism. Multiple workflow executions of the same workflow definition CAN run simultaneously (no serial blocking -- this is an explicit architectural decision from Phase 10).

**Step Advancement Algorithm (Core Loop):**

```typescript
// Pseudocode for advanceWorkflowStep (Convex mutation)
async function advanceWorkflowStep(ctx, { workflowExecutionId, completedStepId, outputData }) {
  // 1. Record step completion + store outputData
  await ctx.db.patch(stepExecutionId, { status: "success", outputData });

  // 2. Get workflow definition + all step statuses
  const execution = await ctx.db.get(workflowExecutionId);
  const workflow = await ctx.db.get(execution.workflowId);
  const { nodes, edges } = workflow.definition;

  // 3. Compute ready steps
  const completedIds = getCompletedStepIds(execution);
  const readySteps = getReadySteps(nodes, edges, completedIds);

  // 4. For each ready step: merge input data + dispatch
  for (const stepId of readySteps) {
    const predecessorOutputs = gatherPredecessorOutputs(edges, completedIds, execution);
    const mergedInput = { ...predecessorOutputs, ...(nodes[stepId].inputMapping || {}) };
    await dispatchStep(ctx, workflowExecutionId, stepId, mergedInput);
  }

  // 5. Check if workflow is complete
  const allStatuses = computeAllStepStatuses(execution);
  const workflowStatus = computeWorkflowStatus(allStatuses);
  if (workflowStatus !== "running") {
    await ctx.db.patch(workflowExecutionId, { status: workflowStatus });
  }
}
```

### Component 3: Data Chaining (Input/Output Merging)

| Aspect | Detail |
|--------|--------|
| **Responsibility** | Automatic data flow between workflow steps |
| **Pattern** | Predecessor output auto-merged into successor input |
| **Type Safety** | Runtime validation; compile-time types via Convex schema |

**How data flows between steps:**

1. Each step execution record stores `inputData` and `outputData` as `v.any()` (JSON-serializable objects)
2. When step N completes, its `outputData` is persisted on the execution record
3. When step N+1 becomes ready, the engine:
   a. Gathers `outputData` from ALL direct predecessors of step N+1
   b. Merges them into a single context object (later predecessors override earlier on key conflicts)
   c. Overlays the step's own `inputMapping` on top (explicit mappings override auto-merged data)
   d. Passes the final merged object as `inputData` to step N+1

**Merge Strategy:**

```typescript
function buildStepInput(
  predecessorOutputs: Record<string, unknown>[],  // from all direct predecessors
  stepInputMapping: Record<string, unknown> | undefined  // from workflow definition
): Record<string, unknown> {
  // Auto-merge: spread all predecessor outputs (later wins on conflict)
  const autoMerged = Object.assign({}, ...predecessorOutputs);

  // Explicit mapping overrides auto-merged
  return { ...autoMerged, ...(stepInputMapping || {}) };
}
```

**Why this design:**
- Simple mental model: "step output flows downstream automatically"
- Explicit `inputMapping` on the step definition allows renaming/filtering fields
- No complex schema negotiation needed at definition time
- Matches the architectural decision from Phase 10: "Automatic chaining -- step N's outputData auto-merged into step N+1's inputData"

### Component 4: Agent Registry & Discovery

| Aspect | Detail |
|--------|--------|
| **Responsibility** | Agent registration, capability tracking, health monitoring, availability routing |
| **Tables** | `agents` (existing), `agent_status` (existing), `agentSkills` (existing) |
| **Communicates With** | Workflow Engine (provides agent availability), Gateway Bridge (routes to correct gateway) |

**What already exists:**
- Agent self-registration via HTTP API (`agents.register` mutation)
- API key authentication with grace-period rotation (`agents.rotateKey`)
- Heartbeat mechanism with rate limiting (`agents.heartbeat`)
- Agent status tracking in separate table (`agent_status`) to avoid contention
- Skill inference system (`agentSkills` table)
- Gateway association (`agents.gatewayId`)

**Registration Pattern (already implemented):**

```
Agent boots --> POST /api/agents/register
  { name, role, level, sessionKey, capabilities, workspacePath }
  --> Returns: { agentId, apiKey, isNew }

Agent heartbeat --> POST /api/agents/{agentId}/heartbeat (rate limited: 6/min)
  --> Updates lastHeartbeat timestamp

Agent key rotation --> POST /api/agents/{agentId}/rotate-key
  --> Returns new key, old key valid during grace period (0-300s)
```

**Health Check for Workflow Dispatch:**

Before dispatching a step to an agent, the Workflow Engine must verify:
1. Agent exists in registry (`agents` table)
2. Agent status is not `failed` or `stopped` (`agent_status` table)
3. Agent's gateway is healthy (`gateways.isHealthy`)
4. Agent has not exceeded rate limits

**Capability-Based Routing (future enhancement):**

When a workflow step specifies a `role` instead of a specific `agentId`, the engine should:
1. Query `agentSkills` for agents matching the required capabilities
2. Filter to agents with `status !== "failed"` and healthy gateway
3. Select by load balancing (fewest queued tasks via `agent_status.queuedTaskCount`)

### Component 5: Gateway Bridge (OpenClaw Integration)

| Aspect | Detail |
|--------|--------|
| **Responsibility** | Dispatch step execution to OpenClaw agents via WebSocket RPC, receive results |
| **Services** | `gatewayRpc.ts` (existing), `agentProvisioning.ts` (existing), `gatewayConnectionPool.ts` (existing) |
| **Communicates With** | Workflow Engine (receives dispatch commands, returns results), Agent Registry (resolves agent -> gateway mapping) |

**What already exists:**
- WebSocket JSON-RPC v3 protocol client (`gatewayRpc.ts`)
- Connection pooling with TTL (`gatewayConnectionPool.ts`, POOL_TTL_MS=60s, MAX_PER_KEY=3)
- Agent provisioning with template files (`agentProvisioning.ts`)
- Gateway health checking and status tracking
- Session management (session keys per agent per workspace)

**Dispatch Flow for Workflow Steps:**

```
Workflow Engine (Convex mutation)
  --> Schedules Convex action (async, can make network calls)
  --> Action: acquire WebSocket from pool
  --> Action: call(ws, "tasks.execute", { agentKey, sessionKey, input: mergedInputData })
  --> Action: await response (30s timeout)
  --> Action: release WebSocket to pool
  --> Action: call back to Convex mutation with result
  --> Mutation: update step status + outputData
  --> Mutation: advance workflow (trigger next ready steps)
```

**Key architectural point:** Convex mutations cannot make network calls. Dispatching to OpenClaw MUST happen in a Convex action (server-side function that can call external APIs). The callback from action to mutation is the standard Convex pattern for durable async workflows.

---

## Patterns to Follow

### Pattern 1: Convex Action-Mutation Handoff for External Calls

**What:** Use Convex actions for gateway WebSocket calls, then call mutations to record results.

**When:** Any time the workflow engine needs to dispatch work to an external agent.

**Why:** Convex mutations are deterministic and cannot make network calls. Actions CAN make network calls but cannot write to the database directly. The handoff pattern is idiomatic Convex.

```typescript
// Action: dispatches to gateway, then calls mutation with result
export const dispatchStepAction = action({
  args: { workflowExecutionId, stepId, agentId, gatewayId, inputData },
  handler: async (ctx, args) => {
    // 1. Get gateway config
    const gateway = await ctx.runQuery(api.gateways.getWorkspaceById, { gatewayId: args.gatewayId });

    // 2. Connect and dispatch via WebSocket
    const ws = await connect({ url: gateway.url, token: gateway.token, ... });
    try {
      const result = await call(ws, "tasks.execute", {
        agentKey: args.agentKey,
        input: args.inputData,
      });

      // 3. Record success via mutation
      await ctx.runMutation(api.workflowEngine.onStepComplete, {
        workflowExecutionId: args.workflowExecutionId,
        stepId: args.stepId,
        outputData: result,
      });
    } catch (error) {
      // 4. Record failure via mutation
      await ctx.runMutation(api.workflowEngine.onStepFailed, {
        workflowExecutionId: args.workflowExecutionId,
        stepId: args.stepId,
        error: error.message,
      });
    } finally {
      ws.close();
    }
  },
});
```

### Pattern 2: Immutable Event Sourcing for Audit Trail

**What:** Every workflow state transition emits an immutable event to the `events` table.

**When:** Workflow starts, step dispatched, step completes, step fails, workflow completes, workflow aborted.

**Why:** The `events` table already exists with 24h retention. For audit-grade persistence, workflow events should ALSO be stored in a dedicated `workflow_events` table (append-only, no mutations for update/delete).

```typescript
// Every state transition emits an event
await ctx.db.insert("events", {
  type: "workflow_started",
  workflowId,
  message: `Workflow "${workflowName}" execution started`,
  severity: "info",
  timestamp: Date.now(),
});
```

### Pattern 3: Budget Pre-Check Gate

**What:** Before dispatching any step, verify the workflow execution has remaining budget.

**When:** Every step dispatch, not just workflow start.

**Why:** Costs accumulate per step. A workflow might pass the initial budget check but exceed its budget partway through execution.

```typescript
async function checkBudgetBeforeDispatch(ctx, workflowExecution, estimatedStepCost) {
  const remaining = workflowExecution.totalBudgetCents - workflowExecution.spentCents;
  if (estimatedStepCost > remaining) {
    // Halt execution, don't dispatch
    await ctx.db.patch(workflowExecution._id, { status: "aborted" });
    await ctx.db.insert("events", {
      type: "workflow_completed", // or add "workflow_budget_exceeded"
      workflowId: workflowExecution.workflowId,
      message: `Budget exceeded: spent ${workflowExecution.spentCents}c, budget ${workflowExecution.totalBudgetCents}c`,
      severity: "warning",
      timestamp: Date.now(),
    });
    return false;
  }
  return true;
}
```

### Pattern 4: Idempotent Step Execution

**What:** Step dispatch must be idempotent -- retrying a dispatch for the same step should not create duplicate work.

**When:** Network failures, Convex action retries, gateway reconnections.

**Why:** Convex actions may be retried automatically. Without idempotency, a step could execute twice.

```typescript
// Use step execution ID as idempotency key
const existingExecution = await ctx.db
  .query("executions")
  .withIndex("by_workflow_step", q =>
    q.eq("workflowId", workflowId).eq("stepId", stepId)
  )
  .first();

if (existingExecution && existingExecution.status !== "failed") {
  // Already dispatched, skip
  return;
}
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Polling for Step Completion

**What:** Repeatedly querying the database to check if a step has finished.

**Why bad:** Wastes database reads, adds latency. Convex's reactive subscriptions make polling unnecessary.

**Instead:** Use Convex's reactive query system. The frontend subscribes to `workflow_executions` and automatically sees updates when steps complete. The backend uses mutation callbacks (action completes -> calls mutation -> triggers reactive update).

### Anti-Pattern 2: Storing Workflow State in Memory

**What:** Keeping the current execution state in a JavaScript variable rather than the database.

**Why bad:** Convex functions are stateless and may run on different machines. In-memory state is lost on restart.

**Instead:** All workflow execution state lives in Convex tables. Every step advancement is a mutation that reads current state, computes next state, and writes it back atomically.

### Anti-Pattern 3: Synchronous Multi-Step Execution in a Single Mutation

**What:** Running all workflow steps inside one long-running Convex mutation.

**Why bad:** Convex mutations have execution time limits. A workflow with 10 steps, each taking 30 seconds, would timeout. Also blocks other mutations on the same documents.

**Instead:** Each step dispatch is a separate action. The `advanceWorkflowStep` mutation is called once per step completion, computes the next ready steps, and schedules new dispatch actions.

### Anti-Pattern 4: Circular Step Dependencies at Runtime

**What:** Allowing the engine to attempt execution when the DAG contains cycles.

**Why bad:** Infinite loops, deadlocks, resource exhaustion.

**Instead:** Validate at definition save time using `detectWorkflowCycle()` (already implemented). Reject workflows with cycles before they can be executed. The `topologicalSort()` function returns `null` for cyclic graphs, providing a second safety net.

### Anti-Pattern 5: Tight Coupling Between Workflow Engine and Gateway Protocol

**What:** Hardcoding OpenClaw WebSocket protocol details inside the workflow engine mutations.

**Why bad:** Makes it impossible to support different agent runtimes or mock execution for testing.

**Instead:** The Gateway Bridge is a separate abstraction. The Workflow Engine calls `dispatchStep(stepId, agentId, inputData)` and receives `onStepComplete(stepId, outputData)` or `onStepFailed(stepId, error)`. The bridge handles WebSocket protocol, connection pooling, and RPC serialization.

---

## Suggested Build Order (Dependencies)

### Phase 1: Data Foundation (Schema + Pure Logic)

**Build first because:** Everything depends on the schema. Cannot execute workflows without tables to track executions.

**Deliverables:**
1. Schema expansion: Add `inputData`/`outputData` fields to `workflow_executions.nodeExecutions`
2. New `workflow_events` table (immutable append-only audit log)
3. Optional: `workflow_steps` table if embedded step tracking in `nodeExecutions` proves too coarse
4. Budget fields on `workflow_executions`: `totalBudgetCents`, `spentCents`
5. Model pricing configuration (already partially exists in `settings` table)
6. Convex migrations for all schema changes

**Already complete:**
- `workflowValidation.ts` with 7 pure functions (44 tests passing)
- `workflows` table with definition structure
- `workflow_executions` table with status and nodeExecutions
- `executions` table for per-step tracking
- State machines for workflow and step transitions

### Phase 2: Workflow CRUD + Validation Mutations

**Build second because:** Need validated workflows before the engine can execute them.

**Deliverables:**
1. `createWorkflow` mutation calling `validateWorkflowDefinition()` before insert
2. `updateWorkflow` mutation with re-validation
3. `triggerWorkflow` mutation creating a `workflow_executions` record
4. Budget estimation logic (sum step cost estimates at trigger time)

**Depends on:** Phase 1 (schema)

### Phase 3: Execution Engine Core

**Build third because:** The engine is the heart; it needs schema and valid workflows.

**Deliverables:**
1. `advanceWorkflowStep` mutation (the core loop)
2. `onStepComplete` mutation (records result, triggers advancement)
3. `onStepFailed` mutation (records error, checks retry policy, may abort workflow)
4. `abortWorkflow` mutation (marks remaining pending steps as skipped)
5. Data chaining: `buildStepInput()` function for predecessor output merging
6. Budget enforcement per-step dispatch

**Depends on:** Phase 2 (workflow CRUD)

### Phase 4: Gateway Dispatch Integration

**Build fourth because:** Needs the engine to exist so it can receive dispatch commands.

**Deliverables:**
1. `dispatchStepAction` Convex action (WebSocket RPC to OpenClaw)
2. Connection pool integration for workflow dispatches
3. Timeout handling (step-level timeouts from workflow definition)
4. Retry logic (step-level retry policy from workflow definition)
5. Idempotency guards

**Depends on:** Phase 3 (engine core), existing Gateway Bridge services

### Phase 5: Observability + Audit UI

**Build last because:** Needs data from running workflows to display.

**Deliverables:**
1. Workflow execution dashboard (list of runs, status, cost)
2. Step-level detail view (input/output data, timing, agent assignment)
3. Live execution monitoring (Convex reactive queries)
4. Cost breakdown per workflow, per step, per agent
5. Audit log viewer with search and filter

**Depends on:** Phase 4 (working end-to-end execution)

---

## Integration Points with OpenClaw

### Current Integration Surface

| Integration | Mechanism | Status |
|-------------|-----------|--------|
| Gateway WebSocket | `gatewayRpc.ts` (connect, call, ping) | Implemented |
| Connection Pool | `gatewayConnectionPool.ts` (acquire/release, TTL) | Implemented |
| Agent Provisioning | `agentProvisioning.ts` (template files, session setup) | Implemented |
| Gateway CRUD | `gateways.ts` Convex mutations (create, update, delete, health) | Implemented |
| Agent Registration | `agents.register` mutation with API key | Implemented |
| Health Monitoring | `gateways.updateHealthStatus` + `ping()` | Implemented |

### New Integration Points for Workflow Engine

| Integration | Mechanism | Build Phase |
|-------------|-----------|-------------|
| Step Dispatch | `call(ws, "tasks.execute", { agentKey, input })` | Phase 4 |
| Step Result Callback | Action -> Mutation handoff on completion | Phase 4 |
| Step Timeout | Timer in dispatch action + abort on expiry | Phase 4 |
| Agent Capability Query | Check `agentSkills` for role-based routing | Phase 4 |
| Workflow-Level Provisioning | Provision all workflow agents before execution | Phase 4 |

### OpenClaw RPC Methods Needed

Based on the existing `gatewayRpc.ts` protocol, workflow dispatch will use:

```
Method: "tasks.execute"
Params: {
  agentKey: string,       // From getAgentKey()
  sessionKey: string,     // From getSessionKey()
  taskInput: {            // Merged input data from data chaining
    title: string,
    description: string,
    context: Record<string, unknown>,  // Predecessor outputs
    priority?: string,
    tags?: string[],
  }
}
Response: {
  ok: boolean,
  result: {
    output: Record<string, unknown>,  // Step output data
    tokensUsed: { input: number, output: number },
    model: string,
    durationMs: number,
  }
}
```

---

## Scalability Considerations

| Concern | At 10 workflows/day | At 100 workflows/day | At 1000 workflows/day |
|---------|---------------------|----------------------|-----------------------|
| Database writes per workflow | ~5-20 mutations (manageable) | ~500-2000 mutations (fine for Convex) | ~5000-20000 mutations (monitor Convex limits) |
| Concurrent step executions | 1-5 (trivial) | 10-50 (WebSocket pool handles it) | 100-500 (may need pool scaling, POOL_MAX_PER_KEY > 3) |
| Event log growth | ~100 events/day (24h retention works) | ~1000 events/day (fine) | ~10000 events/day (may need tiered retention) |
| Gateway WebSocket connections | 1-3 per gateway (pool sufficient) | 5-15 per gateway (increase pool) | 50+ per gateway (need horizontal gateway scaling) |
| Audit log storage | Negligible | ~10MB/month | ~100MB/month (Convex handles this) |

**Key bottleneck:** WebSocket connection pool size (`POOL_MAX_PER_KEY=3`). For high-throughput workflows with many concurrent steps, this needs to scale. The existing pool architecture supports this via configuration change.

---

## Sources

- [LangGraph Multi-Agent Orchestration Guide 2025](https://latenode.com/blog/ai-frameworks-technical-infrastructure/langgraph-multi-agent-orchestration/langgraph-multi-agent-orchestration-complete-framework-guide-architecture-analysis-2025) - DAG patterns, state machine approaches
- [State of Workflow Orchestration 2025](https://www.pracdata.io/p/state-of-workflow-orchestration-ecosystem-2025) - Industry trends, queue-based patterns
- [Designing a DAG-Based Workflow Engine](https://bugfree.ai/knowledge-hub/designing-a-dag-based-workflow-engine-from-scratch) - Component architecture
- [Temporal: Error Handling in Distributed Systems](https://temporal.io/blog/error-handling-in-distributed-systems) - Retry patterns, saga pattern
- [Temporal: Retry Policies](https://docs.temporal.io/encyclopedia/retry-policies) - Exponential backoff, non-retryable errors
- [Temporal: Beyond State Machines](https://temporal.io/blog/temporal-replaces-state-machines-for-distributed-applications) - Durable execution patterns
- [Dapr Workflow Patterns](https://docs.dapr.io/developing-applications/building-blocks/workflow/workflow-patterns/) - Task chaining, fan-out/fan-in
- [Microservices: Service Registry Pattern](https://microservices.io/patterns/service-registry.html) - Heartbeat, registration, discovery
- [Microservices: Health Check API](https://microservices.io/patterns/observability/health-check-api.html) - Health endpoint patterns
- [Convex Workflow Component](https://www.convex.dev/components/workflow) - Convex-native durable workflows
- [Convex: Durable Workflows](https://stack.convex.dev/durable-workflows-and-strong-guarantees) - Action/mutation handoff pattern
- [Netflix Maestro Engine](https://netflixtechblog.com/100x-faster-how-we-supercharged-netflix-maestros-workflow-engine-028e9637f041) - Scalable workflow execution
- [Deadlocks in Distributed Systems](https://bool.dev/blog/detail/deadlocks-in-distributed-systems) - Cycle detection, prevention strategies
- [OpenClaw Mission Control](https://github.com/abhi1693/openclaw-mission-control) - OpenClaw governance layer
- Existing codebase: `workflowValidation.ts` (7 pure functions, 44 tests), `gatewayRpc.ts`, `agentProvisioning.ts`, `gatewayConnectionPool.ts`, `schema.ts`
