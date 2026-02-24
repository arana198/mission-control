# Mission Control Codebase Mapping
## Vision → Current Implementation

**Date**: Feb 24, 2026
**Status**: Phase 1 foundation in place, Phase 2-3 gaps identified

---

## 1️⃣ CORE CAPABILITIES MAPPING

### A. Agent Management
**Vision**: Register, start/stop, restart, scale agents, view status, track heartbeat

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| Agent Registry | ✅ **95%** | `convex/agents.ts` | Query: `getAllAgents`, mutations for CRUD |
| Agent Status | ✅ **90%** | `convex/schema.ts:line 35` | Status enum: idle/active/blocked |
| Last Heartbeat | ✅ **Done** | `convex/schema.ts:line 42` | `lastHeartbeat: number` |
| Runtime Version | ✅ **Done** | `convex/schema.ts:line 65` | `version: optional(string)` |
| Runtime Location | ✅ **Done** | `convex/schema.ts:line 64` | `runtimeLocation: optional(string)` |
| Horizontal Scaling | ✅ **Done** | `convex/schema.ts:line 71` | `scale: optional(number)` |
| Capabilities Tracking | ✅ **Done** | `convex/schema.ts:line 50` | `capabilities: array(string)` |
| Start/Stop/Restart | ❌ **Missing** | — | Need mutations for lifecycle control |
| Emergency Stop | ❌ **Missing** | — | Need system-level abort mechanism |

### B. Execution Control
**Vision**: Execute manually, trigger workflows, replay failed tasks, abort running, inspect logs

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| Manual Execution | ✅ **Done** | `convex/tasks.ts` | Task assignment triggers agents |
| Execution Logging | ✅ **95%** | `convex/executionLog.ts` | `logExecution` mutation, executions table |
| Execution History | ✅ **Done** | `convex/schema.ts:line 83` | Executions table with full audit trail |
| Replay Failed Tasks | ⚠️ **50%** | — | Need retry/replay logic in tasks.ts |
| Abort Running Tasks | ❌ **Missing** | — | Need cancellation mechanism |
| Structured Logs | ✅ **Done** | `convex/schema.ts:line 111` | `logs: array(string)` |
| Error Tracking | ✅ **Done** | `convex/schema.ts:line 110` | `error: optional(string)` |

### C. Cron Job Management
**Vision**: Create scheduled workflows, assign agents, track execution, detect failures, alert anomalies

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| Cron Jobs System | ✅ **Done** | `convex/cron.ts` | 3 active cron handlers (auto-claim, heartbeat, escalation) |
| Scheduled Workflows | ✅ **90%** | `convex/cron.ts:line 33` | `autoClaimCronHandler` with retry logic |
| Failure Detection | ✅ **Done** | `convex/cron.ts` | Circuit breaker + retry configs |
| Anomaly Alerts | ✅ **70%** | `convex/anomalyDetection.ts` | Partial implementation |
| Last Run Tracking | ❌ **Missing** | — | Need `lastRunAt`, `lastStatus` in DB |
| Cron Definition Schema | ❌ **Missing** | — | No `cron_jobs` table in schema |

### D. Execution History & Audit Ledger
**Vision**: Immutable record of who/what/when/inputs/outputs/tokens/cost/errors

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| Execution Logging | ✅ **Done** | `convex/schema.ts:line 83-121` | Executions table |
| Trigger Type | ✅ **Done** | `convex/schema.ts:line 88` | manual/cron/autonomous/webhook |
| Status Tracking | ✅ **Done** | `convex/schema.ts:line 94` | pending/running/success/failed/aborted |
| Duration Tracking | ✅ **Done** | `convex/schema.ts:line 103` | `durationMs` |
| Token Usage | ✅ **Done** | `convex/schema.ts:line 104-106` | inputTokens, outputTokens, totalTokens |
| Cost Tracking | ⚠️ **50%** | `convex/schema.ts:line 107` | `costCents` field exists but not populated |
| Error Logging | ✅ **Done** | `convex/schema.ts:line 110` | `error: optional(string)` |
| Metadata | ✅ **Done** | `convex/schema.ts:line 112-116` | sessionKey, sessionId, retryCount |

---

## 2️⃣ OBSERVABILITY LAYER

