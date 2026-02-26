# Feature Landscape

**Domain:** AI Agent Orchestration Platform with Multi-Workspace Governance
**Researched:** 2026-02-26
**Overall confidence:** MEDIUM-HIGH

## Table Stakes

Features users expect. Missing = product feels incomplete.

### 1. Workspace Isolation & Multi-Tenancy

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Workspace-scoped data boundaries | Every query MUST return only data belonging to the active workspace. Cross-workspace data leakage is a trust-destroyer. | Medium | Mission Control already has `workspaceId` on 25+ tables with indexes. The gap is **enforcement** -- no middleware/wrapper prevents a developer from forgetting the filter. |
| Workspace switcher in UI | Users managing multiple projects need instant context switching without page reloads. | Low | Current schema supports this (workspaces table with slug routing). UI needs a persistent switcher component. |
| Per-workspace settings | Each workspace needs independent configuration (task counter, notification preferences, alert thresholds). | Low | Already implemented via `settings` table with `by_workspace_key` index. |
| Cascade delete on workspace removal | Deleting a workspace must remove all 25+ scoped tables atomically. | Medium | Already implemented in `workspaces.remove()` with `batchDelete()`. Solid. |
| Workspace member management with RBAC | Users need owner/admin/member roles per workspace with clear permission boundaries. | Medium | Already implemented via `organizationMembers` table with `requireAdmin()`/`requireOwner()` helpers. Board-level access control exists too. |

**Current state:** Mission Control has the data model for workspace isolation but lacks **systematic enforcement** -- the `workspaceId` filter is applied manually in each query/mutation rather than through a wrapper that makes forgetting impossible.

### 2. Cost Governance & Token Tracking

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Per-execution token counting (input + output) | Without knowing how many tokens each execution consumed, cost attribution is impossible. This is the atomic unit of AI cost tracking. | Low | Already in schema: `executions` table has `inputTokens`, `outputTokens`, `costCents` fields. `calculateCost()` helper exists. |
| Per-agent cost aggregation | Operators need to see which agents are expensive. "Agent X costs $47/day" is the baseline insight. | Low | `metrics` table aggregates hourly by agent with `totalCostCents`, `avgCostCentsPerExecution`. `getCostBreakdown()` query exists. |
| Per-workspace budget limits | Without budget caps, a runaway agent can exhaust the entire AI budget. This is the #1 cost governance feature every platform needs. | Medium | **NOT YET IMPLEMENTED.** Schema has no `budgetCents` or `spendingLimitCents` field on workspaces. This is a critical gap. |
| Budget alerts (soft limits) | Before hitting a hard cap, operators need warning at 50%, 75%, 90% thresholds. | Medium | Alert rules exist (`alertRules` table) but no budget-specific condition type. Need to add `budgetThresholdExceeded` condition. |
| Cost attribution by model/provider | Different models have wildly different costs. Operators need to see "GPT-4 costs 10x more than GPT-3.5 for similar tasks." | Low | `executions` table has `model` and `modelProvider` fields. `metrics` aggregation does not break down by model -- needs extension. |
| Spending dashboard with time-series | Visual cost trends over days/weeks. "Are we spending more this week than last?" | Medium | `getCostBreakdown()` exists for daily view. Missing: weekly/monthly rollups, trend comparison. |

**Current state:** Token counting and cost calculation exist at the execution level. The critical missing piece is **budget enforcement** -- there is no mechanism to set spending limits per workspace, per agent, or per time period, and no automatic throttling when limits are approached.

### 3. Scheduled Execution (Cron)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Reliable cron job execution | Background tasks (auto-claim, heartbeat monitoring, escalation checks) must run on schedule without manual intervention. | Medium | Cron handlers exist (`autoClaimCronHandler`, `heartbeatMonitorCronHandler`, etc.) but **cron scheduling is currently disabled** due to a type compatibility issue with Convex's `SchedulableFunctionReference`. This is a blocking bug. |
| Circuit breaker pattern | Cron jobs that fail repeatedly should stop hammering the system. | Low | Already implemented with `CircuitBreaker` class (5 failures, 120s cooldown). |
| Retry with exponential backoff | Transient failures should auto-recover without operator intervention. | Low | Already implemented with `withRetry()` and `RETRY_CONFIGS` (STANDARD, FAST, CRITICAL, CRON profiles). |
| Per-workspace cron evaluation | Alert rules and cleanup tasks must iterate across all workspaces. | Low | Already implemented -- `alertEvaluatorCronHandler` and `presenceCleanupCronHandler` iterate over all workspaces. |
| Cron execution cost tracking | Cron-triggered executions need the same cost tracking as manual ones. | Medium | `createExecution()` accepts `triggerType: "cron"` but no cron-specific cost rollup exists. Operators cannot answer "how much do cron jobs cost per day?" |
| Idempotent cron handlers | Repeated execution of the same cron run must produce the same result. | Low | Current handlers are mostly idempotent (check-before-act pattern in auto-claim). Good. |

