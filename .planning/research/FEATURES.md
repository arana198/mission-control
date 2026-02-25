# Control Plane Features for Multi-Agent Systems

Research Date: 2026-02-25
Scope: Production-readiness feature analysis for Mission Control v1 (supervised execution)
Reference Systems: Temporal, Dagster, Prefect, Airflow, LangChain, AutoGen, CrewAI, AWS Step Functions

---

## Context

Mission Control is a control plane for orchestrating autonomous specialist agents. V1 focuses on supervised execution: humans trigger workflows, agents execute, Mission Control governs. The existing codebase already has foundations for agents, tasks, epics, executions, approvals, anomaly detection, decisions, alert rules, pattern learning, and WebSocket gateways.

---

## 1. Table Stakes (Must-Haves)

These are the features users expect from any workflow orchestration or agent control system. Absence of any of these is a hard blocker for adoption.

### 1.1 Workflow Definition and Composition

**What it is:** The ability to define sequences and graphs of agent work, not just individual tasks.

**Why it's table stakes:** Without workflow primitives, every operator must manually sequence tasks. Operators adopt control planes specifically to express "do A, then B and C in parallel, then D." This is the foundational abstraction that all other features build on.

**Current MC state:** Epics partially serve this role (grouping tasks under a strategic initiative), but there is no workflow pipeline abstraction (ordered steps with branching, parallel lanes, conditional logic). The `graphValidation.ts` utility shows dependency-graph awareness exists but is not surfaced as a composable workflow primitive.

**Comparable systems:**
- Temporal: defines workflows as durable, resumable code functions. Each workflow step is a "activity" with independent retry logic.
- Dagster: defines workflows as "jobs" composed of "ops" (operations). DAGs are first-class, visually rendered.
- Prefect: defines workflows as Python-decorated functions with `@flow` and `@task`. Supports subflows.
- Airflow: DAGs defined in code; every DAG is a directed acyclic graph of operators.

**Implementation complexity:** Medium. Core data model additions: `workflows` table (name, steps, version), `workflowRuns` table (execution instance). DAG validation already exists in `graphValidation.ts`. The main work is the workflow builder UI and the step-dispatch engine.

**Dependencies:** Agent registry, task execution engine (both already exist).

---

### 1.2 Execution Triggering

**What it is:** The ability for an operator to start a workflow run with specified inputs.

**Why it's table stakes:** Control planes with no trigger mechanism cannot be invoked. V1 is supervised, so manual triggering from UI is the entire UX.

**Current MC state:** Tasks can be created and assigned, but there is no "trigger this whole workflow from the UI in one action" capability. The `executions.ts` module exists for logging, not triggering.

**Comparable systems:**
- Prefect: UI has a "Run" button per flow deployment. API allows parameterized runs.
- Dagster: "Launchpad" UI allows triggering jobs with configuration overrides.
- Temporal: workflows are triggered by calling `client.start(workflowFunction, options)`.

**Implementation complexity:** Low-Medium. Needs: a "trigger workflow" API endpoint, parameter input form in UI, and a dispatch function that creates a `workflowRun` record and begins spawning tasks in order.

**Dependencies:** Workflow definition (1.1).

---

### 1.3 Execution Status and Basic Monitoring

**What it is:** Real-time visibility into whether a workflow is running, which step it's on, which agents are active, and whether any failures have occurred.

**Why it's table stakes:** Without status visibility, operators cannot know if their trigger worked. Status monitoring is the minimum viable "cockpit."

**Current MC state:** Agent status (`idle`/`active`/`blocked`), task status, and OpsMetrics snapshot queries exist. The `opsMetrics.ts` query calculates live queue depth, blocked task count, overdue tasks, and completion rate. The WebSocket gateway provides real-time updates. This is already largely built.

**Comparable systems:**
- Prefect: Flow run detail page shows each task's state (pending, running, completed, failed) with timestamps.
- Dagster: Run timeline shows each op's execution with duration bars.
- Temporal: Workflow history viewer shows all events in a run.

**Implementation complexity:** Low. The data already exists; the gap is UI composition into a single "workflow run" view rather than scattered agent/task views.

