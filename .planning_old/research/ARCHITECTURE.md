# Architecture Patterns for Multi-Agent Orchestration

**Research Date:** 2026-02-25
**Context:** Mission Control — control plane for orchestrating autonomous specialist agents
**Stack:** Next.js 15 + Convex 1.32 + WebSocket gateways (TypeScript throughout)

---

## 1. Orchestration System Layers

A production orchestration control plane requires six clearly separated layers. Each has distinct responsibilities and should not bleed into the next.

### Layer 1: Workflow Definition Layer

**Responsibility:** Represents what should happen — the declarative description of a workflow.

**Components:**
- Workflow schema (DAG of steps, dependencies, conditions)
- Step definitions (agent, input schema, output schema, timeout, retry policy)
- Workflow registry (versioned catalog of named workflows)
- Trigger configuration (manual, webhook, cron, event-driven)

**Boundaries:** This layer produces a static artifact (the workflow definition). It never executes anything. It is read by the Execution Engine. Changes here produce new workflow versions, not mutations to running executions.

**In Mission Control's context:** Convex `workflows` table stores workflow definitions. A workflow is a JSON/object DAG with nodes (steps) and edges (dependencies). Version field enables branching without breaking running instances.

---

### Layer 2: Execution Engine

**Responsibility:** Interprets workflow definitions and drives execution forward — the runtime scheduler.

**Components:**
- Workflow instantiator (creates an execution record from a workflow definition)
- Step scheduler (decides which steps are ready to run, based on dependency resolution)
- Parallel dispatch (fans out ready steps to available agents concurrently)
- Completion handler (advances state when a step completes; triggers downstream steps)
- Error handler (retries, aborts, or escalates based on step policy)

**Boundaries:** The engine reads workflow definitions and writes to the State Management layer. It does not talk to agents directly — it emits work items that agents consume. The engine is the single authority on execution sequencing.

**Key invariant:** The engine must be idempotent. If the same step gets dispatched twice (due to crash recovery), the agent or execution record must prevent double-execution. Convex mutations with optimistic locking achieve this.

**In Mission Control's context:** `convex/executions.ts` already implements the lifecycle (`createExecution`, `updateExecutionStatus`, `abortExecution`, `retryExecution`). What is missing is the step scheduler that reads dependency edges and fans out to ready steps.

---

### Layer 3: State Management Layer

**Responsibility:** Tracks the runtime state of every execution in flight — the operational ledger.

**Components:**
- Execution records (per-workflow-instance: status, current step, elapsed time)
- Step records (per-step: status, assigned agent, input, output, tokens, cost)
- Dependency resolution cache (which steps are unblocked, ready to run)
- Lock / in-flight registry (prevent double-dispatch of the same step)

**Boundaries:** This layer is a pure data store. It accepts writes from the Execution Engine and exposes reads for Observability. It must support atomic compare-and-swap (CAS) operations to prevent race conditions in parallel step scheduling.

**Convex advantage:** Convex mutations are serialized per-document by default (MVCC under the hood). This means concurrent mutations on the same execution record are safe without explicit locks.

---

### Layer 4: Observability Layer

**Responsibility:** Makes the system legible to operators in real time — the dashboard data source.

**Components:**
- Event stream (append-only log of all significant events: step started, step completed, budget exceeded)
- Metrics aggregator (hourly rollups of token usage, cost, duration, failure rate)
- Health monitor (agent heartbeat tracking, timeout detection)
- Cost ledger (cumulative cost per agent, per workflow, per workspace)

**Boundaries:** Observability is read-only from the Execution Engine's perspective. The engine emits events; observability consumes them. No Observability component should mutate execution state.

**In Mission Control's context:** `convex/executions.ts` `getEventStream()` and `aggregateMetrics()` exist. `convex/agentLifecycle.ts` provides `getSystemHealth()`. These are the right primitives — the gap is wiring them together in the dashboard.

---

### Layer 5: Economic Tracking Layer

**Responsibility:** Tracks and enforces the cost dimension of execution — the budget governor.

