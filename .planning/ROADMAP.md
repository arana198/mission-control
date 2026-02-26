# Mission Control — v1 Roadmap

**Project:** Mission Control (multi-workspace AI orchestration platform)
**Version:** v1
**Created:** 2026-02-26
**Updated:** 2026-02-26

## Roadmap Overview

The v1 roadmap breaks 47 requirements into 6 phases, each building a foundational layer for the multi-workspace AI orchestration control plane.

**Completion Strategy:** Sequential phases with gates; all E2E tests must pass before advancing.

---

## Phase 1: REST API Foundation & Standardization

**Goal:** Establish uniform REST API standards and coverage across all domains

**Duration:** ~1 sprint
**Requirements Addressed:** API-01 through API-12, foundational for all subsequent phases

**What it builds:**
- Uniform request/response format (RFC 9457 for errors, standardized data shape)
- Cursor pagination, filtering, sorting on list endpoints
- OpenAPI 3.0 spec generation from Zod schemas (zod-openapi)
- API versioning (/api/v1/, /api/v2/)
- Workspace context in URL paths (`/api/v1/workspaces/{workspaceId}/...`)

**Success Criteria:**
- [ ] All 32 existing API routes migrated to `/api/v1/` with REST compliance
- [ ] OpenAPI spec auto-generated and validated
- [ ] Swagger UI available at `/api/docs`
- [ ] Error responses in RFC 9457 format with request ID tracing
- [ ] All list endpoints support cursor, filter, sort
- [ ] No breaking changes to agent integrations
- [ ] E2E test coverage for API contract

**Outcomes:**
- Agents can reliably discover and use all API endpoints
- Foundation for workspace isolation (requires URL path context)
- Prerequisite for Phase 2 (Agent Registration & RBAC)

---

## Phase 2: Workspace Isolation & RBAC

**Goal:** Enforce workspace boundaries and role-based access control

**Duration:** ~1.5 sprints
**Requirements Addressed:** WS-01 through WS-06, foundational for governance

**What it builds:**
- Workspace creation (name, slug, mission statement, emoji, color)
- Role-based access control: Admin, Agent, Collaborator, Viewer
- Per-workspace data isolation (agents, tickets, crons, wiki, budget)
- Workspace context propagated through all API calls
- Default workspace assignment
- User → workspace membership management

**Success Criteria:**
- [ ] Workspace schema in Convex supports CRUD
- [ ] RBAC enforced on all API endpoints
- [ ] Users see only assigned workspaces
- [ ] Workspace context extracted from URL and validated on every request
- [ ] Agents cannot access data from workspaces they're not registered in
- [ ] E2E tests verify isolation boundaries
- [ ] Audit logs track permission changes

**Outcomes:**
- Multi-tenant isolation complete
- Foundation for agent registration approval (Phase 3)
- Cost attribution per workspace (Phase 5)

---

## Phase 3: Agent Registration & Management

**Goal:** Implement agent registration flow with approval gates and API key management

**Duration:** ~1 sprint
**Requirements Addressed:** AG-01 through AG-06, enables agent orchestration

**What it builds:**
- Agent self-registration via REST API (POST /api/v1/agents)
- Registration approval flow (admin reviews pending registrations)
- API key issuance upon approval (Bearer token in Authorization header)
- API key rotation with grace period
- Agent deactivation/removal by admin
- Agent listing endpoint with filtering

**Success Criteria:**
- [ ] Agents can register with endpoint + capabilities
- [ ] Admin approval UI shows pending registrations
- [ ] Agents receive API key upon approval
- [ ] API key auth enforced on all agent API calls
- [ ] Key rotation generates new key, keeps old key active for grace period (24 hours)
- [ ] Old key expires and is no longer usable
- [ ] E2E test: agent register → admin approve → agent use API key

**Outcomes:**
- Agents can authenticate with Mission Control
- Foundation for ticket claiming and work discovery (Phase 4)

---

## Phase 4: Ticket Management & Kanban Lifecycle

**Goal:** Implement full ticket lifecycle with agent claiming and comment threading

**Duration:** ~1.5 sprints
**Requirements Addressed:** TK-01 through TK-07, enables agent work intake