### A. Agent Utilisation Dashboard
**Vision**: Per-agent total executions, avg duration, failure rate, token consumption, cost, utilization %

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| Dashboard Summary | ✅ **Done** | `convex/dashboard.ts:line 12` | Query: `getDashboardSummary` |
| Total Executions | ✅ **Done** | `convex/dashboard.ts:line 36` | Aggregated in `totalExecutions` |
| Avg Duration | ⚠️ **50%** | `convex/dashboard.ts:line 96` | Calculated in `getAgentWithStats` |
| Failure Rate | ✅ **Done** | `convex/dashboard.ts:line 39-41` | `successRate` percent |
| Token Consumption | ✅ **Done** | `convex/dashboard.ts:line 38` | `todayTokens` aggregated |
| Cost Breakdown | ❌ **Missing** | — | No cost aggregation query |
| Utilization % | ❌ **Missing** | — | Need busy vs idle time calculation |
| Per-Agent Stats | ✅ **Done** | `convex/dashboard.ts:line 79` | Query: `getAgentWithStats` |

### B. System Health Dashboard
**Vision**: Active agents, queued tasks, running tasks, failed tasks, cost burn rate, cron success rate

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| Active Agents Count | ✅ **Done** | `convex/dashboard.ts:line 35` | Filter by status='active' |
| Queued Tasks | ⚠️ **50%** | — | Partial via tasks table |
| Running Tasks | ✅ **Done** | `convex/dashboard.ts:line 28` | Count executions with status='running' |
| Failed Tasks | ✅ **Done** | `convex/dashboard.ts:line 30` | Count executions with status='failed' |
| Cost Burn Rate | ❌ **Missing** | — | No cost time-series aggregation |
| Cron Success Rate | ❌ **Missing** | — | Need cron-specific metrics |

### C. Event Stream View
**Vision**: Live feed (agent started, task completed, cron triggered, error, retry)

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| Activity Log | ✅ **Done** | `convex/schema.ts` activities table | Per-business activity tracking |
| Event Types | ✅ **Done** | `convex/activities.ts` | Multiple event types |
| Real-time Updates | ✅ **Done** | Convex subscriptions | Automatic via Convex reactivity |
| Event Filtering | ⚠️ **50%** | — | Basic activity queries exist |
| Live Feed UI | ❌ **Missing** | — | Need dedicated event stream component |

---

## 3️⃣ WORKFLOW ORCHESTRATION

**Vision**: Multi-agent pipelines, dependency graphs, conditional branching, handoffs, retry/timeout policies

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| Task Dependencies | ✅ **Done** | `convex/schema.ts:line 197-198` | `blockedBy`, `blocks` arrays |
| Dependency Validation | ✅ **90%** | `convex/tasks.ts` | Circular dependency check |
| Epic Hierarchy | ✅ **Done** | `convex/schema.ts:line 127` | Epics → Tasks structure |
| Task Hierarchy | ✅ **Done** | `convex/schema.ts:line 177-178` | parentId, subtaskIds |
| Retry Policy | ✅ **Done** | `convex/cron.ts` | withRetry, RETRY_CONFIGS |
| Timeout Policy | ⚠️ **50%** | — | Partial in cron handlers |
| Conditional Branching | ❌ **Missing** | — | Need workflow definition language |
| Automatic Handoffs | ⚠️ **50%** | `convex/tasks.ts` | Basic task assignment exists |
| Multi-Agent Pipelines | ❌ **Missing** | — | Need workflow DAG/pipeline definition |

---

## 4️⃣ AGENT LOGS & DEBUGGING

**Vision**: Structured logs, prompt/model/tokens, API calls, expandable UI, filtering, search, download

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| Structured Logs | ✅ **Done** | `convex/schema.ts:line 111` | `logs: array(string)` |
| Model Tracking | ✅ **Done** | `convex/schema.ts:line 108` | `model: optional(string)` |
| Model Provider | ✅ **Done** | `convex/schema.ts:line 109` | `modelProvider: optional(string)` |
| Token Breakdown | ✅ **Done** | `convex/schema.ts:line 104-106` | in/out tokens |
| Prompt Storage | ❌ **Missing** | — | No prompt logging in schema |
| API Calls Log | ❌ **Missing** | — | No external API tracking |
| Expandable Logs UI | ❌ **Missing** | — | Frontend component needed |
| Log Filtering | ⚠️ **50%** | `convex/dashboard.ts:line 61-63` | Basic agent/status filters |
| Log Search | ❌ **Missing** | — | No full-text search implementation |
| Log Export | ❌ **Missing** | — | No download functionality |

