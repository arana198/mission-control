# Domain Pitfalls

**Domain:** Multi-agent orchestration platform with multi-workspace isolation, cost governance, and audit trail
**Researched:** 2026-02-26
**Overall Confidence:** HIGH (verified against codebase + multiple industry sources)

---

## Critical Pitfalls

Mistakes that cause rewrites, data breaches, or systemic failures. Address these first or accept rewrite risk later.

---

### CRIT-1: Workspace Isolation Bypass via Missing workspaceId Enforcement

**What goes wrong:** Queries and mutations that omit workspace scoping return or mutate data across all workspaces. In Mission Control, this is not theoretical -- it is already happening.

**Why it happens:** Convex has no row-level security (RLS) at the database level. Every query must manually include `workspaceId` filtering. One missed filter, one new table without the pattern, one developer shortcut -- and data leaks across workspaces silently.

**Evidence from codebase (VERIFIED -- HIGH confidence):**
- `notifications.ts`: The `getAll()` query returns ALL notifications across all workspaces with no `workspaceId` filter. The `getUndelivered()` query similarly returns global unread notifications. The `create()` mutation does not accept or store `workspaceId` at all, despite the schema having the field.
- `executions.ts`: The `createExecution()` mutation creates execution records without `workspaceId`. The `getAgentExecutions()` query filters only by `agentId` with no workspace scoping. Since agents are global entities (shared across workspaces), querying by agent returns cross-workspace execution data.
- `agents.ts`: The `getAllAgents()` query returns all agents globally (by design -- agents are shared), but `deleteAgent()` iterates ALL workspaces to unassign, meaning a single delete operation touches all workspace data.
- `notifications` schema: `workspaceId` is `optional` and has no index for workspace-scoped queries.
- `executions` schema: `workspaceId` is `optional`, meaning executions can be created without workspace association.

**Consequences:**
- Workspace A operator sees Workspace B notifications, execution history, and cost data
- Cost attribution becomes impossible when executions lack workspace association
- Audit trail is incomplete (which workspace triggered what?)
- Regulatory exposure if workspaces represent different clients or business units

**Warning signs:**
- Any query using `.collect()` or `.take(N)` without a `.withIndex("by_workspace", ...)` filter
- Schema fields marked `optional` for `workspaceId` when they should be required
- Missing `by_workspace` index on any workspace-scoped table
- API endpoints that do not extract and validate `workspaceId` from the request context

**Prevention:**
1. **Mandatory workspace context middleware:** Every API route and Convex mutation that touches workspace-scoped data must receive and validate `workspaceId` before any database operation
2. **Schema enforcement:** Change `workspaceId` from `optional` to required on all workspace-scoped tables (notifications, executions, activities, etc.) via migration
3. **Query lint rule:** Automated check that every query on a workspace-scoped table uses a `by_workspace*` index
4. **Test coverage:** For every mutation and query, add a test that creates data in Workspace A and verifies Workspace B cannot see it

**Which phase should address it:** Phase 1 (Data Foundation) -- this is the schema layer. If workspace isolation is not fixed at the schema level, every subsequent phase (workflows, execution engine, observability) inherits the leak.

**Severity: CRITICAL -- data breach risk already exists in production code**

---

### CRIT-2: Agent Orchestration Deadlocks and Infinite Loops

**What goes wrong:** Multi-agent workflow execution enters a state where agents wait on each other indefinitely (deadlock), or a failed step triggers unbounded retries that exhaust tokens and budget.

**Why it happens:** The workflow engine uses DAG-based step orchestration where steps can depend on each other. When the execution engine computes "ready steps" via `getReadySteps()`, it only checks if predecessors are completed. It does not detect:
- Circular waits between running agents (Agent A waits for Agent B's output, Agent B waits for Agent A's approval)
- Retry storms where a failed step retries indefinitely without budget or count caps
- Zombie workflows where a step is "running" but the agent has crashed -- no timeout detection