**Components:**
- Token counter (input/output tokens per step, per agent, per workflow)
- Cost calculator (token counts → dollars using model pricing table)
- Budget enforcer (halt execution if cumulative cost exceeds workflow budget)
- Cost roll-up queries (today's spend, per-agent breakdown, per-workflow breakdown)

**Boundaries:** Budget enforcement must run before a step is dispatched. The Execution Engine must check budget before calling the step scheduler. The Economic layer is read by the Execution Engine (enforcement check) and written by step completion (token counts come back from agents).

---

### Layer 6: Audit/Replay Layer

**Responsibility:** Maintains an immutable, queryable record of all decisions and state transitions — the compliance layer.

**Components:**
- Immutable event log (append-only; no updates or deletes)
- Execution snapshot store (periodic snapshots of execution state for fast replay from a checkpoint)
- Replay engine (reconstruct execution state at any point in time from the event log)
- Audit query API (filter by agent, workflow, time range, severity)

**Boundaries:** The audit layer receives writes from all other layers (every state transition emits an event). It never initiates state changes. Replay is a read-only operation that produces a derived view.

---

## 2. Workflow Representation

### The Core Tradeoff: DAG vs. Linear vs. Hybrid

| Model | Description | Use Case |
|-------|-------------|----------|
| **Linear (pipeline)** | Steps execute sequentially, one at a time | Simple scripting, ETL, low parallelism |
| **DAG** | Steps have explicit dependency edges; parallel when ready | Complex multi-agent, parallel research + synthesis |
| **Hybrid** | Sequential by default, branches/parallel groups opt-in | Most real workflows — moderate complexity with selective parallelism |

**Recommendation for Mission Control: Hybrid DAG**

Reason: The canonical workflow (`Research → Strategy → Dev → QA`) is linear at the top level but each phase may spawn parallel sub-steps (e.g., multiple research agents running in parallel). A pure DAG is expressive but complex to author and validate. A hybrid model (sequential spine with explicit parallel blocks) is more ergonomic.

### Concrete Representation

```typescript
// Workflow definition (stored in Convex `workflows` table)
interface WorkflowStep {
  id: string;                          // Unique within workflow
  agentRole: string;                   // Which agent type handles this step
  inputSchema: Record<string, any>;    // Expected inputs (from prior steps or trigger)
  outputSchema: Record<string, any>;   // Expected outputs (passed to next steps)
  dependsOn: string[];                 // Step IDs that must complete before this runs
  timeout: number;                     // Max execution time in ms
  retryPolicy: {
    maxAttempts: number;
    backoffMs: number;
    backoffMultiplier: number;
  };
  budgetCents?: number;                // Per-step cost cap
}

interface WorkflowDefinition {
  id: string;
  version: number;
  name: string;
  description: string;
  steps: WorkflowStep[];
  triggerType: "manual" | "webhook" | "cron";
  totalBudgetCents?: number;           // Workflow-level cost cap
  createdAt: number;
  createdBy: string;
}
```

### Dependency Resolution Algorithm

At any point in time, "ready steps" are those whose `dependsOn` list is entirely in the set of completed step IDs. This is computed as a simple set difference:

```typescript
function getReadySteps(
  steps: WorkflowStep[],
  completedStepIds: Set<string>
): WorkflowStep[] {
  return steps.filter(
    (step) =>
      !completedStepIds.has(step.id) &&
      step.dependsOn.every((dep) => completedStepIds.has(dep))
  );
}
```

This runs in O(steps * max_dependencies) which is fast enough for workflows up to hundreds of steps.

### Cycle Prevention

DAGs must be acyclic. Validate at definition time (not at execution time) using DFS topological sort. Mission Control already has `convex/utils/graphValidation.ts` with `detectCycle()` — reuse this for workflow validation. Add a `validateWorkflow()` function that calls `detectCycle()` on the step dependency graph before saving a workflow definition.

---

## 3. Execution Model

### Sync vs. Async

**Decision: Fully async, event-driven execution**

Rationale: Agent tasks take seconds to minutes. Synchronous HTTP request-response for agent execution would require extremely long timeouts and block server threads. The correct model is:

1. Control plane dispatches work item to agent (async message or queue)
2. Agent executes independently
3. Agent reports completion back to control plane (callback/webhook)
4. Control plane advances workflow state and dispatches next ready steps

This is the pattern already implicit in Mission Control's gateway WebSocket protocol. The gateway handles long-running agent sessions; Mission Control dispatches and tracks.

### Parallel Execution Strategy

**Fan-out, fan-in pattern:**

```
Trigger → Step A → [Step B, Step C, Step D] → Step E (waits for B+C+D)
                     (parallel)                (fan-in)
```

**Implementation steps:**

1. Execution Engine identifies all ready steps after each completion event
2. Engine dispatches all ready steps simultaneously (parallel fan-out)
3. Each step is assigned to an available agent (or queued if none available)
4. As each step completes, Engine re-evaluates ready steps
5. Steps that depend on all siblings wait until all siblings complete (fan-in)

**Concurrency safety:** Using Convex mutations for state updates guarantees that concurrent step completions don't race each other. Each step completion is a separate mutation that atomically marks the step done and checks for newly unblocked downstream steps.

**Backpressure:** Limit concurrent dispatches per workflow instance to prevent runaway parallelism. A `maxConcurrentSteps` field on `WorkflowDefinition` enforces this. The Execution Engine checks in-flight step count before dispatching.

### Retry Policy

Each step has an independent retry policy. On step failure:

1. Check `retryPolicy.maxAttempts` — if remaining attempts > 0, schedule retry with backoff
2. On final failure, mark step as `failed`
3. Propagate failure to downstream steps (mark them `skipped` or `failed` depending on `failureMode`)
4. If workflow has `haltOnAnyFailure: true`, abort all in-flight steps

Exponential backoff formula: `backoffMs * backoffMultiplier^(attempt - 1)` with jitter (`± 20%`) to prevent thundering herd.

---

## 4. State Management

### Execution State Machine

Each workflow execution follows this state machine:

```
pending → running → completed
                  → failed
                  → aborted
```

Each step within an execution follows:

```
pending → dispatched → running → completed
                               → failed
                               → retrying → running
                               → skipped (if upstream failed)
```

### State Storage in Convex

**Three tables are needed:**

**`workflow_executions` table:**
```typescript
{
  workflowId: Id<"workflows">,
  workflowVersion: number,
  status: "pending" | "running" | "completed" | "failed" | "aborted",
  triggerType: "manual" | "webhook" | "cron",
  triggeredBy: string,
  startTime: number,
  endTime?: number,
  totalCostCents: number,
  totalTokens: number,
  budgetCents?: number,                // Cap from workflow definition
  currentStep?: string,               // Denormalized for fast dashboard queries
  workspaceId: Id<"workspaces">,
}
```

**`workflow_steps` table:**
```typescript
{
  executionId: Id<"workflow_executions">,
  stepId: string,                     // Matches WorkflowStep.id
  agentId?: Id<"agents">,            // Assigned when dispatched
  status: "pending" | "dispatched" | "running" | "completed" | "failed" | "retrying" | "skipped",
  attempt: number,                    // Retry count
  dispatchedAt?: number,
  startedAt?: number,
  completedAt?: number,
  inputPayload?: any,                 // What was sent to agent
  outputPayload?: any,                // What agent returned
  inputTokens: number,
  outputTokens: number,
  costCents: number,
  error?: string,
}
```

**`workflow_events` table (append-only):**
```typescript
{
  executionId: Id<"workflow_executions">,
  stepId?: string,
  eventType: string,                  // "step_dispatched" | "step_completed" | etc.
  timestamp: number,
  agentId?: Id<"agents">,
  payload?: any,                      // Event-specific data
  sequenceNumber: number,             // Monotonically increasing per execution
}
```

### Index Strategy

Critical indexes for query performance:
- `workflow_executions` by `workspaceId + status` (active workflows dashboard)
- `workflow_executions` by `workflowId + startTime` (workflow history)
- `workflow_steps` by `executionId` (step list for a given execution)
- `workflow_steps` by `executionId + status` (find pending/dispatched steps)
- `workflow_events` by `executionId + sequenceNumber` (replay in order)

---

## 5. Economic Tracking Layer

### Where to Instrument

Cost instrumentation should happen at the **step completion boundary** — when the agent reports back with token usage. This is the most accurate point: the actual cost is known only after execution completes.

**Flow:**
```
Agent completes step
  → Reports: { inputTokens, outputTokens, model }
  → Step completion handler:
      1. Calculates costCents = calculateCost(inputTokens, outputTokens, model)
      2. Updates workflow_step.costCents
      3. Atomically increments workflow_execution.totalCostCents
      4. Checks if totalCostCents >= budgetCents → halt if exceeded
      5. Emits "cost_update" event to event stream
```

### Budget Enforcement Without Latency

The challenge: enforce budgets before dispatching the next step without adding a serial database roundtrip per dispatch.

**Solution: Optimistic budget check**

Before dispatching a step, read the current `totalCostCents` from the execution record (this is already in-memory from the state update that just ran). Compare against `budgetCents`. If remaining budget < estimated step cost (from workflow definition), hold the step.

Estimated step cost is optional but recommended: workflow authors specify a `estimatedCostCents` per step. This enables pre-dispatch budget projection without knowing the actual cost.

**Implementation pattern:**

```typescript
function canDispatchStep(
  execution: WorkflowExecution,
  step: WorkflowStep
): { allowed: boolean; reason?: string } {
  if (!execution.budgetCents) return { allowed: true };

  const remaining = execution.budgetCents - execution.totalCostCents;
  const estimated = step.estimatedCostCents ?? 0;

  if (remaining <= 0) {
    return { allowed: false, reason: "Budget exhausted" };
  }

  if (estimated > 0 && estimated > remaining) {
    return { allowed: false, reason: "Insufficient budget for step" };
  }

  return { allowed: true };
}
```

This runs in-process with no additional database call. The execution record is already loaded when making dispatch decisions.

### Cost Roll-up Queries

Avoid expensive aggregation queries at query time. Use pre-aggregated hourly metrics (pattern already in `convex/executions.ts` `aggregateMetrics()`). For dashboards:

- **Today's spend:** Sum `workflow_executions.totalCostCents` for executions with `startTime >= today_start`
- **Per-agent breakdown:** Sum `workflow_steps.costCents` grouped by `agentId`
- **Per-workflow breakdown:** Sum `workflow_executions.totalCostCents` grouped by `workflowId`

Run `aggregateMetrics()` via Convex cron every hour. Dashboard queries read pre-aggregated `metrics` table (fast) rather than scanning raw executions (slow at scale).

---

## 6. Audit/Replay Architecture

### Immutable Event Log Design

The audit log must be:
- **Append-only:** No updates or deletes ever (enforced at mutation layer)
- **Ordered:** Monotonically increasing sequence number per execution
- **Complete:** Every state transition emits at least one event
- **Self-describing:** Each event contains enough context to reconstruct state without joins

**Event schema (what each event must capture):**

```typescript
interface AuditEvent {
  // Identity
  id: string;                         // UUID
  sequenceNumber: number;             // Monotonic per execution
  timestamp: number;                  // Unix ms

  // What happened
  eventType: string;                  // "workflow_started" | "step_dispatched" | etc.

  // Context (denormalized for replay without joins)
  executionId: string;
  workflowId: string;
  workflowVersion: number;
  workspaceId: string;

  // Who/what
  agentId?: string;
  agentName?: string;                 // Denormalized
  stepId?: string;

  // Data
  payload: {
    previousState?: string;
    newState?: string;
    inputTokens?: number;
    outputTokens?: number;
    costCents?: number;
    error?: string;
    input?: any;
    output?: any;
  };
}
```

**Key design decision:** Denormalize agent names and workflow names into the event. When replaying events from 6 months ago, the agent or workflow may have been renamed. Denormalization ensures the audit log is self-contained and accurate.

### Replay Architecture

Replay reconstructs execution state from the event log. Two strategies:

**1. Full replay (from event 0 to event N):**
- Apply each event in sequence number order to a state machine
- Final state = state at time of event N
- Fast for recent executions; slow for long histories

**2. Snapshot + incremental replay:**
- Store periodic snapshots of execution state (every 50 events, or on completion)
- To replay to time T: load nearest snapshot before T, then apply events from snapshot to T
- Dramatically faster for long-running workflows

**Recommended approach:** Snapshots are cheap (just serialize the execution + step states) and enable fast replay. Store snapshots in a `workflow_snapshots` table:

```typescript
{
  executionId: Id<"workflow_executions">,
  snapshotAtSequence: number,         // Event sequence number at time of snapshot
  snapshotAt: number,                 // Timestamp
  executionState: any,                // Serialized execution record
  stepStates: any[],                  // Serialized step records
}
```

Take a snapshot: on workflow completion, on every 50th event, and on workflow abort.

### Query Design for Audit Log

Operators need to search audit logs by:
- Time range (last 24h, last 7 days, custom range)
- Workflow ID (all executions of a given workflow)
- Agent ID (all steps handled by a given agent)
- Status (only failures)
- Cost threshold (executions that exceeded $X)

Convex index strategy:
- `workflow_events` by `workspaceId + timestamp` (time range query)
- `workflow_events` by `executionId + sequenceNumber` (replay)
- `workflow_executions` by `workspaceId + startTime` (recent executions)
- `workflow_executions` by `workflowId + startTime` (per-workflow history)

For cross-field filters (e.g., "failures in last 7 days for agent X"), use Convex filter chaining after index-scoped collection. Keep result sets bounded (max 500 rows per query) to prevent OOM.

---

## 7. Recommended Architecture for Mission Control

### Target Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        MISSION CONTROL                          │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Workflow    │  │  Execution   │  │    Observability      │  │
│  │  Definition  │  │   Engine     │  │    Dashboard          │  │
│  │  (Convex DB) │  │  (Convex     │  │    (Next.js UI)       │  │
│  │              │  │  mutations)  │  │                       │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────────┘  │
│         │                 │                     ↑               │
│         │ reads           │ writes              │ reads          │
│         ↓                 ↓                     │               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  STATE LAYER (Convex)                    │    │
│  │  workflow_executions | workflow_steps | workflow_events  │    │
│  └─────────────────────────────────────────────────────────┘    │
│         │                 │                                      │
│         │ budget check    │ dispatch                            │
│         ↓                 ↓                                      │
│  ┌────────────┐   ┌───────────────────────────────────────┐     │
│  │  Economic  │   │          GATEWAY LAYER                │     │
│  │  Tracker   │   │  WebSocket Pool → Agent Sessions      │     │
│  │  (Convex)  │   │  (Next.js API Routes + gatewayRpc)    │     │
│  └────────────┘   └───────────────────────────────────────┘     │
│                                     │                            │
│                                     │ RPC                        │
│                                     ↓                            │
│                   ┌──────────────────────────────────┐          │
│                   │         AGENT EXECUTORS           │          │
│                   │  (OpenClaw / External Processes)  │          │
│                   └──────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities in Mission Control Terms

**Workflow Definition (Convex `workflows` table):**
- Store DAG definitions with steps, dependencies, budget caps
- Version every change; never mutate a definition in place
- Validate DAG acyclicity on save using `detectCycle()`

**Execution Engine (Convex mutations):**
- `startWorkflow(workflowId, input)` — instantiate execution, create step records, dispatch first wave of ready steps
- `onStepComplete(stepId, result)` — update step record, update costs, check budget, dispatch next ready steps
- `onStepFailed(stepId, error)` — apply retry policy or mark failed, propagate to downstream
- `abortWorkflow(executionId, reason)` — mark all in-flight steps as aborted, halt dispatch

**State Layer (Convex tables):**
- `workflow_executions` — one row per running/completed workflow instance
- `workflow_steps` — one row per step per instance
- `workflow_events` — append-only event stream (the audit log)

**Gateway Layer (existing):**
- Reuse existing `gatewayConnectionPool` and `gatewayRpc.call()`
- Add `dispatchStep(ws, stepDefinition, inputPayload)` RPC method
- Add `onStepResult` WebSocket event listener that calls `onStepComplete` mutation

**Economic Tracker (Convex):**
- Extend existing `calculateCost()` to accept step-level calls
- Add `checkBudget(executionId)` query to return remaining budget
- Cron: `aggregateMetrics()` runs hourly to pre-aggregate cost data

**Observability Dashboard (Next.js + Convex hooks):**
- `useQuery(api.executions.getRecentExecutions)` — live execution list
- `useQuery(api.executions.getEventStream)` — live event feed
- `useQuery(api.executions.getCostBreakdown)` — today's cost summary

### Build Order / Dependency Implications

Build in this order to avoid circular dependencies and enable incremental testing:

```
Phase A: Schema (foundation — all other layers depend on it)
  - Add workflow_executions, workflow_steps, workflow_events tables to schema.ts
  - Write migration to add tables safely
  - Write schema tests

Phase B: Economic Layer (no runtime dependencies)
  - Extend calculateCost() with model pricing
  - Add budget enforcement logic (pure functions, easy to unit test)

Phase C: Workflow Definition Layer (depends on schema)
  - createWorkflow, updateWorkflow, getWorkflow mutations
  - Validate DAG on save (reuse detectCycle())
  - Workflow versioning logic

Phase D: State Management (depends on schema + workflow definitions)
  - createExecution, updateStepStatus mutations
  - Dependency resolution (getReadySteps) — pure function, easy to test
  - Snapshot creation on completion

Phase E: Execution Engine (depends on all of A-D)
  - startWorkflow (instantiate + dispatch first wave)
  - onStepComplete (advance state, check budget, dispatch next wave)
  - onStepFailed (retry or propagate failure)
  - abortWorkflow

Phase F: Gateway Integration (depends on E)
  - Wire onStepComplete to existing gateway WebSocket callbacks
  - Add dispatchStep RPC call

Phase G: Audit/Replay Layer (depends on schema + events)
  - Replay engine (event log → execution state)
  - Snapshot + incremental replay
  - Audit query API

Phase H: Observability Dashboard (depends on all backend)
  - Real-time execution list
  - Step-level drill-down
  - Cost breakdown views
  - Audit log viewer with search/filter
```

---

## 8. Key Design Decisions and Tradeoffs

### Decision 1: Convex Mutations as the Execution Engine

**Choice:** Use Convex mutations (not a separate orchestration service) as the execution engine.

**Rationale:**
- Convex mutations are serialized per-document, eliminating race conditions in state updates
- Real-time reactivity (useQuery) means dashboard updates automatically without polling
- No separate service to deploy, monitor, or scale
- Keeps the stack constrained to existing technology (per project constraints)

**Tradeoff:** Convex mutations have a maximum execution time limit (currently 10 seconds). Long-running orchestration logic must be broken into small mutations chained by events, not single long transactions. Use Convex `actions` for longer-running orchestration that needs to call external services.

**Impact on build:** Execution engine logic must be decomposed into small atomic mutations. Each step completion triggers one mutation (not a long loop).

---

### Decision 2: Append-Only Event Log (not mutable state updates)

**Choice:** Treat `workflow_events` as an append-only audit ledger. Never update or delete rows.

**Rationale:**
- Immutability is the foundation of auditability — you need the complete history, not just current state
- Event sourcing enables replay: reconstruct any past state from the log
- Avoids complex update conflicts; writes are always inserts
- Compliance requirement (90-day retention per PROJECT.md)

**Tradeoff:** Storage grows over time. Mitigate with:
1. TTL cleanup for events older than 90 days (cron job, separate from the audit log retention)
2. Snapshot-based replay so you don't need to replay from event 0 every time
3. Compress or archive events older than 30 days to cold storage (future)

**Impact on build:** Every state transition in the execution engine must call `ctx.db.insert("workflow_events", ...)` — never `ctx.db.patch()` on existing event rows. Enforce this convention in code review.

---

### Decision 3: Denormalized Step Records (not joins on query)

**Choice:** Store agent name, workflow name, and step name directly in event records. Do not join at query time.

**Rationale:**
- Historical records must remain accurate even if agents are renamed or workflows are deleted
- Join performance degrades at scale; denormalization is O(1) per row
- Replay logic is simpler — no need to join with current state

**Tradeoff:** More storage per event row. At ~200 bytes per event and 1M events/month, this is ~200MB/month — acceptable.

**Impact on build:** All mutations that insert events must denormalize names at write time. Add a `resolveEventContext(ctx, { agentId, workflowId })` helper that does the lookups once and returns a context object to spread into the event.

---

### Decision 4: Budget Enforcement Before Dispatch (not After)

**Choice:** Check budget before dispatching a step, not after it completes.

**Rationale:**
- Preventing overspend is more valuable than detecting it after the fact
- Agents may not be stoppable mid-execution (external processes), so prevention is the only reliable control
- Pre-dispatch check is cheap (in-memory comparison, no DB call)

**Tradeoff:** Estimated step cost (set by workflow author) may be inaccurate. An overly conservative estimate blocks steps unnecessarily. An overly optimistic estimate allows overspend.

**Mitigation:** Allow a `budgetOverrunPercent` tolerance field (e.g., 10% overage allowed before hard halt). After execution, report actual vs. estimated for continuous calibration.

---

### Decision 5: Gateway as Pass-Through (not State Authority)

**Choice:** The gateway holds no execution state. It is a transparent transport layer between Mission Control and agents.

**Rationale:**
- Single source of truth for execution state must be Convex (queryable, real-time, persistent)
- Gateway processes may restart; if they hold state, recovery is hard
- Separating transport from state makes both layers independently scalable and testable

**Tradeoff:** Every step result must make a round-trip: agent → gateway → Mission Control API → Convex. This adds ~50-100ms latency per step completion. Acceptable for the timescales of agent tasks (seconds to minutes).

**Impact on build:** The gateway's `onStepResult` event handler in Next.js API routes must call a Convex mutation synchronously before acknowledging the agent. If the Convex write fails, the API route must return an error so the gateway can retry.

---

### Decision 6: Supervisor Controls Flow, Agents Report Back

**Control flow pattern:**
```
Mission Control (Supervisor)                   Agent (Executor)
        |                                             |
        |--- dispatchStep(stepDef, input) ---------->|
        |                                             |
        |                                    (executes step)
        |                                             |
        |<-- stepComplete(output, tokens) ------------|
        |                                             |
        | (advances workflow, dispatches next)        |
```

Mission Control is the single point of dispatch and advancement. Agents are stateless executors that accept work, do it, and report back. Agents do not call each other directly. All inter-agent coordination goes through Mission Control's state machine.

**Why this matters:**
- Auditability: every handoff is recorded by Mission Control
- Budget enforcement: every dispatch goes through the budget check
- Correctness: no partial state — the workflow either advances atomically or not at all

**Deviation from this pattern requires explicit justification.** If agents need to call each other (e.g., a Research agent asking a Knowledge Base agent a question mid-step), this is handled via sub-step dispatch: the Research agent reports back to Mission Control, which dispatches the KB lookup as a child step, then re-dispatches the Research agent with the KB result.

---

## Reference Patterns

### From Industry Systems

**Apache Airflow (DAG orchestration):** Popularized DAG-based workflow representation. Key lesson: separate workflow definition (DAG) from execution records (DagRun, TaskInstance). Mission Control follows this: `workflows` table (definition) vs. `workflow_executions` + `workflow_steps` (runtime state).

**Temporal.io (durable execution):** Key lesson: treat workflow code as durable — if the host crashes, replay from history to resume exactly where execution left off. This is why the event log and snapshot pattern matters for Mission Control. Temporal uses event sourcing internally; Mission Control's `workflow_events` table achieves the same goal.

**AWS Step Functions (serverless orchestration):** Key lesson: state machines are a robust model for complex multi-step processes. Each step transition is atomic and audited. Mission Control's execution state machine (pending → dispatched → running → completed/failed) mirrors this.

**OpenTelemetry (observability):** Key lesson: instrument at the boundary, not in the middle. Emit spans/events at the start and end of each operation. Mission Control follows this: events are emitted at step dispatch and step completion, not during the agent's internal processing.

---

*Research complete. Architecture is grounded in Mission Control's existing patterns (Convex mutations, WebSocket gateway, event logging) and extends them toward a production-grade orchestration control plane.*