---

## 5️⃣ UNIFIED COMMAND INTERFACE

**Vision**: Command Palette (⌘K), run agent, restart worker, trigger workflow, create cron, view logs, search

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| Command Palette | ✅ **Done** | `src/components/CommandPalette.tsx` | Keyboard shortcuts implemented |
| Keyboard Shortcuts | ✅ **Done** | Phase 5D testing | Accessibility testing in progress |
| Run Agent | ❌ **Missing** | — | Need command in palette |
| Restart Worker | ❌ **Missing** | — | Need lifecycle control commands |
| Trigger Workflow | ❌ **Missing** | — | Need workflow execution command |
| Create Cron | ❌ **Missing** | — | Need cron creation UI |
| View Logs | ⚠️ **50%** | — | Exists in board but not central |
| Search Executions | ⚠️ **50%** | `convex/dashboard.ts:line 49` | Query exists, UI needs building |

---

## 6️⃣ ACCESS CONTROL & GOVERNANCE

**Vision**: Role-based permissions, agent execution restrictions, budget enforcement, emergency stop, rate limits

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| Role-Based Access | ⚠️ **50%** | — | Basic business scoping exists |
| Agent Exec Restrictions | ❌ **Missing** | — | Need permission checks |
| Budget Enforcement | ❌ **Missing** | — | Need cost limits per agent |
| Emergency Stop | ❌ **Missing** | — | Need system-level abort |
| Rate Limits | ✅ **Done** | `lib/errors.ts` | Rate limiting implemented |

---

## 7️⃣ SCALABILITY ARCHITECTURE

**Vision**: 5→100+ agents, 20→10K tasks, concurrent execution, high log volume, event-driven, append-only logs

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| Event-Driven | ✅ **Done** | Convex design | All mutations are events |
| Append-Only Logs | ✅ **Done** | `convex/schema.ts` executionLog | Executions never deleted |
| Async Processing | ✅ **Done** | `convex/cron.ts` | Cron handlers async |
| Concurrent Execution | ✅ **Done** | Convex | Simultaneous task execution |
| Log Aggregation | ⚠️ **50%** | `convex/opsMetrics.ts` | Partial metrics aggregation |
| Background Analytics | ⚠️ **50%** | `convex/dashboard.ts` | Basic queries, no background workers |

---

## 8️⃣ FRONTEND PAGES INVENTORY

### Current Pages
| Page | Path | Status | Purpose |
|------|------|--------|---------|
| **Control Panel** | `/control` | ✅ Done | Agent Registry + Executions (Phase 1) |
| **Agents** | `/agents` | ⚠️ Partial | Agent list/detail |
| **Board** | `/[businessSlug]/board` | ✅ Done | Kanban task board |
| **Epics** | `/[businessSlug]/epics` | ✅ Done | Epic management |
| **Overview** | `/[businessSlug]/overview` | ✅ Done | Business dashboard |
| **Analytics** | `/global/analytics` | ✅ Done | High-level metrics |
| **Workload** | `/global/workload` | ⚠️ Partial | Utilization tracking |
| **Bottlenecks** | `/global/bottlenecks` | ⚠️ Partial | Performance issues |
| **Brain** | `/global/brain` | ⚠️ Partial | Memory/knowledge system |
| **Activity** | `/global/activity` | ✅ Done | Event stream |
| **Calendar** | `/global/calendar` | ✅ Done | Calendar events |
| **API Docs** | `/global/api-docs` | ✅ Done | API documentation |

### Missing Pages for Full Vision
- **Workflow Builder** — Visual pipeline designer
- **Cron Manager** — Scheduled job UI
- **Cost Intelligence** — Token/cost dashboard
- **Agent Control** — Start/stop/scale UI
- **Execution Replay** — Failed task retry UI
- **Logs Explorer** — Detailed log inspection UI
- **Settings & Governance** — Budget/permission configuration

---

## 🔴 CRITICAL GAPS

