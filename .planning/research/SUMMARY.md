# Project Research Summary

**Project:** Mission Control — Multi-Agent Orchestration Control Plane
**Domain:** Agent control plane / workflow orchestration / AI governance
**Researched:** 2026-02-25
**Confidence:** HIGH

## Executive Summary

Mission Control is a control plane for supervising autonomous specialist agents. The dominant pattern in 2025 for TypeScript-first control planes is to treat workflow state as an append-only event log (Temporal's insight), make the execution dashboard the entry point rather than the workflow builder (Prefect's insight), and enforce budget and governance at the orchestration layer before execution begins — not as an afterthought. The research confirms that Mission Control already has substantial infrastructure (agents, executions, approvals, anomaly detection, gateways) but is missing the unifying abstraction that binds them: a first-class `workflows` table with DAG step definitions, a step scheduler (execution engine), and the UI surfaces that make that data legible to operators.

The recommended approach for v1 is to build entirely on the existing Convex + Next.js stack without adding external services. The `@convex-dev/workflow` component provides durable execution. The existing `executions` table (extended with event sourcing semantics) provides audit and replay. Custom Convex mutations implement the execution engine and budget enforcement. This is the stack constraint imposed by the project and is also the architecturally correct choice for a single-operator v1: zero new infrastructure, reactive by default, fully typed.

The critical risk is not technical — it is scope and ordering. Multi-agent systems fail expensively and compoundingly when cost controls and auditability are treated as v2 concerns. The research across all four dimensions converges on the same warning: observability and budget enforcement must be baked into the schema and data model before the first workflow runs. Every other feature depends on them. Phase 1 must establish the data foundation; governance features that skip this foundation cannot be retrofitted.

---

## Key Findings

### Recommended Stack