**Evidence from codebase (VERIFIED -- HIGH confidence):**
- `workflowValidation.ts`: `detectWorkflowCycle()` validates the static DAG at definition time, but there is no runtime cycle detection. Two workflows could create a dynamic cycle (Workflow 1 dispatches to Agent A which triggers Workflow 2 which dispatches to Agent B which triggers Workflow 1).
- `executions.ts`: `retryExecution()` increments `retryCount` in metadata but has no maximum retry limit. A retry loop between `retryExecution()` and a consistently failing agent would burn tokens indefinitely.
- No heartbeat timeout: The agent `heartbeat` mutation records `lastHeartbeat`, but there is no scheduled function that detects stale heartbeats and marks stuck executions as failed.
- `computeWorkflowStatus()` returns "running" if any step is "running" -- but there is no timeout or circuit breaker for how long "running" can persist.

**Industry context (MEDIUM confidence):**
- Multi-agent coordination failures account for ~37% of system failures (Galileo research)
- The "17x error trap": each agent in a chain has ~95% accuracy, but a 5-agent pipeline has 0.95^5 = 77% accuracy -- errors compound exponentially (Towards Data Science, 2025)
- Recursive deadlocks in LLM orchestration consume tokens at every loop iteration while producing no useful output

**Consequences:**
- Budget exhaustion from retry storms (real money burned with no value)
- Workflow stuck in "running" state indefinitely, blocking dependent workflows
- Agent resource exhaustion (connection pool depleted, rate limits hit)
- Operator loses trust in automation, reverts to manual control

**Warning signs:**
- Execution duration exceeds 10x the expected step timeout
- Same agent retrying the same step more than 3 times in a row
- `getReadySteps()` returns empty array but workflow is not complete (all steps either running or completed but some stuck)
- Agent heartbeat last seen more than 2x the heartbeat interval ago

**Prevention:**
1. **Maximum retry cap:** Add `maxRetries` field to workflow step definition (default: 3). `retryExecution()` must check this before creating a new execution.
2. **Step-level timeouts:** Every workflow step needs a `timeoutMs` field (already in `WorkflowNode` interface). The execution engine must schedule a timeout check that marks the step as failed if it exceeds this duration.
3. **Heartbeat-based liveness detection:** Scheduled function (cron) that queries agents with `lastHeartbeat < Date.now() - STALE_THRESHOLD` and marks their active executions as failed.
4. **Circuit breaker pattern:** After N consecutive failures for a step, mark the step as permanently failed rather than retrying.
5. **Cross-workflow cycle detection:** Maintain a "workflow call stack" in execution metadata to detect when Workflow A triggers Workflow B triggers Workflow A.
6. **Global execution budget cap:** Even if individual step budgets pass, cap total tokens/cost at the workflow level.

**Which phase should address it:** Phase 2 (Workflow Definition -- add retry limits and timeouts to schema) and Phase 3 (Execution Engine -- implement runtime deadlock detection and circuit breakers).

**Severity: CRITICAL -- can cause unbounded financial damage via token exhaustion**

---

### CRIT-3: Cost Governance Silent Failures and Misattribution

**What goes wrong:** The cost tracking system reports inaccurate costs, fails to enforce budget caps, or attributes costs to the wrong workspace/agent/workflow.

**Why it happens:** Three root causes converge:

1. **Silent zero-cost fallback:** The `calculateCost()` function in `executions.ts` returns `0` when pricing configuration is missing or the model is not found. It logs a `console.warn` but does not throw. This means executions can complete with `costCents: 0` even when they consumed thousands of tokens.

2. **Missing workspace attribution:** Executions created without `workspaceId` (see CRIT-1) cannot have their costs attributed to any workspace. Cost breakdown queries like `getCostBreakdown()` will undercount workspace costs.

3. **Pre-dispatch budget check is not implemented yet:** The roadmap Phase 2 specifies "When a workflow's estimated cost exceeds its configured budget cap, the system halts dispatch before the first step is sent to any agent." This enforcement does not exist yet -- when it is built, the budget check must be atomic with the dispatch, or a race condition allows over-budget execution.