**Current state:** The cron infrastructure is well-designed with resilience patterns (circuit breaker, retry, graceful degradation) but **non-functional** because scheduling is disabled. Re-enabling cron registration is a prerequisite for everything else.

### 4. Agent Collaboration & Approval Flows

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Confidence-based approval gates | When an agent's confidence is below threshold, the action must pause for human review. This is THE governance feature for AI platforms. | Low | Already implemented: `approvalRequired()` checks confidence < 80.0, `isExternal`, `isRisky` flags. `createApproval()` creates pending approvals with `leadReasoning`. |
| Approval resolution workflow | Humans must be able to approve/reject pending actions with audit trail. | Low | Already implemented: `resolveApproval()` with status tracking, activity logging, and timestamp recording. |
| Conflict detection | A task should not have multiple pending approvals simultaneously. | Low | Already implemented: `createApproval()` checks for existing pending approvals per task via `approvalTaskLinks`. |
| Audit trail for all decisions | Every agent action, approval, and state change must be logged immutably. | Low | Partially implemented across `activities`, `decisions`, `events`, and `executionLog` tables. Multiple overlapping audit systems exist (see Pitfalls). |
| @mentions and notifications | Agents and humans need to tag each other for attention. Pending approvals need to surface as notifications. | Medium | `mentions` and `notifications` tables exist. `notifications.create()` is called by cron handlers. But no @mention resolution or notification routing based on workspace role exists. |
| Escalation for stale approvals | Approvals sitting pending for too long need automatic escalation. | Medium | `escalationCheckCronHandler` exists for blocked tasks (24h threshold) but **no equivalent for stale approvals**. An approval pending for hours with no response is a governance failure. |

**Current state:** The approval system is functional with confidence-based gating and conflict detection. The gap is in **lifecycle management** -- stale approvals are not escalated, and there is no dashboard showing approval velocity/bottlenecks.

---

## Differentiators

Features that set Mission Control apart from generic project management or basic agent frameworks.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Hierarchical budget controls** | Budget caps at org > workspace > agent > model level. "Agent Jarvis can spend $50/day on GPT-4 but unlimited on GPT-3.5." Most platforms only track at one level. | High | Requires new schema (budgetPolicy table), enforcement in execution creation, and real-time spend tracking. Modeled after Portkey/liteLLM hierarchical budget patterns. |
| **Workspace-scoped query wrapper** | A `withWorkspace(ctx, workspaceId)` wrapper that makes it impossible to query without workspace scoping. Eliminates an entire class of data leakage bugs. | Medium | Convex's function-level architecture makes this feasible. Wrap `ctx.db.query()` to auto-inject workspace filter. No equivalent exists in Convex ecosystem. |
| **Cost-aware workflow routing** | Workflows automatically route steps to cheaper models when budget is tight. "80% budget consumed -> downgrade non-critical steps from GPT-4 to GPT-3.5." | High | Requires integration between budget tracking, workflow engine, and model selection. Novel for self-hosted platforms. |
| **Approval velocity metrics** | Dashboard showing how fast approvals are resolved, bottleneck agents, and approval-to-action latency. "Average approval time: 23 minutes. Jarvis requests approval 3x more than other agents." | Medium | Data already exists in approvals table (createdAt, resolvedAt). Needs aggregation queries and UI. |
| **Real-time execution cost ticker** | Live-updating cost display during execution. "This workflow has consumed $2.34 so far." | Medium | Convex's real-time subscriptions make this natural. Update `costCents` on execution record mid-flight, UI auto-updates via `useQuery()`. |
| **Cross-workspace agent sharing** | Agents are shared across workspaces (current design) but with per-workspace performance metrics. "Agent X has 95% success in Workspace A but 72% in Workspace B." | Medium | Agents table is already workspace-agnostic. Needs per-workspace metric aggregation in `metrics` table (add workspaceId dimension). |
| **Decision replay and audit** | Replay any past decision: see what data the agent had, what confidence it computed, what the approval outcome was, and what happened after. Full causal chain. | High | Requires linking `executions` -> `approvals` -> `decisions` -> `activities` into a coherent timeline. Data exists across tables but is not connected for replay. |
| **Anomaly-triggered budget freeze** | If anomaly detection flags unusual spending patterns, automatically freeze the agent's budget until human review. | Medium | `anomalyDetection` module exists. Needs integration with budget enforcement layer. |

