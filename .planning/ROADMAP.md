# Roadmap: Mission Control

## Overview

Mission Control adds a governance and observability layer on top of an existing multi-agent execution engine. The build order follows a strict dependency chain: the schema that records everything must exist before the execution engine writes to it, the workflow abstraction must exist before the engine can execute one, and the UI that makes execution legible can only be built after the data it displays is being produced. Five phases deliver the complete system — from empty tables to full audit replay — with cost controls and auditability established in Phase 1, not retrofitted later.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Data Foundation** - Establish schema tables, event sourcing fields, model pricing, and immutable audit log infrastructure
- [ ] **Phase 2: Workflow Definition + Budget Enforcement** - Define reusable workflow DAGs, validate structure, set and enforce budget caps
- [ ] **Phase 3: Execution Engine + Approvals** - Execute workflows end-to-end via the state machine, wire gateway dispatch, enforce approval gates
- [ ] **Phase 4: Observability Dashboard** - Surface real-time execution status, agent I/O, cost breakdowns, and error details in unified UI
- [ ] **Phase 5: Audit & Replay** - Enable search, filter, and full replay of any past execution from the immutable event log

## Phase Details

### Phase 1: Data Foundation
**Goal**: The data infrastructure required by all subsequent phases exists: three new Convex tables (`workflow_executions`, `workflow_steps`, `workflow_events`), event sourcing fields on the existing `executions` table, a model pricing table, and the schema-level immutability guarantee for the audit log.
**Depends on**: Nothing (first phase)
**Requirements**: AUDIT-01
**Success Criteria** (what must be TRUE):
  1. The `workflow_events` table exists with no Convex mutations that allow update or delete — immutability is enforced at the schema boundary, not by convention
  2. The `workflow_executions` table exists with budget fields (`totalBudgetCents`, `spentCents`) and a state machine status enum (`pending`, `running`, `completed`, `failed`, `aborted`)
  3. The `workflow_steps` table exists with step-level cost fields (`inputTokens`, `outputTokens`, `estimatedCostCents`) and status enum (`waiting`, `running`, `completed`, `failed`, `blocked`)
  4. A model pricing table (or config) exists that maps model IDs to per-token costs, usable by budget enforcement logic
  5. All schema changes have corresponding migrations in `convex/migrations.ts` and all new table indexes pass the existing schema validation tests
**Plans**: TBD

Plans:
- [ ] 01-01: Schema tables and migrations
- [ ] 01-02: Model pricing config and cost utilities

### Phase 2: Workflow Definition + Budget Enforcement
**Goal**: Users can define reusable workflow pipelines composed of sequential and parallel steps, the system validates DAG structure at save time, and budget caps are enforced before any workflow dispatches a step.
**Depends on**: Phase 1
**Requirements**: WF-01, WF-02, WF-03, WF-04, WF-05, BUDGET-01, BUDGET-02
**Success Criteria** (what must be TRUE):
  1. User can create a workflow with sequential steps (A → B → C) and save it — the workflow persists in Convex with the full step definition and dependency graph
  2. User can add parallel execution blocks to a workflow (A, B, C run concurrently) and save — the system correctly represents fan-out and fan-in in the DAG
  3. When the user saves a workflow containing a circular dependency, the system rejects the save with a specific error identifying the cycle — no invalid workflow is persisted
  4. When the user saves a workflow referencing an agent or input that does not exist, the system rejects the save with a specific error identifying the missing dependency
  5. User can manually trigger workflow execution from the UI — clicking "Run" creates a `workflow_executions` record and returns a run ID
  6. When a workflow's estimated cost exceeds its configured budget cap, the system halts dispatch before the first step is sent to any agent — no execution begins
**Plans**: TBD

Plans:
- [ ] 02-01: Workflow CRUD mutations and DAG validation
- [ ] 02-02: Workflow builder UI
- [ ] 02-03: Budget enforcement (pre-dispatch check and halt logic)