**Dependencies:** Execution triggering (1.2).

---

### 1.4 Error Visibility and Basic Failure Handling

**What it is:** When an agent or step fails, the operator must be able to see what failed, why, and what the impact is.

**Why it's table stakes:** Agents fail. Without error visibility, the operator is flying blind. A control plane that hides failures is worse than no control plane.

**Current MC state:** `executions.ts` stores `status: failed` and an `error` field. `anomalyDetection.ts` detects duration deviations and error rate spikes. `alertRules.ts` defines conditions including `agentCrash`. The infrastructure exists; surfacing it clearly in a failure-focused UI view is the gap.

**Comparable systems:**
- Airflow: Task instance log viewer shows full stdout/stderr on failure.
- Prefect: Failed flow runs are highlighted in red with expandable error messages and stack traces.
- Temporal: Workflow history shows the exact event and error that caused a failure, with full stack trace.

**Implementation complexity:** Low. Data model is already capturing errors. Needs: a "failures" filter view, error detail panel, and propagation logic to mark upstream workflow run as failed when a step fails.

**Dependencies:** Execution logging (already exists).

---

### 1.5 Agent Registry and Capability Model

**What it is:** A catalog of available agents, their roles, capabilities, and current availability status.

**Why it's table stakes:** The control plane must know what agents exist and what they can do before it can route work to them. Without this, workflow step → agent mapping is arbitrary.

**Current MC state:** The `agents` table stores name, role, status, sessionKey, and lastHeartbeat. `skillInference.ts` infers agent skills from task history. This is well-developed.

**Comparable systems:**
- CrewAI: Agents are defined with explicit role, goal, and backstory. Crews (workflows) reference specific agents.
- AutoGen: Agents are instantiated with defined capabilities. The orchestrator knows which agent handles which step.
- LangChain: Agents are given tools; the tool registry defines what the agent can do.

**Implementation complexity:** Already built. The gap is connecting skill inference results to workflow step routing.

**Dependencies:** None. This is a prerequisite, not a dependent.

---

### 1.6 Audit Log and Execution History

**What it is:** A queryable, immutable record of all actions taken by the system—what ran, when, why, what it decided, and what it produced.

**Why it's table stakes:** For debugging and compliance, you must be able to answer "what happened and why." An audit log is foundational for trust. It cannot be retrofitted; it must be built from day one.

**Current MC state:** `decisions.ts`, `executionLog.ts`, `activities.ts` all contribute to audit trails. The `executions` table captures per-execution records with model, tokens, cost, and status. The `decisions` table captures management decisions (escalations, reassignments). This is substantially complete as a data model.

**Comparable systems:**
- Temporal: The "workflow history" is immutable and is the source of truth for replays. Every event is recorded.
- Dagster: "Run logs" include asset materializations, op outputs, and error traces. Searchable and filterable.
- AWS Step Functions: Execution history records every state transition with full input/output.

**Implementation complexity:** Low. Data exists. Needs: a unified audit log viewer in UI with search, filter by agent/workflow/time range, and export capability.

**Dependencies:** None; data exists. UI work only.

---

### 1.7 Human-in-the-Loop Approval Gates

**What it is:** The ability to pause a workflow at a defined checkpoint and require human approval before proceeding.

**Why it's table stakes for supervised execution:** V1 is explicitly "supervised execution." If the control plane cannot pause and wait for approval, it is not supervised—it's just automated. Approval gates are the core governance primitive of v1.

**Current MC state:** `approvals.ts` already implements confidence-based approval gates. `CONFIDENCE_THRESHOLD = 80.0`; below that threshold (or if external/risky), approval is required. This is well-developed at the backend level.

**Comparable systems:**
- Temporal: "Human signals" pattern—workflow waits on an external signal before continuing.
- Prefect: "Pausing" a flow run and waiting for a `resume()` call. Supports input injection on resume.
- LangChain: `HumanApprovalCallbackHandler` intercepts tool calls and prompts for human approval.

**Implementation complexity:** Low (backend exists). Medium (UI approval queue, notification on pending approvals, approve/reject actions).

**Dependencies:** Audit log (for recording the approval decision), notification system.