---

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Database-per-workspace isolation** | Mission Control targets 2-5 workspaces, not 10,000 tenants. Separate databases add operational complexity (migrations, backups, monitoring) for zero benefit at this scale. | Keep shared-schema with `workspaceId` column + application-level enforcement wrapper. |
| **Token-level rate limiting (per-second)** | Mission Control is an orchestration layer, not an LLM gateway. Per-second token rate limiting belongs in the LLM proxy (Portkey, liteLLM, API gateway). | Implement budget-level limits (per-day, per-month) and delegate request-level throttling to the LLM gateway. |
| **Real-time collaborative editing** | This is a governance platform, not Google Docs. Real-time co-editing of workflows or task descriptions adds enormous complexity. | Use optimistic locking (last-write-wins with conflict detection) which Convex handles naturally. |
| **Custom approval workflow builder** | A visual workflow builder for approval chains is scope creep. Mission Control's approval flow is confidence-threshold-based, not arbitrary multi-step routing. | Keep the single-gate approval model (confidence < threshold -> human review). Add escalation timers, not more gates. |
| **Multi-region data residency** | Data sovereignty requirements apply to enterprise SaaS with global customers. Mission Control is a team-internal tool. | Document which Convex region hosts data. Revisit only if enterprise customers explicitly require it. |
| **Agent-to-agent direct messaging** | Agents should communicate through the task/workflow system, not arbitrary chat. Direct messaging between agents creates untraceable side channels that break audit trails. | All agent communication goes through tasks, approvals, or workflow step outputs. Every interaction is logged. |

---

## Feature Dependencies

```
Workspace Enforcement Wrapper -> Per-Workspace Budget Limits
  (must scope data correctly before tracking costs per workspace)

Per-Execution Token Counting -> Per-Agent Cost Aggregation -> Per-Workspace Budget Limits
  (can't enforce budgets without accurate cost data flowing up)

Cron Re-enablement -> Alert Rule Evaluation -> Budget Alert Notifications
  (alerts don't fire if cron is broken)

Cron Re-enablement -> Stale Approval Escalation
  (escalation checks run on cron schedule)

Approval System -> Approval Velocity Metrics -> Approval Dashboard
  (metrics require functional approval lifecycle)

Workflow Engine (Phase 10) -> Cost-Aware Workflow Routing
  (needs workflow step model before routing decisions)

Anomaly Detection -> Anomaly-Triggered Budget Freeze
  (anomaly module must be integrated with budget enforcement)
```

**Critical path:** Cron re-enablement unblocks alert evaluation, escalation, and budget enforcement. It should be the first thing fixed.

---

## MVP Recommendation

### Must build first (blocks everything else):

1. **Re-enable cron scheduling** -- Fix the `SchedulableFunctionReference` type issue. Without working cron, alert evaluation, escalation, heartbeat monitoring, and presence cleanup are all dead. This is a P0 bug, not a feature.

2. **Workspace-scoped query enforcement wrapper** -- Create `withWorkspace(ctx, workspaceId)` that wraps `ctx.db` to auto-filter by workspace. Apply to all existing queries/mutations. This eliminates the largest class of potential data isolation bugs.

3. **Per-workspace budget limits** -- Add `budgetCents`, `budgetPeriod` (daily/weekly/monthly), and `currentSpendCents` fields to workspace or a new `budgetPolicy` table. Enforce in `createExecution()` -- reject execution if budget exceeded.