| Gap | Priority | Effort | Blocker |
|-----|----------|--------|---------|
| Cron job definition table | P0 | 2h | Phase 2 blocking |
| Cost aggregation queries | P0 | 3h | Budget enforcement |
| Workflow/pipeline definitions | P1 | 8h | Multi-agent orchestration |
| Agent lifecycle control (start/stop) | P1 | 4h | Full control plane |
| Execution replay/retry UI | P1 | 6h | Developer experience |
| Log search & export | P2 | 4h | Debugging experience |
| Budget enforcement | P1 | 3h | Governance |
| Emergency stop mechanism | P0 | 2h | Safety |

---

## 📋 IMPLEMENTATION PHASES ROADMAP

### ✅ DONE — Phase 1 Foundation
- Agent registry queries
- Execution logging (schema + mutations)
- Dashboard summary queries
- Control panel basic UI
- Cron job handlers

### ⏳ PHASE 2A — Observability Complete (2-3 days)
- **Cost tracking**: Add `costCents` calculation, aggregation queries
- **Cron jobs table**: Add schema + CRUD operations
- **Failure metrics**: Enhanced dashboard with failure patterns
- **Event stream UI**: Full event feed page
- **Execution filtering**: Advanced filters (agent, status, date range)

### ⏳ PHASE 2B — Workflow Basics (3-4 days)
- **Replay failed tasks**: Mutation + UI
- **Retry policies**: Configurable retry logic
- **Pipeline definitions**: Schema for workflow DAGs
- **Dependency validation**: Enhanced circular ref detection

### ⏳ PHASE 3 — Control Plane (3-4 days)
- **Agent lifecycle**: Start/stop/restart mutations
- **Emergency stop**: System-level abort mechanism
- **Horizontal scaling**: Scale mutations
- **Budget enforcement**: Cost limit checks

### ⏳ PHASE 4 — Intelligence (2-3 weeks)
- **Auto-scaling**: Based on queue depth
- **Cost-aware routing**: Cheapest agent selection
- **Failure prediction**: ML-based early detection
- **Workflow optimization**: Suggestions based on history

---

## 📂 KEY FILES REFERENCE

### Schema
- `convex/schema.ts` — Core data model (agents, tasks, epics, executions)

### Backend Functions
- `convex/agents.ts` — Agent CRUD, queries
- `convex/executionLog.ts` — Execution logging mutations
- `convex/dashboard.ts` — Dashboard queries
- `convex/cron.ts` — Scheduled jobs
- `convex/tasks.ts` — Task management
- `convex/anomalyDetection.ts` — Anomaly detection (partial)

### Frontend
- `src/app/control/page.tsx` — Main control panel (Phase 1)
- `src/components/CommandPalette.tsx` — Command interface
- `src/app/[businessSlug]/board/page.tsx` — Kanban board

### Testing
- `convex/__tests__/` — Unit tests for backend logic

---

## 🎯 NEXT IMMEDIATE ACTIONS

1. **Add Cron Jobs Table** (2h)
   - Add schema definition
   - Create CRUD mutations
   - Add queries for listing active/historical runs

2. **Cost Tracking** (3h)
   - Implement `costCents` calculation in execution logging
   - Add cost aggregation queries
   - Create cost dashboard component

3. **Execution Replay** (4h)
   - Add replay mutation
   - Build replay UI in control panel
   - Test with failed executions

4. **Agent Lifecycle Control** (4h)
   - Add start/stop/restart mutations
   - Update agent status schema
   - Build control UI in agent registry

5. **Emergency Stop** (2h)
   - Add abort execution mutation
   - Add system-level circuit breaker
   - Add emergency stop button in UI

---

## 📊 COVERAGE SUMMARY

```
Vision Component         | Coverage | Priority
─────────────────────────┼──────────┼──────────
Agent Management         | 85%      | P0
Execution Control        | 70%      | P0
Cron Job Management      | 60%      | P0
Execution Ledger         | 95%      | Done ✅
Observability            | 60%      | P1
Workflow Orchestration   | 40%      | P1
Logs & Debugging         | 50%      | P2
Command Interface        | 70%      | P2
Access Control           | 30%      | P2
Scalability              | 80%      | Done ✅
─────────────────────────┼──────────┼──────────
OVERALL                  | 64%      | ~2-3 wks
```

---

**Last Updated**: Feb 24, 2026
**Next Review**: After Phase 2A completion