---

## 2. Differentiators (Advanced Capabilities)

These features separate premium control planes from basic orchestrators. They create compounding value over time and are not expected on day one but become decisive for retention and enterprise adoption.

### 2.1 Economic Awareness: Token and Cost Tracking

**What it is:** Real-time tracking of token consumption and dollar cost per agent, per workflow run, per model, and cumulatively per workspace.

**Why it's a differentiator:** Most workflow orchestrators (Airflow, Dagster, Prefect) are agnostic to compute cost. AI-native control planes must treat tokenomics as a first-class concern because model API calls are the primary operational cost driver. Visibility into cost per decision is how operators justify autonomy to finance teams.

**Current MC state:** `executions.ts` has `calculateCost()` using model pricing from settings. Token fields (`inputTokens`, `outputTokens`, `totalTokens`, `costCents`) exist in the `executions` table. This is the right foundation; the gap is aggregated cost dashboards and cost-per-workflow breakdowns.

**Comparable systems:**
- Weights & Biases (Weave): tracks LLM call costs per trace and project.
- LangSmith: cost per run, per dataset evaluation, with time-series trends.
- Helicone: LLM observability with cost-per-token and user-level cost attribution.
- No traditional workflow orchestrator (Airflow, Prefect) has this at all.

**Implementation complexity:** Low-Medium. Backend calculation exists. Needs: aggregation queries (cost by agent, cost by workflow, cost by time period), a cost dashboard UI, and budget threshold checks during execution.

**Dependencies:** Execution logging with cost fields (already exists).

---

### 2.2 Budget Enforcement and Guardrails

**What it is:** The ability to set spending limits per workflow, per agent, or per time period, and automatically halt execution when those limits are breached.

**Why it's a differentiator:** This is the "circuit breaker" for runaway autonomy. Without budget enforcement, a misconfigured agent can incur unbounded spend. This is the governance lever that makes enterprises comfortable deploying autonomous agents.

**Current MC state:** The `PROJECT.md` lists budget enforcement as a core active requirement. The schema and execution tracking provide the data needed. No enforcement logic exists yet.

**Comparable systems:**
- AWS Step Functions: supports Express Workflows with execution quotas.
- Temporal: no built-in cost enforcement; developers implement it in application logic.
- No standard workflow orchestrator has this; it is specific to AI-native control planes.
- OpenAI API: has organization-level spend limits but no workflow-level granularity.

**Implementation complexity:** Medium. Needs: a budget configuration model (per-workflow or per-workspace limits in cents), a check function called before each agent invocation, and a halt-and-notify mechanism when budget is exceeded.

**Dependencies:** Cost tracking (2.1), Alert rules (already exists in `alertRules.ts`), approval gates (1.7 for budget-exceeded approval flows).

---

### 2.3 Deep Observability: Live Agent I/O Streaming

**What it is:** The ability to see what an agent is "thinking"—its input prompts, output responses, tool calls, and intermediate reasoning—as the execution unfolds, not just after completion.

**Why it's a differentiator:** Basic monitoring tells you what happened. Deep observability tells you why. Operators debugging a failed workflow need to see the actual prompts and responses that led to a wrong decision. This is the difference between "the agent failed" and "the agent failed because it misinterpreted the task description."

**Current MC state:** The WebSocket gateway (`gateways.ts`, gateway route handlers) provides real-time bidirectional communication. The session and message history system exists. The connection pool for live streaming exists. The gap is surfacing agent I/O in a dedicated "live trace" view during execution.

**Comparable systems:**
- LangSmith: full trace viewer with every LLM call, prompt, response, and tool use rendered as a tree.
- Weave (W&B): "traces" show the call tree for multi-step agent execution.
- Helicone: per-request logging of prompt + completion with latency and cost.
- Langfuse: open-source LLM observability with trace UI.

**Implementation complexity:** High. Requires: a structured trace format, a streaming event emitter from the agent runtime, a trace store in Convex, and a live trace viewer UI. The gateway infrastructure is in place; the agent-side instrumentation and MC-side trace rendering are the gaps.

**Dependencies:** WebSocket gateway (exists), execution logging (exists), agent protocol agreement on trace event schema.