The entire control plane can and should be built on the existing Convex + Next.js stack. No new languages, frameworks, or services are needed for v1. The research evaluated Temporal, Inngest, Mastra, LangGraph, Hatchet, AutoGen, and CrewAI; all were ruled out for v1 due to Python primacy, heavyweight infrastructure requirements, or license concerns (Mastra's Elastic v2). The `@convex-dev/workflow` component runs entirely within the existing Convex deployment, survives restarts, and makes workflow state reactive to the dashboard via existing `useQuery` subscriptions.

**Core technologies:**
- `@convex-dev/workflow` (stable 2025): durable workflow execution — zero new infra, native Convex typing, reactive by default
- `graphlib` ^3.0.0 (MIT): cycle detection and topological sort for DAG validation — battle-tested, 50 lines of integration code
- `@traceloop/node-server-sdk` (OpenLLMetry-JS): token instrumentation via OTel GenAI conventions — zero-config wrapping of Anthropic/OpenAI SDK
- Convex `executions` table (extended): cost accounting and audit log — existing schema extended with `eventType`, `correlationId`, `estimatedCostUsd`
- Custom Convex pre-step mutation: budget enforcement — in-process comparison against `totalCostCents`, no gateway proxy needed for v1

**Deferred to v2+:** Langfuse (LLM observability dashboard), LiteLLM/Helicone (gateway-layer hard budget stops), ClickHouse (cold audit archive), Temporal/Hatchet (advanced workflow engines).

See `.planning/research/STACK.md` for full analysis.

---

### Expected Features

The research identifies a tight v1 MVP: 6 Tier-1 launch blockers (all buildable) and 5 Tier-2 high-value items. The key realization is that the data model for most features already exists — the gap is the unifying workflow abstraction, the step scheduler, and the UI surfaces.

**Must have (table stakes — launch blockers):**
- Workflow definition model (DAG + steps + version) — the missing abstraction that ties agents, tasks, and execution together; `graphValidation.ts` DAG logic already exists
- Manual workflow trigger from UI — no trigger mechanism exists today; medium effort (1 sprint)
- Unified workflow run status view — data exists across scattered views; needs composition into single run view
- Approval queue UI — `approvals.ts` backend is complete; only the UI queue and notification are missing
- Audit log viewer — `decisions`, `activities`, `executions` tables already capture data; search/filter UI is the gap
- Cost tracking per run — `calculateCost()` exists; needs aggregated cost queries and UI summary

**Should have (high value, ship within first month):**
- Budget enforcement with halt-on-limit — no enforcement logic exists despite data being present; medium effort
- Workflow halt (emergency stop) — cascades cancellation to all in-flight steps and notifies agents via gateway
- Failure detail view — failure-focused UI surface over the existing error fields
- Anomaly detection wired to alert rules — components exist separately; need to be connected end-to-end
- Operator identity (`triggeredBy`) in audit records — add once, never retrofit

**Defer (v2+):**
- Autonomous scheduling — v1 is supervised; earn trust before removing the human trigger
- Multi-stage conditional approval workflows — binary approve/reject is sufficient for v1
- ML-driven predictive cost forecasting — no historical data to train on in v1
- Custom agent type plugin architecture — premature abstraction; v1 contracts are not yet stable
- Full multi-tenant RBAC — single-user v1; capture `operatorId` from day one but defer enforcement
- Live agent I/O trace viewer — gateway infrastructure exists but trace schema + UI is high effort (2-3 sprints); post-launch

See `.planning/research/FEATURES.md` for full analysis.

---

### Architecture Approach

The architecture separates into six layers with strict boundaries: Workflow Definition (static artifacts in Convex), Execution Engine (Convex mutations as the scheduler), State Management (three new tables: `workflow_executions`, `workflow_steps`, `workflow_events`), Observability (reads from state; never writes), Economic Tracking (budget check before dispatch; cost rollup via hourly cron), and Audit/Replay (append-only `workflow_events` with periodic snapshots). The gateway layer is pass-through transport only — all state authority lives in Convex.

**Major components:**
1. Workflow Definition Layer (`workflows` table) — stores versioned DAG definitions; validates acyclicity on save via existing `detectCycle()`; never mutated in place
2. Execution Engine (Convex mutations) — `startWorkflow`, `onStepComplete`, `onStepFailed`, `abortWorkflow`; single authority for dispatch sequencing; must be decomposed into small atomic mutations (Convex 10-second limit)
3. State Management (`workflow_executions` + `workflow_steps` + `workflow_events`) — runtime ledger; Convex MVCC provides race-free concurrent step completions without explicit locks
4. Economic Tracker (extends existing `executions` + `calculateCost()`) — pre-dispatch budget check is in-process (no DB roundtrip); hourly cron aggregates metrics for dashboard
5. Audit/Replay Layer (`workflow_events` append-only + `workflow_snapshots`) — snapshot every 50 events and on completion; denormalize agent/workflow names at write time for historical accuracy
6. Gateway Layer (existing, unchanged) — reuse `gatewayConnectionPool` and `gatewayRpc.call()`; add `dispatchStep` RPC and `onStepResult` callback

**Build order (critical — each phase depends on prior):**
Phase A: Schema → Phase B: Economic Layer → Phase C: Workflow Definition → Phase D: State Management → Phase E: Execution Engine → Phase F: Gateway Integration → Phase G: Audit/Replay → Phase H: Observability Dashboard

See `.planning/research/ARCHITECTURE.md` for full analysis.

---

### Critical Pitfalls

The pitfalls research (14 identified failure modes, synthesized from 20+ production post-mortems and academic studies) reduces to five actionable imperatives for Mission Control:

1. **Cost controls must be in the schema, not the UI** — Runaway agent execution is the single highest-impact failure. A production example: a single retry storm caused a 1,700% cost spike during a provider outage. Prevention: hard token budget per task enforced at orchestration layer before dispatch; real-time in-flight cost tracking; circuit breaker halting tasks that retry the same action 3x without progress. *Phase A must include budget fields in schema.*

2. **Log every LLM call at all six layers — never sample** — Most observability tools capture only the LLM layer (final prompt/response) and miss: trigger context, orchestration decisions, tool call inputs/outputs, inter-agent payloads, and side effects. Without all six layers, production incidents cannot be debugged. Prevention: unified `executionId` spanning the entire workflow; structured JSON log per call with `{ taskId, workflowId, agentId, modelId, inputTokens, outputTokens, toolCallTokens, retryCount, timestamp }`. *Observability is a prerequisite, not a feature.*

3. **Persist state machine in Convex at every transition — never rely on in-memory state** — WebSocket disconnects and process restarts silently lose execution state when it lives in memory. The specific risk for Mission Control: if a gateway connection drops mid-step, the step state must be recoverable from Convex, not from the gateway process. Prevention: explicit step status enum persisted on every transition; checkpoint snapshots at each agent handoff. *Phase D (State Management) is more critical than Phase E (Execution Engine).*

4. **Schema-validate all inter-agent handoffs** — Hallucinations propagate through agent chains when Agent B trusts Agent A's output as ground truth. A structured handoff schema (`{ taskId, inputs, constraints, parentSummary }`) that is validated before forwarding prevents hallucination amplification. Prevention: agents return structured JSON with defined schemas; lightweight validation gate in the execution engine before advancing to next step. *This is Phase C (Workflow Definition) work: define output schemas per step at authoring time.*

5. **Risk-stratify approvals — never require approval for every action** — Governance systems fail through approval fatigue when every minor action triggers a review. The opposite failure (single coarse-grained approval covering irreversible actions) is equally dangerous. Prevention: action risk tiers defined in workflow definition (read / write / irreversible / financial); approval required only for high-risk tiers; approval requests must show exact parameters and estimated cost, not just action type; approvals are time-bound and non-reusable across runs. *Current `approvals.ts` backend implements this correctly; the UI must expose risk context.*

See `.planning/research/PITFALLS.md` for full analysis.

---

## Implications for Roadmap

Based on combined research, the architecture's prescribed build order maps directly to roadmap phases. The dependency chain is strict: you cannot build the execution engine before state management, and state management requires the schema. Budget enforcement belongs in Phase 2 (before the engine runs anything), not deferred.

### Phase 1: Data Foundation (Schema + Economic Layer)
**Rationale:** All other phases depend on the schema. Establishing `workflow_executions`, `workflow_steps`, and `workflow_events` tables — plus budget fields — before any execution logic prevents the most expensive pitfall: retrofitting cost controls into a live system. This is architecturally mandatory, not optional.
**Delivers:** Three new Convex tables with proper indexes; extended `executions` schema with event sourcing fields (`eventType`, `correlationId`, `estimatedCostUsd`); model pricing table; migrations for all changes; schema tests.
**Addresses features:** Prerequisite for all Tier-1 features; directly addresses cost tracking (2.1) and audit log (1.6).
**Avoids pitfalls:** Runaway execution (cost fields in schema from day 1); insufficient logging depth (event schema captures all 6 layers); lost state (state machine fields baked in).
**Research flag:** Standard patterns — Convex schema migration is well-documented; no research needed.

### Phase 2: Workflow Definition + Budget Enforcement
**Rationale:** The workflow abstraction is the missing linchpin. Without it, agents and tasks remain disconnected primitives. Budget enforcement belongs here because it must check against workflow-level budget caps — which only exist once workflows are defined. This phase closes the largest feature gap (no workflow pipeline abstraction) while establishing governance before any execution engine runs.
**Delivers:** `workflows` table with CRUD mutations; DAG validation using `detectCycle()` at save time; `WorkflowDefinition` type with `totalBudgetCents`; `canDispatchStep()` budget enforcement function; workflow versioning.
**Addresses features:** Workflow definition model (Tier-1); budget enforcement (Tier-2); operator identity in audit records (Tier-2 — low effort, add here).
**Avoids pitfalls:** Implicit dependencies (explicit typed dependency graph); approval exhaustion (risk tier classification in workflow definition); policy drift (model version pinned at workflow definition time).
**Research flag:** Standard patterns — DAG definition and budget enforcement are well-understood; no research needed.

### Phase 3: Execution Engine + Gateway Integration
**Rationale:** With schema and workflow definitions in place, the execution engine is a straightforward implementation of the state machine. Gateway integration reuses existing `gatewayConnectionPool` and `gatewayRpc.call()` — the only additions are `dispatchStep` RPC and `onStepResult` callback. This phase makes the system executable end-to-end for the first time.
**Delivers:** `startWorkflow`, `onStepComplete`, `onStepFailed`, `abortWorkflow` mutations; parallel fan-out via `getReadySteps()`; retry policy with exponential backoff + jitter; `dispatchStep` and `onStepResult` gateway wiring; workflow trigger API endpoint.
**Addresses features:** Manual workflow trigger (Tier-1); workflow halt/emergency stop (Tier-2); failure handling (Tier-2).
**Avoids pitfalls:** Silent failure modes (explicit status enum, dead letter queue for halted tasks); cascading resource failures (orchestrator-level rate limiting, circuit breaker); hallucination propagation (schema validation gate in `onStepComplete`).
**Research flag:** Needs phase research — Convex mutation time limits (10s max) require careful decomposition of long orchestration loops into small atomic mutations. Verify `@convex-dev/workflow` behavior at step boundaries.

### Phase 4: Observability UI (Run View + Approval Queue + Cost Dashboard)
**Rationale:** The execution engine produces data; this phase makes that data visible. The Prefect insight applies here: the dashboard is the product. Cost tracking data, audit records, and approval workflows already have backend implementations — this phase surfaces them in a unified operator interface.
**Delivers:** Unified workflow run view (step-level drill-down, status per step, assigned agents); approval queue UI with approve/reject actions and pending notifications; cost breakdown dashboard (per-agent, per-workflow, today's spend); failure detail view with error context.
**Addresses features:** Workflow run status view (Tier-1); approval queue UI (Tier-1); audit log viewer (Tier-1); cost tracking per run (Tier-1); failure detail view (Tier-2); alert rule notifications (Tier-2).
**Avoids pitfalls:** Speed over observability (the dashboard is the entry point, not an afterthought); insufficient logging depth (all six layers visible in run view); compliance gaps (audit log viewer with search, filter, and eventual export).
**Research flag:** Standard patterns — Convex `useQuery` reactive subscriptions are well-documented; UI component patterns are established in existing codebase.

### Phase 5: Audit/Replay + Pattern Learning Surfaces
**Rationale:** After the system has accumulated execution history, the advanced auditability and intelligence features become valuable. Replay requires event snapshots that can only be taken after the event log is populated. Pattern learning UI requires accumulated execution data. This phase converts Mission Control from a governance tool to a learning system.
**Delivers:** Replay engine (event log to execution state reconstruction); snapshot creation on completion and every 50 events; audit log viewer with search/filter by agent, workflow, time range, status, cost; pattern suggestions surface in workflow builder (backend `patternLearning.ts` already done); audit log export (CSV/JSON).
**Addresses features:** Audit log viewer with full search (Tier-1 gap closed); pattern learning UI (Tier-3); audit log export (Tier-3); cost forecast based on historical averages (Tier-3).
**Avoids pitfalls:** Lost state and non-reproducibility (full replay from checkpoint); compliance gaps (structured queries over audit data, export for external compliance tools).
**Research flag:** Snapshot + incremental replay is a niche pattern — may benefit from brief research into Convex-specific snapshot storage patterns before implementation.

---

### Phase Ordering Rationale

- **Schema before engine:** The execution engine cannot be built without the tables it writes to. This is non-negotiable and matches the architecture's Phase A → Phase E dependency chain.
- **Budget enforcement in Phase 2, not Phase 4:** Every production post-mortem in the pitfalls research identifies cost controls added "after the first incident" as the highest-consequence mistake. Budget fields must exist before the first execution.
- **UI deferred to Phase 4:** The backend (Phases 1-3) must be testable independently of the UI. Building UI in parallel with engine logic creates coupling that makes debugging harder and slows TDD cycles.
- **Audit/Replay last:** The replay engine's value is proportional to the quantity of historical data. Building it in Phase 1 (when there is no data) wastes effort; building it in Phase 5 (after Phases 1-4 have generated real execution data) maximizes value.
- **Pattern learning deferred with replay:** Pattern learning UI requires `patternLearning.ts` (already built) to have accumulated data from real workflow runs. Phase 5 is the earliest it can deliver meaningful results.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Execution Engine):** Convex mutation execution time limits (10-second max) impose a constraint on how orchestration loops must be decomposed. The `@convex-dev/workflow` API for chaining steps needs to be verified against this constraint. Recommend a brief research spike on Convex action vs. mutation boundaries before detailed planning.
- **Phase 5 (Audit/Replay):** Snapshot-based replay in Convex has no off-the-shelf solution. The `workflow_snapshots` table pattern is custom; verify storage size implications at the expected event volume before committing to the schema.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Schema):** Convex schema migrations are well-documented with established patterns in the existing codebase (`convex/migrations.ts`).
- **Phase 2 (Workflow Definition):** DAG cycle detection with `graphlib` and `detectCycle()` is a solved problem; budget enforcement is a simple in-process comparison.
- **Phase 4 (Observability UI):** Convex `useQuery` reactive patterns are used throughout the existing codebase; no new patterns needed.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Research covers official documentation for all frameworks evaluated; `@convex-dev/workflow` and OpenLLMetry-JS are first-party or widely adopted libraries with verified TypeScript support. Mastra v1 beta maturity is the only uncertainty — correctly deferred. |
| Features | HIGH | Feature analysis benchmarked against 6 production systems (Temporal, Dagster, Prefect, Airflow, LangSmith, Helicone); existing codebase gaps accurately identified by cross-referencing schema and module files. |
| Architecture | HIGH | Architecture recommendations are grounded in Mission Control's existing patterns (Convex mutations, WebSocket gateway, event logging) and extend them consistently. Six-layer model is well-established in industry. Build order derives from hard dependency constraints, not preference. |
| Pitfalls | HIGH | Pitfalls sourced from 20+ post-mortems, academic research (Berkeley/MIT arXiv paper), and enterprise case studies. Quantitative claims (80% project failure rate, 340% cost overrun, 42% failure from implicit dependencies) are cited from named sources. |