**Evidence from codebase (VERIFIED -- HIGH confidence):**
- `executions.ts` lines 52-76: `calculateCost()` returns 0 with only a console.warn when pricing is misconfigured
- `executions.ts` line 199-222: `createExecution()` initializes all cost fields to 0 and does not validate that pricing exists
- Schema: `costCents` is `optional` on executions -- completed executions can have no cost recorded
- No pre-dispatch budget check exists anywhere in the codebase
- `aggregateMetrics()` sums `costCents` from executions, inheriting all zero-cost inaccuracies

**Industry context (MEDIUM confidence):**
- A mid-sized e-commerce company saw 300% cost spike ($1,200 to $4,800/month) from a single workflow change (token expansion in order-tracking)
- Teams without per-request cost attribution cannot determine which features, users, or workflows drive spend
- Hierarchical budget management (workspace > workflow > step) is necessary to prevent any single workflow from consuming disproportionate resources
- 50%/80%/100% budget alerts combined with 3x rate-of-change detectors catch misconfigured loops within hours

**Consequences:**
- Real costs invisible until the cloud provider invoice arrives
- Budget caps bypassed because enforcement never fires (silent 0-cost)
- Cost dashboards show misleading data -- operators think costs are low when they are actually untracked
- No way to charge back costs to the workspace that incurred them

**Warning signs:**
- Executions completing with `costCents: 0` and `inputTokens > 0` -- impossible in reality
- Pricing settings table missing or empty
- Model name mismatch between what agents report and what pricing config contains
- Workflow execution proceeds without any budget check logged in events

**Prevention:**
1. **Fail-loud on missing pricing:** `calculateCost()` should throw an error (not return 0) when model pricing is not configured. Create a separate `calculateCostSafe()` that returns an explicit `{ cost: 0, reason: "pricing_not_configured" }` for cases where fallback is intentional.
2. **Required pricing validation at startup:** A health check that verifies all active models have pricing configured. Block workflow execution if pricing is missing for any model in the workflow definition.
3. **Atomic budget enforcement:** The pre-dispatch budget check must read current `spentCents` and estimated step cost in a single Convex mutation (transactional). Check-then-dispatch as two separate operations creates a TOCTOU race condition.
4. **Budget alerts with anomaly detection:** Implement 50%/80%/100% budget threshold alerts plus rate-of-change detection (if spend doubles in an hour, alert immediately).
5. **Workspace-level cost rollup:** Every execution must have `workspaceId`. Cost queries must aggregate by workspace, not just by agent or date.
6. **Cost reconciliation job:** Periodic scheduled function that compares sum of execution costs against actual token usage from the LLM provider (if API supports it).

**Which phase should address it:** Phase 1 (Data Foundation -- fix schema: make workspaceId required on executions, add pricing validation), Phase 2 (Budget Enforcement -- implement pre-dispatch checks and budget alerts).

**Severity: CRITICAL -- financial risk + compliance risk from inaccurate cost reporting**

---

## Moderate Pitfalls

Mistakes that cause significant rework, degraded experience, or operational burden. Important but survivable if caught within 1-2 phases.

---

### MOD-1: Notification System Not Workspace-Scoped

**What goes wrong:** Notifications are created without workspace context and queried globally. An agent working in Workspace A receives notifications about Workspace B events, or worse, notification queries return cross-workspace data to the UI.

**Evidence from codebase (VERIFIED):**
- `notifications.ts`: The `create()` mutation accepts `recipientId`, `type`, `content`, `taskId`, `taskTitle`, `fromId`, `fromName`, `messageId` -- but NOT `workspaceId`. It inserts without workspace association.
- `getAll()` returns the 100 most recent notifications globally (no workspace filter)
- `getForAgent()` filters by `recipientId` only -- an agent that works across workspaces gets mixed notifications
- `countUnread()` counts globally per agent
- The `notifications` schema has `workspaceId: optional` with NO `by_workspace` index

**Prevention:**
1. Add `workspaceId` as required parameter to `notifications.create()`
2. Add `by_workspace` and `by_workspace_recipient` indexes to notifications table
3. Change all notification queries to require and filter by `workspaceId`
4. Derive `workspaceId` from `taskId` when creating notifications (task belongs to a workspace)