---

### 2.4 Pattern Learning and Workflow Optimization Suggestions

**What it is:** Analyzing historical execution data to identify which workflow patterns succeed, which agents perform best on which task types, and surfacing suggestions for workflow configuration.

**Why it's a differentiator:** This turns the control plane into a continuously learning system. It shifts from "governance tool" to "strategic intelligence layer." Over time, MC can answer "based on 50 prior research epics, this workflow pattern has a 94% success rate."

**Current MC state:** `patternLearning.ts` is already implemented. It detects recurring task sequences, tracks success rates per pattern, and stores `taskPatterns` with `occurrences`, `successRate`, and `avgDurationDays`. This is a genuine differentiator that is already built at the backend level.

**Comparable systems:**
- Dagster: "Asset health" and historical materialization graphs, but no pattern learning.
- Prefect: No built-in pattern analysis.
- This is rare even in mature workflow orchestrators; it is a distinct competitive capability.

**Implementation complexity:** Low (backend done). Medium (UI to surface pattern suggestions in workflow builder).

**Dependencies:** Pattern data accumulates with usage; minimum viable insight requires ~10 completed workflow runs of similar type.

---

### 2.5 Anomaly Detection and Proactive Alerting

**What it is:** Automatically detecting when agent behavior deviates from baseline (duration spikes, error rate increases, skill-task mismatches) and alerting operators before problems compound.

**Why it's a differentiator:** Reactive monitoring requires operators to notice problems. Proactive anomaly detection surfaces problems before the operator is watching. This is the difference between a dashboard and an intelligent watchdog.

**Current MC state:** `anomalyDetection.ts` implements statistical deviation detection (2-sigma and 3-sigma thresholds) for duration, error rates, skill mismatches, and status instability. `alertRules.ts` supports configurable alert conditions with Slack/email/in-app channels. This is substantively implemented.

**Comparable systems:**
- Datadog APM: baseline-relative anomaly detection for latency and error rates.
- PagerDuty: threshold-based alerts with escalation policies.
- No standard workflow orchestrator has AI-specific anomaly detection (skill mismatch, confidence drops).

**Implementation complexity:** Low (mostly built). Needs: wire anomaly detections to alert rule evaluations, and complete the notification delivery pipeline.

**Dependencies:** Alert rules (exists), notification system (`notifications.ts` exists), anomaly detection (exists).

---

### 2.6 Workflow Versioning and Rollback

**What it is:** Tracking multiple versions of a workflow definition, with the ability to run a specific version and roll back to a previous version if a new version causes regressions.

**Why it's a differentiator:** Production systems evolve. When a workflow change causes failures, operators need to pin workflow runs to a known-good version. Without versioning, every workflow change is a risky, irreversible migration.

**Current MC state:** No workflow versioning exists. The `PROJECT.md` lists this as a desired capability. Epics have no version field.

**Comparable systems:**
- Temporal: workflows are versioned using `workflow.getVersion()` API; old executions can continue on old versions while new executions use new versions.
- Dagster: code locations are versioned; historical runs reference the code version they ran against.
- Prefect: deployments are versioned; each deployment has a version tag.

**Implementation complexity:** Medium-High. Requires: version field on workflow definitions, immutable "version snapshots" on workflow run creation, and UI to select version at trigger time.

**Dependencies:** Workflow definition (1.1).

---

## 3. Critical for Production (Governance, Auditability, Compliance)

These features are not optional for enterprise adoption. They address the question: "Can we trust this system with real business operations?"

### 3.1 Immutable Audit Trail

**What it is:** A tamper-proof, append-only log of every action taken by every agent, every decision made, and every state transition, with full context (who triggered it, what parameters, what output, what cost).

**Why it's critical:** Enterprises operating in regulated industries (finance, healthcare, legal) require demonstrable audit trails. Without immutability, audit logs can be altered or deleted, removing their compliance value. Trust in autonomous systems depends on the ability to reconstruct "what happened and why" for any historical execution.