4. **Budget threshold alerts** -- Add `budgetThresholdExceeded` condition to `alertRules`. Trigger at 50%, 75%, 90% of budget. Requires working cron (see #1).

5. **Stale approval escalation** -- Add cron job checking for approvals pending > N hours. Notify workspace admins. Prevents governance deadlocks where an agent is blocked waiting for approval that nobody noticed.

### Defer:

- **Hierarchical budget controls (org > workspace > agent > model):** Build single-level workspace budgets first. Hierarchical budgets are a v2 feature after validating the basic model.
- **Cost-aware workflow routing:** Requires completed workflow engine (Phase 10) plus budget system. This is a Phase 12+ feature.
- **Decision replay:** High complexity, low urgency. The audit data is being captured already -- the replay UI can come later.
- **Cross-workspace agent metrics:** Agents currently work across workspaces. Per-workspace breakdown is useful but not blocking. Add `workspaceId` to metrics aggregation when the dashboard is built.

---

## Patterns from the Industry

### What leading platforms do that Mission Control should adopt:

**1. Centralized AI Gateway Pattern (Portkey, liteLLM)**
Every LLM request passes through a single gateway that logs tokens, cost, latency, and metadata. Mission Control's `createExecution()` / `updateExecutionStatus()` serve this role for the orchestration layer. The gap is connecting this to actual LLM API calls (the gateway integration in `src/app/api/gateway/`).

**Confidence:** HIGH -- This pattern is universal across Portkey, TrueFoundry, Langfuse, and every serious AI observability platform.

**2. Showback Before Chargeback**
Start by showing teams their costs (showback) before enforcing limits (chargeback). This builds trust in the cost data before it becomes punitive. Mission Control should implement the cost dashboard and let users validate accuracy for 2-4 weeks before enabling hard budget enforcement.

**Confidence:** HIGH -- Recommended by Drivetrain, Mavvrik, and every FinOps practitioner.

**3. Confidence-Based Escalation Tiers**
- Low risk + high confidence (>80): auto-execute
- Medium risk or medium confidence (60-80): request approval
- High risk or low confidence (<60): block and route to owner

Mission Control's `CONFIDENCE_THRESHOLD = 80.0` is a single threshold. The pattern should evolve to support tiered thresholds based on action risk level.

**Confidence:** MEDIUM -- Pattern is well-documented (Galileo, Zapier HITL guides) but the specific thresholds need calibration per deployment.

**4. Immutable Audit Ledger**
Mission Control has FOUR overlapping audit systems: `activities`, `decisions`, `events`, and `executionLog`. Industry best practice is a single append-only event stream (like `events`) with derived views, not four separate tables with different schemas. This should be consolidated.

**Confidence:** HIGH -- Every enterprise AI governance framework (ISACA, Deloitte, Galileo) emphasizes a single source of truth for audit trails.

---

## Sources

- [WorkOS Multi-Tenant Architecture Guide](https://workos.com/blog/developers-guide-saas-multi-tenant-architecture)
- [Convex Row Level Security Patterns](https://stack.convex.dev/row-level-security)
- [Convex Community: Multi-tenant Product Discussion](https://discord-questions.convex.dev/m/1471574111246356491)
- [Portkey: Budget Limits and Alerts in LLM Apps](https://portkey.ai/blog/budget-limits-and-alerts-in-llm-apps/)
- [Portkey: Tracking LLM Token Usage](https://portkey.ai/blog/tracking-llm-token-usage-across-providers-teams-and-workloads/)
- [liteLLM: Budgets and Rate Limits](https://docs.litellm.ai/docs/proxy/users)
- [Hierarchical Budget Controls for Multi-Tenant LLM Gateways](https://dev.to/pranay_batta/building-hierarchical-budget-controls-for-multi-tenant-llm-gateways-ceo)
- [Statsig: Token Usage Tracking](https://www.statsig.com/perspectives/tokenusagetrackingcontrollingaicosts)
- [TrueFoundry: LLM Cost Tracking Solution](https://www.truefoundry.com/blog/llm-cost-tracking-solution)
- [Mavvrik: AI Cost Governance Report 2025](https://www.mavvrik.ai/ai-cost-governance-report/)
- [Galileo: Human-in-the-Loop Agent Oversight](https://galileo.ai/blog/human-in-the-loop-agent-oversight)
- [Zapier: Human-in-the-Loop Patterns](https://zapier.com/blog/human-in-the-loop/)
- [Galileo: AI Agent Compliance & Governance 2025](https://galileo.ai/blog/ai-agent-compliance-governance-audit-trails-risk-management)
- [ISACA: The Growing Challenge of Auditing Agentic AI](https://www.isaca.org/resources/news-and-trends/industry-news/2025/the-growing-challenge-of-auditing-agentic-ai)
- [AWS: SaaS Tenant Isolation Strategies](https://docs.aws.amazon.com/whitepapers/latest/saas-architecture-fundamentals/tenant-isolation.html)
- [LangGraph vs AutoGen vs CrewAI Comparison](https://latenode.com/blog/platform-comparisons-alternatives/automation-platform-comparisons/langgraph-vs-autogen-vs-crewai-complete-ai-agent-framework-comparison-architecture-analysis-2025)
- [Better Stack: Cron Job Monitoring Tools 2026](https://betterstack.com/community/comparisons/cronjob-monitoring-tools/)