**Which phase should address it:** Phase 1 (Data Foundation -- schema migration)

---

### MOD-2: Event Sourcing Append-Only Storage Growth

**What goes wrong:** The immutable `workflow_events` table (Phase 1 requirement: "no Convex mutations that allow update or delete") grows without bound, degrading query performance and increasing storage costs.

**Evidence from codebase (VERIFIED):**
- `cleanupOldEvents()` in `executions.ts` deletes events older than 24 hours -- but this is for the `events` table (operational events), NOT for the planned `workflow_events` immutable audit log
- The roadmap explicitly requires immutability for `workflow_events`: "no Convex mutations that allow update or delete"
- Convex charges for storage and document reads -- unbounded growth directly increases costs

**Industry context (MEDIUM confidence):**
- Event stores accumulate rapidly in high-throughput systems, creating storage and query performance challenges
- In 95% of cases, Change Data Capture (CDC) with domain enrichment provides audit benefits without full event sourcing overhead
- GDPR "right to erasure" conflicts directly with immutable event logs -- a decision must be made upfront

**Prevention:**
1. **Tiered storage strategy:** Keep hot events (last 30 days) in Convex for real-time queries. Archive older events to cold storage (S3/R2) for compliance and replay.
2. **Snapshot + events pattern:** Periodically create "snapshot" records that capture workflow state at a point in time, allowing old events to be archived without losing the ability to query current state.
3. **Explicit retention policy:** Define event retention policy (e.g., 90 days in hot storage, 7 years in cold archive) before building the immutable table.
4. **Pagination-first queries:** All event log queries must use cursor-based pagination, never `.collect()` on the event table.

**Which phase should address it:** Phase 1 (Data Foundation -- design the storage strategy before creating the table) and Phase 5 (Audit and Replay -- implement archival).

---

### MOD-3: Approval Queue Race Conditions

**What goes wrong:** Two operators simultaneously approve/reject the same approval request, or an approval is resolved while the agent is already executing the step (TOCTOU violation).

**Evidence from codebase (VERIFIED):**
- `approvals.ts` `resolveApproval()`: Checks `approval.status !== "pending"` then patches. In Convex, mutations are serialized per-document, so concurrent resolution on the SAME approval is safe. However...
- The real race is between approval resolution and workflow step dispatch. If the workflow engine reads "approved" and dispatches the step, but then the operator "reopens" the approval, the step is already running with no way to recall it.
- `reopenApproval()` does not check if the approved step has already been dispatched/executed
- No "approval consumed" state exists -- once approved, the approval can be reopened even after the action has been taken

**Prevention:**
1. **Add "consumed" state to approvals:** After the execution engine reads an approval and dispatches the step, mark the approval as "consumed" (not just "approved"). Consumed approvals cannot be reopened.
2. **Approval-to-execution link:** Store `executionId` on the approval record when the step is dispatched, creating an explicit link between the approval decision and its consequence.
3. **Optimistic locking on dispatch:** The execution engine should verify the approval is still "approved" (not "reopened") in the same mutation that starts the step execution.

**Which phase should address it:** Phase 3 (Execution Engine + Approvals)

---

### MOD-4: Rate Limiting via Settings Table Anti-Pattern

**What goes wrong:** Rate limiting is implemented by reading/writing JSON strings in the `settings` table, causing contention under load and inaccurate rate counting under concurrent requests.