**Current MC state:** Convex's append-only database model provides natural immutability—records can be patched but not hard-deleted without explicit delete mutations. `decisions.ts` captures management decisions. `activities.ts` captures agent activity. `executions.ts` captures execution records. The gap is enforcing an explicit "no-delete" policy on audit records and providing a unified audit log query interface.

**Implementation considerations:**
- Explicitly mark audit tables as append-only in schema comments and code review policy.
- Add a `retentionPolicy` marker: audit records should never be garbage-collected.
- Export capability (JSON, CSV) for external compliance tools.
- 90-day minimum retention (per `PROJECT.md` constraint).

**Comparable systems:**
- Temporal: workflow history is immutable by design; the event stream cannot be altered.
- AWS Step Functions: execution history is stored for 90 days and cannot be modified.
- Dagster: run log is append-only; you can archive but not alter.

**Implementation complexity:** Low (data model mostly exists). Medium (export API, retention policy enforcement, UI audit log viewer with search/filter).

---

### 3.2 Decision Traceability (Explainability)

**What it is:** For every significant action the system takes (agent reassignment, task escalation, workflow halt), recording the specific rule or signal that triggered it and the confidence level at time of decision.

**Why it's critical:** When an autonomous system makes a consequential decision—"I reassigned this task from Agent A to Agent B"—a human must be able to audit why. Explainability is not just a nice-to-have; it is the legal and operational basis for trusting autonomous decisions.

**Current MC state:** `decisions.ts` is purpose-built for this. It records `action`, `reason`, `ruleId` (linking back to the alert rule that triggered it), `decidedBy`, and `result`. This is the right model.

**Gap:** The decisions system needs to be linked to workflow run context so an operator can trace: "This workflow run triggered this task, which triggered this alert rule, which caused this decision."

**Implementation complexity:** Low (data model exists). Medium (building the "decision trace" view that stitches workflow run → task → alert → decision into a single explanatory narrative).

---

### 3.3 Access Control and Operator Identity

**What it is:** Knowing who triggered what, enforcing that only authorized operators can trigger high-risk actions (budget increases, agent provisioning, workflow definition changes), and logging operator identity in all audit records.

**Why it's critical:** Without identity, audit logs cannot assign accountability. "The system did X" is not the same as "Operator @ankit triggered X at 14:32 with parameters Y." Accountability requires identity.

**Current MC state:** `organizationMembers.ts` and `invites.ts` exist, suggesting multi-user awareness. `workspaces.ts` supports multi-tenant workspaces. However, most mutations do not currently capture `operatorId` in their audit records.

**V1 scope:** Single-user v1 defers full RBAC but should still capture the principle of operator identity in audit records from day one. Retrofitting identity into audit records after the fact is painful.

**Implementation complexity:** Medium. Requires: adding `operatorId` or `triggeredBy` field to execution records, approval records, and decisions. Low enforcement overhead in single-user v1; critical infrastructure for multi-user v2.

---

### 3.4 Graceful Halting and Rollback

**What it is:** The ability to stop a running workflow at any point—immediately or after current steps complete—and to return the system to a known-good state after a failure.

**Why it's critical:** Autonomous agents can cause real side effects (API calls, database mutations, external communications). When something goes wrong, operators must be able to stop the bleeding immediately. Without a halt mechanism, a runaway workflow can compound failures.

**Current MC state:** Task status can be updated to `blocked`. The `aborted` status exists in the execution model. The gap is: no explicit "halt this workflow run" action that propagates cancellation to all in-flight agent tasks within the run.

**Comparable systems:**
- Temporal: `client.cancel(workflowId)` sends a cancellation signal that propagates to all activities.
- Prefect: `flow_run.cancel()` transitions the run and all tasks to `CANCELLED` state.
- Dagster: "Terminate" action in UI sends SIGTERM to the run process.

**Implementation complexity:** Medium. Requires: a `workflowRuns` table with a `halt` mutation that cascades status updates to all associated in-flight tasks and notifies connected agents via gateway.

**Dependencies:** Workflow definition (1.1), WebSocket gateway (exists).

---

### 3.5 Rate Limiting and Abuse Prevention

**What it is:** Preventing any single agent, workflow, or operator from consuming disproportionate resources or making API calls at dangerous rates.

