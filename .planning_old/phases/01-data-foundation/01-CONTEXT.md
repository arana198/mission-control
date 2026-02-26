# Phase 1: Data Foundation - Context

**Gathered:** 2025-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish the data infrastructure required by all subsequent phases: three new Convex tables (`workflow_executions`, `workflow_steps`, `workflow_events`), event sourcing fields on the existing `executions` table, model pricing configuration, and schema-level immutability guarantee for the audit log. No execution logic or UI in this phase — pure data foundation.

</domain>

<decisions>
## Implementation Decisions

### Audit Log Immutability

- **Append-only with archive:** Allow `archiveOldEvents()` mutation to mark events as archived (read-only). No direct deletes; soft archival only.
- **Rich denormalized events:** Each event includes context (workflowName, agentName, operatorId, timestamp) to enable fast queries without joins.
- **Strongly-typed event tables:** Separate tables per event type (WorkflowStartedEvent, StepDispatchedEvent, StepCompletedEvent, etc.) — 10+ event types in v1. Structure enforced at schema boundary.
- **10+ event types in v1:** WorkflowStarted, StepDispatched, StepCompleted, StepFailed, ApprovalRequested, ApprovalApplied, BudgetExceeded, ExecutionAborted, TokensUpdated, CostRecalculated.
- **90-day hot retention:** Events live hot in Convex for 90 days, then archived to separate cold storage. Enables fast queries on recent runs; compliance history survives in cold store.
- **Soft references in events:** Events store executionId/stepId as IDs only — no foreign key constraints. Allows events to survive if execution record is pruned.
- **Snapshots every N events:** Add execution state snapshots periodically (e.g., every 10 events) to speed up replay of old executions without replaying from event 0.
- **Rich query indexes:** Index workflow_events on (executionId, workflowName, agentName, timestamp) to enable Phase 4 dashboard filtering without table scans.

### Event Sourcing Fields

- **Both table + denormalized field:** `executions` table gets an optional `events` array field (JSON) for fast access to related events without joins. Events also live in separate typed tables.
- **Full state denormalization:** `executions` record tracks complete latest state (executionId, status, totalCost, spentTokens, approvalsPending, currentStepId, triggeredBy, approvalApprovedBy, etc.) — snapshot of current values.
- **Enum + events canonical:** `executions.status` is an enum field ("pending", "running", "completed", "failed", "aborted") for query speed, but `workflow_events` table is the canonical source of truth. Status must be kept in sync.
- **Operator identity denormalized:** Track who triggered (triggeredByUserId) and who approved (approvedByUserId) directly in `executions` record for fast dashboard queries. Also in events for full audit trail.

### Table Relationships

- **New table `workflow_executions`:** Separate table (not reused from existing executions). Workflows are a new orchestration abstraction layered on top of agents.
- **New table `workflow_steps`:** Separate table tracking orchestration state. `workflow_steps.agentId` links to the agent being called. Steps are different from tasks — they represent workflow positions.
- **Hard foreign key constraints:** `workflow_executions.id <- workflow_events.executionId`, `workflow_steps.id <- workflow_events.stepId`. Database enforces referential integrity.
- **Allow empty workflows:** A workflow_execution can have zero steps during creation (validation warning only). Don't require at least one step — allows flexible workflow building.

### Model Pricing

- **Convex table `model_pricing`:** Mutable pricing table (not static config). Admin can update without redeployment.
- **Per-model-variant granularity:** Structure: `{ modelId: "gpt-4-turbo-128k", inputTokenCostCents: 1, outputTokenCostCents: 3, updatedAt: timestamp }`. Different context windows = different pricing.
- **Fallback pricing for unknowns:** Unknown models don't fail loudly. Fall back to conservative default (e.g., $0.01/token) and log a warning. Prevents workflow halt if a model is not in the table.
- **Daily sync from APIs:** `model_pricing` should auto-sync from Anthropic and OpenAI official pricing endpoints daily. Keeps pricing accurate without manual updates (implement as Convex cron job in Phase 1 or early Phase 2).

### Claude's Discretion

- Exact schema field names and types (e.g., `totalBudgetCents` vs `budgetTokens`; decisions above specify intent, not field names)
- Event table primary keys and index strategy (beyond the query-path indexes already specified)
- Snapshot frequency (e.g., every 5 events, every 10, or time-based)
- Cold storage strategy for archived events (v1 just archives to "archived" flag; v2 considers ClickHouse/S3)

</decisions>

<specifics>
## Specific Ideas

- **"This is the most important phase."** Cost controls and auditability cannot be retrofitted. Get the schema right from the start. Every execution will touch these tables from Phase 2 onward.
- **"I want to be able to replay any execution exactly."** The event structure, denormalization, and snapshot strategy all serve this single purpose.
- **"Pricing precision matters."** Different context windows have different speeds and costs. Variants allow accurate tracking.

</specifics>

<deferred>
## Deferred Ideas

- **Push notifications:** Out of scope. UI shows status; push notifications deferred to v2+.
- **ClickHouse for cold storage:** Mentioned during discussion; belongs in v2 when event volume grows beyond 90-day retention.
- **ML-driven pricing prediction:** Future enhancement; v1 is lookup tables only.
- **Multi-tenant audit isolation:** Enterprise audit trails with per-tenant encryption; deferred to v2.

</deferred>

---

*Phase: 01-data-foundation*
*Context gathered: 2025-02-26*