**What it builds:**
- Ticket polling endpoint (GET /api/v1/tickets/available?limit=10)
- Agent ticket claiming (PATCH /api/v1/tickets/{id}/claim)
- Ticket status state machine: To-do → In Progress → PR Review → Done → Closed
- Comment system with @mentions (@user, @all)
- PR reference auto-detection in comments (#123, https://github.com/.../pull/123)
- Admin ticket assignment to agents
- Ticket search/filter/sort

**Success Criteria:**
- [ ] Agents can poll for available tickets (unassigned, To-do status)
- [ ] Agents can claim unclaimed tickets (exclusive lock on claim)
- [ ] Status transitions validated by state machine
- [ ] Comments support @mentions (triggers notifications in Phase 5)
- [ ] PR references auto-detected and stored (backlinks)
- [ ] Human can view full ticket context: description, agent, comments, linked PR
- [ ] E2E test: agent poll → claim → progress → comment → PR link

**Outcomes:**
- Agent work intake pipeline operational
- Foundation for notifications (Phase 5)

---

## Phase 5: Activity Logging, Metrics & Observability

**Goal:** Implement comprehensive activity logging, cost tracking, and agent metrics

**Duration:** ~1 sprint
**Requirements Addressed:** AC-01 through AC-05, MT-01 through MT-04, enables governance

**What it builds:**
- Activity audit log: every agent action (timestamp, agentId, workspaceId, action, metadata)
- Execution metrics: startTime, endTime, duration, status, tokens consumed, cost
- Agent decision logging: input → reasoning → output
- Activity query endpoint (GET /api/v1/activity?limit=50&cursor=...)
- Searchable by agent, workspace, date range, status
- Agent success rate metrics: (completed / attempted) per agent
- Cost efficiency: average tokens per task completion
- Agent can query own metrics (GET /api/v1/agents/{id}/metrics)

**Success Criteria:**
- [ ] All agent API calls logged with metadata
- [ ] Execution logs include tokens, cost, status
- [ ] Activity searchable and filterable
- [ ] Agent success/cost metrics computed and queryable
- [ ] Metrics per workspace and time period (day/week/month)
- [ ] No performance regression (async logging)
- [ ] E2E test: agent executes ticket → activity logged → metrics updated

**Outcomes:**
- Full observability into agent usage and costs
- Foundation for cron management (Phase 6)

---

## Phase 6: Cron Jobs, Workflows & Wiki

**Goal:** Implement cron job management, workflow execution, and per-workspace wiki

**Duration:** ~2 sprints
**Requirements Addressed:** CR-01 through CR-08, WF-01 through WF-06, WK-01 through WK-04

**What it builds:**
- Cron job CRUD: create, edit, delete, list (admin only)
- Cron scheduling: single workspace or cross-workspace
- Cron execution activity logging: output, tickets created, cost
- Retry logic with exponential backoff
- Bidirectional sync with OpenClaw crons
- Workflow definition (DAG of agents and tasks)
- Workflow validation: no cycles, dependencies satisfied
- Multiple concurrent executions per workflow (no serial blocking)
- Step N output auto-merged into step N+1 input (data chaining)
- Workflow state machine: pending → running → success/failed/aborted
- Per-workspace wiki: create, edit, delete markdown pages
- Wiki pages stored in git with PR review requirement
- Wiki pages accessible via REST API
- Tickets can link to wiki pages for context

**Success Criteria:**
- [ ] Admin can create/edit/delete crons
- [ ] Crons execute on schedule and log activity
- [ ] Failed crons retry with backoff
- [ ] OpenClaw crons sync bidirectionally
- [ ] Workflows validate DAG and enforce state machine
- [ ] Multiple executions allowed per workflow
- [ ] Data chaining works correctly (step output merged into next input)
- [ ] Wiki pages created via API and stored in git
- [ ] Wiki changes require PR review
- [ ] Tickets can reference wiki pages
- [ ] E2E test: create cron → execute → log activity → success rate tracked

**Outcomes:**
- Complete v1 feature set operational
- Agents can automate recurring work (crons)
- Agents can execute multi-step workflows
- Teams have workspace-specific documentation (wiki)

---

## Phase 7: OpenClaw Integration & Agent Invocation

**Goal:** Complete bidirectional OpenClaw integration (pull + push + invoke)

**Duration:** ~1 sprint
**Requirements Addressed:** OC-01 through OC-05

**What it builds:**
- OpenClaw agents pull work from Mission Control (existing in Phase 4)
- OpenClaw agents push results via REST API (existing in Phase 4)
- Mission Control can invoke OpenClaw agents (async dispatch)
- Agents receive ticket data, task parameters, workspace context on invocation
- Agents report results via REST API (update ticket, post comments, link PRs)
- Webhook callbacks for agent notifications

**Success Criteria:**
- [ ] Mission Control can invoke agents via `/api/v1/agents/{id}/invoke`
- [ ] Agents receive full task context (ticket data, parameters, workspace)
- [ ] Agents can report progress via comments API
- [ ] Agents can update ticket status
- [ ] Agents can link PRs in comments
- [ ] E2E test: MC triggers agent → agent processes work → reports results

**Outcomes:**
- Agents can be proactively dispatched
- Bidirectional agent orchestration complete

---

## Deferred: Phase 8 (v1.1 or v2)

These requirements are out of v1 scope but captured for future:

- **Notifications System:** @mentions → webhook callbacks, polling notifications (NOTIF-01, NOTIF-02, NOTIF-03)
- **Critical Bug Fixes:** Workspace isolation bypass fixes, retry limits, cost calculation (BUG-01, BUG-02, BUG-03)

---

## Cross-Phase Dependencies

```
Phase 1: REST API Foundation
    ↓
Phase 2: Workspace Isolation & RBAC
    ↓
Phase 3: Agent Registration & Management
    ├→ Phase 4: Ticket Management
    │   ├→ Phase 5: Activity Logging & Metrics
    │   └→ Phase 6: Cron Jobs, Workflows & Wiki
    │       └→ Phase 7: OpenClaw Invocation
```

---

## Success Criteria (Overall)

- [ ] All 47 v1 requirements mapped to phases and addressed
- [ ] All phases have executable PLAN.md with task breakdown
- [ ] No broken E2E tests at any phase
- [ ] Agent can poll tickets, claim work, report progress
- [ ] Multi-workspace isolation enforced at data access layer
- [ ] Cost tracking per workspace
- [ ] Full audit trail of agent actions
- [ ] OpenAPI spec generated and accurate
- [ ] Agents can integrate via REST API (no SDK required)

---

## Notes

- **Phase 1** is critical path; all other phases depend on REST standardization
- **Phase 2** must complete before agents can be properly isolated (Phase 3+)
- **Phase 4** is high-value; enables agent work intake immediately after Phase 3
- **Phase 5** can run parallel with Phase 4 (independent logging infrastructure)
- **Phase 6** integrates cron + workflow + wiki (complex but high-value)
- **Phase 7** is final integration; ensures agents can be both polled and invoked

---

*Roadmap created: 2026-02-26*
*v1 target: 47 requirements across 7 phases*
*Estimated duration: 9-11 sprints (brownfield, existing foundation)*