**Why it's critical:** Without rate limits, a misconfigured workflow can DDoS the system or incur runaway API costs. Rate limiting is the last line of defense before budget enforcement.

**Current MC state:** `rateLimit.ts` implements token-bucket rate limiting. The heartbeat mutation is rate-limited (6/minute per agent). The infrastructure exists but is not applied to the higher-risk operations (workflow triggers, agent invocations).

**Implementation complexity:** Low (infrastructure exists). Medium (applying rate limits to workflow trigger, agent task creation, and external API calls).

---

## 4. Anti-Features (What NOT to Build)

These are capabilities that sound valuable but will waste engineering time, create complexity, and distract from the core mission in v1.

### 4.1 Do NOT Build: Autonomous Scheduling (v1)

**What it is:** The system autonomously triggers workflows based on time, events, or AI-driven schedules without human initiation.

**Why not:** V1 is explicitly supervised. Autonomous scheduling requires much higher confidence in the governance model. Build and prove supervision first; earn autonomy.

**What to do instead:** Provide a clear trigger API that can be called by external schedulers (cron, webhooks) in v2. Keep the v1 trigger surface simple and human-initiated.

---

### 4.2 Do NOT Build: Multi-Stage Conditional Approval Workflows (v1)

**What it is:** Approval gates with branching logic ("if Team A approves, go to step 2; if Team B approves, go to step 3").

**Why not:** Simple approve/reject is enough for v1. Conditional approval trees are complex to define, test, and reason about. They also require multi-user RBAC to be meaningful.

**What to do instead:** Binary approve/reject with optional "reason" text. Multi-stage approvals are a v2 enterprise feature.

---

### 4.3 Do NOT Build: ML-Driven Predictive Cost Forecasting (v1)

**What it is:** Predicting future token spend based on historical trends using a machine learning model.

**Why not:** The data required to train meaningful predictions does not exist in v1. Premature ML adds complexity without value. Historical averages and current-run projections are sufficient.

**What to do instead:** Simple average-cost-per-run extrapolation based on historical execution records. Ship the data infrastructure; forecasting is a product layer on top.

---

### 4.4 Do NOT Build: Custom Agent Types and Plugin Architecture (v1)

**What it is:** An extensible plugin system allowing third parties to define new agent roles, capabilities, or execution backends.

**Why not:** Premature abstraction. The existing agent model (10 specialist agents with defined roles) is the right scope for v1. A plugin architecture requires designing stable API contracts that Mission Control cannot yet know the right shape of.

**What to do instead:** Integrate deeply with the existing 10-agent model. Document the integration contract. Design for extensibility in v2 once the v1 contracts are proven.

---

### 4.5 Do NOT Build: Full Multi-Tenant RBAC (v1)

**What it is:** Role-based access control with per-user permissions, team-based access policies, and resource-level authorization.

**Why not:** V1 is single-user (per `PROJECT.md` constraints). Building RBAC before multi-user is needed adds complexity with no near-term value.

**What to do instead:** Capture `operatorId` in audit records from day one (low cost, high future value). Defer permission enforcement until multi-user v2.

---

### 4.6 Do NOT Build: Real-Time Push Notifications (v1)

**What it is:** WebSocket or SSE push notifications to operator browsers/mobile devices when events occur.

**Why not:** The in-app dashboard with polling or Convex's reactive queries already provides live updates. Push notifications require additional infrastructure (WebPush, APNs, FCM) and are out of scope per `PROJECT.md`.

**What to do instead:** Leverage Convex's real-time reactive queries for in-app live updates. Slack/email channel notifications are already supported in `alertRules.ts` for critical alerts.

---

## 5. V1 MVP Scope

The minimum feature set that delivers genuine control plane value while remaining buildable in a single sprint cycle.

### Priority Tier 1 (Launch Blockers — must have at launch)