**Evidence from codebase (VERIFIED):**
- `rateLimit.ts`: Stores rate limit state as `JSON.stringify({ count, windowStart })` in the `value` field of the `settings` table
- Read-modify-write pattern: reads current count, increments, writes back. Under concurrent requests, two mutations could read the same count and both increment to N+1 instead of N+2 (though Convex serializes mutations per-document, so this specific race is mitigated by Convex's transaction model)
- Real issue: Every rate limit check writes to the settings table (even for reads), creating unnecessary write contention
- Settings table is shared for rate limits, pricing config, task counters, and other config -- high contention risk

**Prevention:**
1. **Separate rate limit table:** Create a dedicated `rateLimits` table with proper indexes instead of overloading the `settings` table
2. **Use Convex's built-in rate limiting patterns:** Convex documents recommend using mutations with OCC (optimistic concurrency control) for counters, or using scheduled functions for window-based limits
3. **Read-only rate limit checks:** For non-critical operations (heartbeat, polling), use a query that reads without writing, accepting slightly stale counts

**Which phase should address it:** Phase 1 (Data Foundation -- as part of schema cleanup)

---

### MOD-5: Cascade Delete Without Transaction Boundaries

**What goes wrong:** Workspace deletion triggers cascade deletes across 25+ tables. If the mutation times out mid-cascade, some tables are cleaned up and others are not, leaving orphaned records.

**Evidence from codebase (VERIFIED):**
- `workspaces.ts` `remove()`: Sequentially deletes from 23 tables using `collectAndDelete()`. Each table deletion is a separate set of operations within a single Convex mutation.
- Convex mutations have time limits. If the workspace has hundreds of records across many tables, the mutation could timeout partway through.
- No mechanism to resume a partial cascade delete
- `batchDelete(ctx, ids, 100)` batches within a table but the outer loop across tables is sequential

**Prevention:**
1. **Soft-delete pattern:** Instead of hard-deleting workspace data, mark the workspace as `deletedAt: timestamp`. Queries filter out soft-deleted workspaces. A background scheduled function performs actual cleanup in batches over time.
2. **Staged deletion:** Split cascade into phases: (1) mark workspace as "deleting" (2) scheduled function deletes data from each table in separate mutations (3) final mutation deletes the workspace record
3. **Deletion status tracking:** Store deletion progress so a failed/timed-out deletion can be resumed

**Which phase should address it:** Phase 1 (Data Foundation -- before adding more workspace-scoped tables)

---

### MOD-6: Agents as Global Entities Creates Ambiguous Workspace Context

**What goes wrong:** Agents are shared across all workspaces (by design: "10 specialized agents with distinct roles, shared across all businesses"), but workflow execution, cost tracking, and notifications are workspace-scoped. This creates constant ambiguity about which workspace an agent action belongs to.

**Evidence from codebase (VERIFIED):**
- `agents` table has no `workspaceId` field -- agents are global
- `agents.register()` comment: "Agent registration is a global event, not business-specific"
- `agents.updateStatus()` requires `workspaceId` for activity logging but not for the actual status update
- When an agent works on tasks in multiple workspaces, its `currentTaskId` points to one task but there is no workspace context
- `agents.heartbeat()` has no workspace context at all

**Prevention:**
1. **Explicit workspace context on every operation:** Agent mutations that affect workspace-scoped data must always receive and propagate `workspaceId`
2. **Agent-workspace assignment table:** If agents can be assigned to specific workspaces, create an `agentWorkspaceAssignments` junction table
3. **Execution-level workspace binding:** Every execution record must capture which workspace the agent was operating in (already partially done but `workspaceId` is optional on executions)

**Which phase should address it:** Phase 1 (Data Foundation) for schema changes, Phase 2 (Workflow Definition) for ensuring workflow execution always carries workspace context.

---

## Minor Pitfalls

Mistakes that cause tech debt, confusing code, or minor bugs. Address when convenient or when working in the area.

---

### MIN-1: Legacy `businessId` Fields Creating Schema Confusion

**What goes wrong:** Multiple tables have both `businessId` (legacy string) and `workspaceId` (new Convex ID) fields. Developers may accidentally use the wrong one, or migration may be incomplete.

**Evidence from codebase (VERIFIED):**
- `tasks`, `messages`, `activities`, `threadSubscriptions`, `documents`, `epics` all have both fields
- Comments say "Legacy field - being migrated to workspaceId" but migration may not be complete
- `businessId` is a plain string while `workspaceId` is a typed `v.id("workspaces")` -- mixing them would be a type error in TypeScript but could slip through with `any` casts

**Prevention:** Complete the migration in Phase 1 and remove `businessId` fields. Add migration tests that verify no records have `businessId` set without `workspaceId`.

**Which phase should address it:** Phase 1 (Data Foundation -- cleanup)

---

### MIN-2: `any` Type Casts Suppressing Type Safety

**What goes wrong:** Extensive use of `(q: any)` in index queries and `Record<string, any>` for update objects bypasses TypeScript's type checking, the primary guardrail against data shape mismatches.

**Evidence from codebase (VERIFIED):**
- Every `.withIndex()` call uses `(q: any) =>` cast
- Update objects in mutations use `const updates: Record<string, any> = {}`
- `agents.ts`, `workspaces.ts`, `tasks.ts`, `notifications.ts` all exhibit this pattern
- This means schema changes (renaming a field, changing a type) would NOT produce compile errors in the mutations

**Prevention:** Invest in proper Convex type generation or create typed query builder helpers that enforce field names and types at compile time.

**Which phase should address it:** Any phase -- gradual improvement. Flag for tech debt tracking.

---

### MIN-3: Denormalized Data Staleness

**What goes wrong:** The codebase denormalizes agent names, task titles, and other fields into records for query performance. When the source data changes, denormalized copies become stale.

**Evidence from codebase (VERIFIED):**
- `activities` table stores `agentName`, `taskTitle`, `ticketNumber` -- all denormalized
- `executions` table stores `agentName`, `taskTitle` -- denormalized at creation time
- `messages` table stores `fromName`, `fromRole` -- denormalized
- If an agent name changes (e.g., `lowercaseAllNames` migration), all historical records show the old name

**Prevention:**
1. Accept denormalization for historical records (the name at the time of the event is the correct historical record)
2. For current-state displays, always join with the source table
3. Document which denormalized fields represent "point-in-time" values vs. "current" values

**Which phase should address it:** Not urgent -- document the convention in Phase 1.

---

### MIN-4: Pricing Configuration Not Versioned

**What goes wrong:** Model pricing changes over time (providers frequently adjust rates). The current pricing config in the settings table is a single value with no versioning. If pricing changes, historical cost calculations become retroactively incorrect.

**Evidence from codebase (VERIFIED):**
- `calculateCost()` reads pricing from a single `settings` row with `key="pricing"`
- No timestamp or version on the pricing config
- If pricing is updated, all future cost calculations use new rates but past executions were calculated with old rates
- No way to reconstruct what the pricing was at the time of a specific execution

**Prevention:** Store pricing as a versioned array: `[{ effectiveFrom: timestamp, rates: { model: { input, output } } }]`. Cost calculation uses the rate that was effective at the execution's `startTime`.

**Which phase should address it:** Phase 1 (Data Foundation -- model pricing table design)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation | Severity |
|-------------|---------------|------------|----------|
| Phase 1: Data Foundation | Schema migration breaks existing data (workspaceId required on tables with optional/missing values) | Write backfill migration that sets workspaceId from task/epic relationship. Run on staging first. Never make a field required without backfilling all existing records. | HIGH |
| Phase 1: Data Foundation | Immutable event table designed without retention/archival strategy | Define retention policy and cold storage path before creating the table. Do not assume "append forever" works at scale. | MEDIUM |
| Phase 2: Workflow Definition | DAG validation passes at save time but runtime execution hits edge cases (parallel fan-out/fan-in, conditional branches) | Test with workflow definitions that have 10+ steps, diamond dependencies, and conditional paths. Validate that `getReadySteps()` handles all cases. | HIGH |
| Phase 2: Budget Enforcement | Budget check is not atomic with dispatch -- TOCTOU race allows over-budget execution | Implement budget check + dispatch as a single Convex mutation. Never check budget in a query then dispatch in a separate mutation. | CRITICAL |
| Phase 3: Execution Engine | Step stays in "running" state forever when agent crashes | Implement heartbeat-based liveness detection. Scheduled function checks for stale running steps every 60 seconds. | HIGH |
| Phase 3: Approvals | Approval resolved after step already dispatched -- no recall mechanism | Add "consumed" state. Link approval to execution. Prevent reopening consumed approvals. | MEDIUM |
| Phase 4: Observability Dashboard | Dashboard queries do full table scans on large execution/event tables | All dashboard queries must use indexes and pagination from day one. Never use `.collect()` on tables expected to grow unbounded. | MEDIUM |
| Phase 4: Cost Dashboard | Cost numbers are wrong because of CRIT-3 (silent zero-cost fallback) | Fix `calculateCost()` to fail loudly before building the cost dashboard. A beautiful dashboard showing wrong numbers is worse than no dashboard. | HIGH |
| Phase 5: Audit Replay | Replaying old executions that reference deleted agents/tasks/workspaces | Store all context needed for replay in the event itself (denormalized). Do not rely on being able to join with source tables for historical replay. | MEDIUM |
| Phase 5: Audit Replay | Event table too large to query efficiently | Implement tiered storage (hot/cold) and time-windowed indexes. Replay queries should specify a time range, never scan the full event history. | HIGH |

---

## REST API Standards That Prevent These Pitfalls

The following REST API design patterns directly mitigate the pitfalls identified above:

### 1. Workspace Scoping in URL Path (Prevents CRIT-1)
```
/api/workspaces/{workspaceId}/tasks
/api/workspaces/{workspaceId}/executions
/api/workspaces/{workspaceId}/notifications
```
When `workspaceId` is part of the URL, it is impossible to make a request without specifying workspace context. The API route handler extracts it from params and passes it to every Convex mutation/query. Compare to the current pattern where some routes accept `workspaceId` as a query parameter (easy to omit) or not at all.

### 2. Consistent Authorization Middleware (Prevents CRIT-1, MOD-6)
Every API route should pass through middleware that:
- Extracts workspace context from URL or token
- Validates the caller has access to that workspace
- Injects `workspaceId` into every downstream Convex call

This prevents individual route handlers from forgetting to check workspace access.

### 3. Idempotency Keys on Mutations (Prevents MOD-3, MOD-5)
```
POST /api/workspaces/{id}/executions
X-Idempotency-Key: uuid-v4
```
Idempotency keys prevent duplicate execution creation from retried requests. Critical for approval resolution (approve clicked twice), workflow dispatch (timeout + retry = double dispatch), and cost tracking (duplicate execution = double cost).

### 4. Budget Headers on Execution Requests (Prevents CRIT-3)
```
POST /api/workspaces/{id}/workflows/{wfId}/execute
X-Budget-Cap-Cents: 5000
```
Making budget limits explicit in the API contract forces callers to think about cost upfront and makes budget enforcement testable at the API layer.

### 5. Pagination on All List Endpoints (Prevents MOD-2, Phase 4/5 warnings)
```
GET /api/workspaces/{id}/events?cursor=abc&limit=50
Response: { data: [...], nextCursor: "def", hasMore: true }
```
Cursor-based pagination prevents the "query all events" anti-pattern. Every list endpoint should require pagination parameters and cap the maximum page size.

### 6. Structured Error Responses with Request IDs (Prevents silent failures)
```json
{
  "error": {
    "code": "BUDGET_EXCEEDED",
    "message": "Workflow estimated cost ($52.00) exceeds budget cap ($50.00)",
    "requestId": "req_abc123",
    "details": { "estimatedCents": 5200, "budgetCents": 5000 }
  }
}
```
Structured errors with specific codes (not just HTTP status) make it possible to detect cost governance failures, authorization failures, and rate limit hits programmatically. The existing `ApiError` pattern in the codebase is a good start -- it needs to be applied consistently to all mutations.

---

## Sources

### Multi-Tenant Isolation
- [Multi-Tenant Leakage: When Row-Level Security Fails in SaaS](https://medium.com/@instatunnel/multi-tenant-leakage-when-row-level-security-fails-in-saas-da25f40c788c) - Connection pool contamination, shared cache poisoning, async context leaks
- [Tenant Isolation in Multi-Tenant Systems](https://securityboulevard.com/2025/12/tenant-isolation-in-multi-tenant-systems-architecture-identity-and-security/) - Architecture, identity, and security patterns
- [Tenant Data Isolation: Patterns and Anti-Patterns](https://propelius.ai/blogs/tenant-data-isolation-patterns-and-anti-patterns/) - Anti-patterns to avoid
- [Multi-tenant SaaS Authorization - AWS Prescriptive Guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/saas-multitenant-api-access-authorization/introduction.html) - API access control patterns
- [Tenant Isolation - WorkOS](https://workos.com/blog/tenant-isolation-in-multi-tenant-systems) - Practical tenant isolation implementation

### Agent Orchestration Failures
- [Why Multi-Agent AI Systems Fail - Galileo](https://galileo.ai/blog/multi-agent-ai-failures-prevention) - 37% coordination failures, prevention strategies
- [17x Error Trap - Towards Data Science](https://towardsdatascience.com/why-your-multi-agent-system-is-failing-escaping-the-17x-error-trap-of-the-bag-of-agents/) - Error multiplication in multi-agent pipelines
- [Agentic Recursive Deadlock](https://tech-champion.com/artificial-intelligence/the-agentic-recursive-deadlock-llm-orchestration-collapses/) - LLM orchestration deadlock patterns
- [Agentic Resource Exhaustion](https://instatunnel.my/blog/agentic-resource-exhaustion-the-infinite-loop-attack-of-the-ai-era) - Infinite loop attacks on AI systems
- [Why Multi-Agent Orchestration Collapses](https://dev.to/onestardao/-ep-6-why-multi-agent-orchestration-collapses-deadlocks-infinite-loops-and-memory-overwrites-1e52) - Deadlocks, infinite loops, memory overwrites

### Cost Governance
- [Token Cost Trap](https://medium.com/@klaushofenbitzer/token-cost-trap-why-your-ai-agents-roi-breaks-at-scale-and-how-to-fix-it-4e4a9f6f5b9a) - Why AI agent ROI breaks at scale
- [LLM Cost Management 2025 - Binadox](https://www.binadox.com/blog/why-llm-cost-management-is-important-in-2025/) - Cost management importance
- [LLM Cost Tracking Solution - TrueFoundry](https://www.truefoundry.com/blog/llm-cost-tracking-solution) - Observability, governance, optimization
- [How to Track LLM Token Usage Per User - Traceloop](https://www.traceloop.com/blog/from-bills-to-budgets-how-to-track-llm-token-usage-and-cost-per-user) - Per-user attribution

### Workflow and Event Sourcing
- [100x Faster Workflow Engine - Netflix](https://netflixtechblog.com/100x-faster-how-we-supercharged-netflix-maestros-workflow-engine-028e9637f041) - Race conditions in workflow engines, in-memory state rebuilding
- [Temporal: Beyond State Machines](https://temporal.io/blog/temporal-replaces-state-machines-for-distributed-applications) - Durable execution and event sourcing
- [Event Sourcing Pitfalls - DZone](https://dzone.com/articles/event-sourcing-guide-when-to-use-avoid-pitfalls) - When to use, how to avoid pitfalls
- [Rethinking Event Sourcing - Bemi](https://blog.bemi.io/rethinking-event-sourcing/) - CDC as alternative in 95% of cases

### REST API Security
- [REST API Security Best Practices 2026 - Levo](https://www.levo.ai/resources/blogs/rest-api-security-best-practices) - Comprehensive security guide
- [REST API Authorization Best Practices - AppSentinels](https://appsentinels.ai/blog/rest-api-authorization-best-practices/) - Object-level access control
- [Web API Design Best Practices - Microsoft Azure](https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design) - Resource-based URL design

### Convex-Specific
- [Multi-tenant product - Convex Community](https://discord-questions.convex.dev/m/1471574111246356491) - Community discussion on multi-tenancy patterns
- [Horizontally Scaling Functions - Convex](https://stack.convex.dev/horizontally-scaling-functions) - Convex's execution model