**Overall confidence:** HIGH

### Gaps to Address

- **`@convex-dev/workflow` step boundary behavior:** The component's API for chaining steps across Convex's 10-second mutation limit is partially documented. Validate with a prototype before Phase 3 planning.
- **Streaming token counts for Anthropic API:** OpenLLMetry-JS may not capture token counts in streaming mode for all providers. A fallback estimator (chars/4 heuristic) should be designed in Phase 1 as a floor; validate during Phase 3 implementation.
- **`estimatedCostCents` per step accuracy:** The pre-dispatch budget check depends on workflow authors providing estimated step costs. For v1 with a known set of 10 agents, seed initial estimates from historical execution data. Document the calibration loop in the workflow builder.
- **Convex index performance at 90-day retention volume:** At the expected execution volume, verify that the `workflow_events` index by `workspaceId + timestamp` remains performant before the 90-day retention window fills. Plan a `pruneOldExecutions` cron as part of Phase 1 schema design.

---

## Sources

### Primary (HIGH confidence)
- [Convex Workflow Component](https://www.convex.dev/components/workflow) — durable execution, step chaining, retry semantics
- [OpenTelemetry GenAI Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — token instrumentation standards
- [OpenLLMetry-JS GitHub](https://github.com/traceloop/openllmetry-js) — TypeScript implementation, auto-instrumentation
- [Mastra AI Framework](https://mastra.ai/blog/announcing-mastra-improved-agent-orchestration-ai-sdk-v5-support) — TS-first framework evaluation; Elastic v2 license noted
- [Why Multi-Agent LLM Systems Fail (arXiv, Berkeley/MIT)](https://arxiv.org/html/2503.13657v1) — failure mode taxonomy, 42% implicit dependency stat
- [OWASP MCP Top 10 2025](https://owasp.org/www-project-mcp-top-10/2025/MCP02-2025%E2%80%93Privilege-Escalation-via-Scope-Creep) — privilege escalation patterns
- [Temporal TypeScript Workflows](https://medium.com/@sylvesterranjithfrancis/temporal-typescript-building-bulletproof-ai-agent-workflows-4863317144ce) — durable execution pattern reference

### Secondary (MEDIUM confidence)
- [Inngest Checkpointing](https://www.inngest.com/changelog/2025-12-10-checkpointing) — alternative workflow engine evaluation; rejected for v1 due to separate infrastructure
- [Langfuse Token and Cost Tracking](https://langfuse.com/docs/observability/features/token-and-cost-tracking) — LLM observability reference; deferred to v2
- [Helicone Cost Tracking](https://docs.helicone.ai/guides/cookbooks/cost-tracking) — LLM gateway evaluation; deferred to v2
- [Postgres + ClickHouse for Agentic AI Scale](https://thenewstack.io/postgres-clickhouse-the-oss-stack-to-handle-agentic-ai-scale/) — cold storage pattern for v2+ audit archives
- [AI Agent Cost Crisis](https://www.aicosts.ai/blog/ai-agent-cost-crisis-budget-disaster-prevention-guide/) — production cost overrun examples
- [Multi-Agent Workflows Often Fail (GitHub Blog)](https://github.blog/ai-and-ml/generative-ai/multi-agent-workflows-often-fail-heres-how-to-engineer-ones-that-dont/) — practical failure patterns

### Tertiary (contextual)
- [Forrester Agent Control Plane Market Evaluation](https://www.forrester.com/blogs/announcing-our-evaluation-of-the-agent-control-plane-market/) — market framing; control plane as emerging category
- [Agentic AI Systems Don't Fail Suddenly — They Drift (CIO)](https://www.cio.com/article/4134051/agentic-ai-systems-dont-fail-suddenly-they-drift-over-time.html) — policy drift patterns

---
*Research completed: 2026-02-25*
*Ready for roadmap: yes*