### Phase 3: Execution Engine + Approvals
**Goal**: Workflows execute end-to-end: the state machine advances steps, dispatches work to agents via the gateway, tracks tokens in real time, and halts at approval gates for operator review before irreversible actions.
**Depends on**: Phase 2
**Requirements**: APPR-01, APPR-02, APPR-03, BUDGET-03, BUDGET-04
**Success Criteria** (what must be TRUE):
  1. When a workflow run reaches a step marked as requiring approval, execution pauses and the step appears in the operator's approval queue — no dispatch occurs until the operator acts
  2. When an operator approves or rejects a queued step, the system records the operator's identity (username, timestamp) in the `workflow_events` log as an immutable event
  3. Read-only workflow steps execute without entering the approval queue; only write and irreversible steps require approval — the risk tier defined in the workflow definition determines routing
  4. Input token counts for each executing step update in the `workflow_steps` table in real time as the step runs — the count is observable before the step completes
  5. Output token counts for each executing step update in the `workflow_steps` table upon step completion — both input and output counts are always present in the record for completed steps
**Plans**: TBD

Plans:
- [ ] 03-01: Execution engine state machine (startWorkflow, onStepComplete, onStepFailed, abortWorkflow)
- [ ] 03-02: Gateway dispatch integration (dispatchStep RPC, onStepResult callback)
- [ ] 03-03: Approval queue backend and UI

### Phase 4: Observability Dashboard
**Goal**: The operator can see everything happening across all workflow runs in a single unified dashboard — live execution status per step, agent I/O for completed steps, accumulated cost against budget, and error details for failures.
**Depends on**: Phase 3
**Requirements**: OBS-01, OBS-02, OBS-03, OBS-04, OBS-05, OBS-06, BUDGET-05, BUDGET-06
**Success Criteria** (what must be TRUE):
  1. The unified dashboard shows all workflow runs (running, completed, failed) with current status — a user arriving at the page sees the system's complete execution state without navigating elsewhere
  2. Clicking into a running workflow shows each step's current status (running, completed, failed, blocked) updating in real time without a page refresh
  3. For any completed step, the user can view the full agent I/O: the exact inputs provided to the agent and the exact outputs the agent returned
  4. During an active workflow run, the user can see the token count consumed so far and the USD cost accumulated so far — both update as steps complete
  5. For failed workflow steps, the user can view the specific error message and failure reason — enough detail to diagnose the problem without inspecting server logs
  6. On the cost breakdown view, the user can see cost grouped by agent and grouped by model for any completed workflow run
**Plans**: TBD

Plans:
- [ ] 04-01: Unified run status view (workflow list + step drill-down)
- [ ] 04-02: Real-time token and cost display
- [ ] 04-03: Cost breakdown dashboard (per-agent, per-model)
- [ ] 04-04: Failure detail view

### Phase 5: Audit & Replay
**Goal**: The operator can search the full history of every workflow execution by name, agent, or time range, and can replay any past execution to see all inputs, outputs, costs, and decisions in their original order.
**Depends on**: Phase 4
**Requirements**: AUDIT-02, AUDIT-03, AUDIT-04, AUDIT-05, AUDIT-06
**Success Criteria** (what must be TRUE):
  1. The audit log viewer allows the user to search executions by workflow name and see matching results — search returns only runs matching the query, not all runs
  2. The audit log viewer allows the user to filter by agent name — results show only runs where that agent participated
  3. The audit log viewer allows the user to filter by date/time range — results show only runs that started within the specified window
  4. The user can select any completed execution from the audit log and replay it — the replay reconstructs the full execution state showing all steps in their original sequence
  5. A replayed execution shows all inputs, outputs, token costs, and approval decisions for every step — nothing from the original run is omitted from the replay view
**Plans**: TBD

Plans:
- [ ] 05-01: Audit log viewer with search and filter UI
- [ ] 05-02: Replay engine (event log to state reconstruction)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Foundation | 0/2 | Not started | - |
| 2. Workflow Definition + Budget Enforcement | 0/3 | Not started | - |
| 3. Execution Engine + Approvals | 0/3 | Not started | - |
| 4. Observability Dashboard | 0/4 | Not started | - |
| 5. Audit & Replay | 0/2 | Not started | - |