| Feature | Current State | Gap | Effort |
|---------|--------------|-----|--------|
| Workflow definition model (DAG + steps) | Partial (epics/tasks) | Explicit workflow table, step ordering, version field | Medium (1-2 sprints) |
| Manual workflow trigger from UI | None | Trigger API + parameter form + workflow run record | Medium (1 sprint) |
| Workflow run status view | Scattered (agents + tasks views) | Unified workflow run view showing all steps + agents | Low (1 sprint) |
| Approval queue with approve/reject | Backend done | Approval queue UI, pending indicator, notification | Low (1 sprint) |
| Audit log viewer | Data exists | Search/filter UI over decisions + activities + executions | Low (1 sprint) |
| Cost tracking per run | Backend done | Aggregated cost query + cost summary in UI | Low (0.5 sprint) |

### Priority Tier 2 (High Value, Ship Within First Month)

| Feature | Current State | Gap | Effort |
|---------|--------------|-----|--------|
| Budget enforcement (halt on limit) | None | Budget config + pre-invocation check + halt mutation | Medium (1 sprint) |
| Failure detail view | Basic error field | Failure-focused UI with error + context + affected steps | Low (0.5 sprint) |
| Workflow halt (emergency stop) | None | Halt mutation cascading to tasks + agent notification | Medium (1 sprint) |
| Alert rule evaluation wired to anomaly detection | Partially built | Connect anomaly detection → alert rule eval → notification | Low (1 sprint) |
| Operator identity in audit records | None | Add triggeredBy field to key mutations | Low (0.5 sprint) |

### Priority Tier 3 (Differentiators, Post-Launch)

| Feature | Current State | Gap | Effort |
|---------|--------------|-----|--------|
| Live agent I/O trace viewer | Gateway exists | Trace event schema + trace store + live trace UI | High (2-3 sprints) |
| Pattern learning UI | Backend done | Surface pattern suggestions in workflow builder | Medium (1 sprint) |
| Workflow versioning | None | Version field + snapshot on run + version selector UI | Medium (1-2 sprints) |
| Cost forecast (average-based) | None | Historical avg cost query + "estimated cost" on trigger | Low (0.5 sprint) |
| Audit log export (CSV/JSON) | Data exists | Export API endpoint + download UI | Low (0.5 sprint) |

---

## 6. Feature Dependencies Map

```
Agent Registry (exists)
    └── Workflow Definition → Workflow Trigger → Workflow Run Status
                                              └── Budget Enforcement
                                              └── Workflow Halt
                                              └── Approval Gates (exists)

Execution Logging (exists)
    └── Cost Tracking → Cost Dashboard → Budget Enforcement
    └── Audit Log Viewer
    └── Decision Traceability

Anomaly Detection (exists)
    └── Alert Rules (exists) → Alert Notifications → Operator Identity in Alerts

WebSocket Gateway (exists)
    └── Real-time Status Updates
    └── Live Agent I/O (post-v1)

Pattern Learning (exists)
    └── Pattern Suggestions UI (post-v1)
```

---

## 7. What Successful Control Planes Do Differently

Synthesis from Temporal, Dagster, Prefect, and AI-native orchestrators:

**Temporal's key insight:** Treat workflow state as durable code. Failures are recoverable because the workflow history is the source of truth. Replay means re-running from the last good state, not from scratch. Mission Control analog: execution log as replay source, not just debugging data.

**Dagster's key insight:** Assets (outputs) are first-class, not just tasks. The question is not "did the task run?" but "is the asset fresh?" Mission Control analog: decision outputs and agent artifacts could be tracked as versioned assets, not just logged events.

**Prefect's key insight:** Make observability the product, not an afterthought. The Prefect UI is centered on "what's happening right now" before workflow definition. Mission Control analog: the execution dashboard should be the entry point, not the workflow builder.

**LangSmith/Langfuse's key insight:** LLM-specific observability (traces, prompts, responses) requires a fundamentally different data model than traditional task orchestration. Token counts, model names, prompt versions, and inference latency are first-class fields. Mission Control already has these fields in `executions`—the gap is the UI.

**The common pattern:** All successful control planes treat the audit trail as the product's foundational value proposition. Every other feature (monitoring, replays, optimization) is built on top of the audit log. Mission Control's `decisions.ts` + `executionLog.ts` + `activities.ts` is the right foundation; the investment must now go into making that data queryable and explorable.

---

*Last updated: 2026-02-25*
