# Mission Control

## What This Is

Mission Control is a **multi-workspace AI orchestration and collaboration platform** that serves as the unified command center for managing autonomous specialist agents. Each workspace represents an independent product, team, or initiative with its own agents, workflows, Kanban board, cron jobs, budgets, token usage, logs, and execution history — while sharing a unified orchestration engine and REST API underneath. Mission Control is the single control plane for coordinating multi-agent teams, monitoring utilization and costs, enforcing governance and permissions, and observing system health in real time.

## Core Value

**Replace fragmented, opaque, silo'd agent usage with a coordinated, observable, cost-governed, multi-workspace control plane** — enabling teams and individual developers to deploy autonomous specialist agents with full visibility, governance, cost tracking, and collaborative decision-making.

## What This Solves

**Problem:** As multiple teams or products begin running AI agents independently, visibility becomes opaque, consistency breaks down, governance is non-existent, costs spiral, work duplicates, and no single system understands what is running, why, or how efficiently.

**Opportunity:** Replace scattered AI experimentation with structured orchestration — transforming fragmented agent usage into a coordinated, observable, economically optimized, and auditable AI-native operating model.

## Users

- **You (software developer)** — Developer and platform user, creating workspaces, defining workflows, managing agents
- **AI agents (OpenClaw agents)** — Primary consumers of the platform via REST APIs; agents self-register, poll for work, report results, manage crons
- **Human collaborators** — Workspace members who collaborate with agents via tickets, comments, wiki documentation

## Core Capabilities

### 1. Multi-Workspace Isolation with Governance
- Each workspace is independent: agents, workflows, tickets, budgets, logs, permissions, wiki
- Admin approval flows for agent registration (agents request registration via REST API → admins approve)
- Role-based access control: who can see/modify what in each workspace
- Cost attribution per workspace; budgets enforceable per workspace

### 2. Autonomous Agent Orchestration
- Agents register themselves via REST API with endpoint + capabilities
- Agents discover work by polling `/api/tickets/available`
- Agents claim tickets and execute autonomously
- Mission Control can proactively invoke agents (asynchronous dispatch with async callbacks)
- Agents report progress via REST API (update ticket status, post comments, link PRs)
- Bidirectional sync with OpenClaw: agents can poll for work AND Mission Control can trigger execution
- Support for multiple concurrent workflow executions per workflow (no serial blocking)
- Automatic data chaining: step N's output auto-merged into step N+1's input

### 3. Kanban Board & Ticket Lifecycle
- Unified work intake: To-do → In Progress → PR Review → Done → Closed
- Tickets assigned to agents (admin dispatch or agents claim unclaimed tickets)
- Async collaboration via comments/notifications:
  - Agents can tag individuals or `@all` for questions, clarifications, responses
  - Team members can comment and ask agents for clarification
  - Full audit trail of decisions within ticket context
- Automatic PR linking: mention PR number/URL in comments, system auto-detects and creates backlink
- PR reviewers can see the ticket to understand implementation decisions and discussions

### 4. Cron Job Management
- Global view of all scheduled work (filterable by workspace)
- Create/edit/delete cron jobs from Mission Control (bidirectional sync with OpenClaw)
- Crons can be per-workspace OR cross-workspace (coordinating agents across multiple workspaces)
- Activity logging per cron run:
  - Execution metadata: start time, end time, duration, success/failure
  - Task output & trace: what agent did, step-by-step activity
  - Artifacts: tickets created, resources consumed, token usage
- Cost attribution: if cross-workspace cron, costs go to workspace where agent executed
- Automatic retry with backoff on failures

### 5. Activity Logging & Observability
- Comprehensive execution history per agent/workspace
- Tracked per execution: start time, end time, status, duration
- Resource usage: tokens, API calls, compute cost per execution
- Agent decision reasoning: what inputs led to which outputs/decisions
- Real-time visibility into what's running, what failed, and why
- Search and filter execution history

### 6. Agent Evaluation & Self-Learning
- Agents can query success metrics (success rates, cost-efficiency, outcome quality)
- Agents use historical data to improve decision-making
- Evaluation data per workflow, per agent, per workspace

### 7. Per-Workspace Wiki
- Markdown documents stored in git (versioned, PR-reviewed, auditable)
- Sections: architecture decisions, sprint planning notes, retrospectives, meeting notes
- Kanban tickets can link to wiki docs for context
- PR reviewers can refer to wiki architecture and decisions
- One wiki per workspace (workspace isolation)

### 8. REST API-First Architecture
- **All features accessible via RESTful APIs** that agents consume
- APIs follow best practices:
  - **Routing:** RESTful verbs (GET/POST/PUT/DELETE/PATCH)
  - **Auth:** API Key in Authorization header (`Bearer {apiKey}` or `X-API-Key`)
  - **Pagination:** limit/offset or cursor-based for large result sets
  - **Filtering & sorting:** Query parameters (`?status=pending&sort=-createdAt`)
  - **Versioning:** Support /api/v1/, /api/v2/ for backwards compatibility
  - **Documentation:** OpenAPI 3.0 spec at `/api/openapi`, Swagger UI at `/api-docs`
  - **Error handling:** Consistent format `{success: false, error: {code, message, requestId}}` with HTTP status codes
  - **Rate limiting:** X-RateLimit headers; 429 responses when limits exceeded

## Current State

**Existing Foundation (Brownfield):**
- ✅ Convex + Next.js monorepo architecture with clear backend/frontend separation
- ✅ Multi-workspace model in Convex schema
- ✅ Agent management: registration, listing, status tracking, API keys, gateway integration
- ✅ Task/work item system with epic grouping, priorities, kanban states
- ✅ Workflow execution: DAG validation, state machines, step advancement, automatic data chaining
- ✅ OpenClaw gateway integration: WebSocket pooling, RPC communication
- ✅ Activity logging infrastructure
- ✅ 32 API route files organized by domain
- ✅ Testing infrastructure: Jest (unit/integration) + Playwright (E2E)
- ✅ OpenAPI generation ready

**Gaps to Address:**
- ⏳ Workspace isolation / RBAC — workspaces exist but no permission boundaries
- ⏳ Agent registration approval flow — agents can register but no admin approval
- ⏳ Comprehensive REST API coverage — not all features exposed as REST endpoints
- ⏳ REST API standardization — existing APIs may not follow best practices uniformly
- ⏳ Cron job management — no global cron visibility/CRUD operations
- ⏳ Cost tracking & budgets — no token usage tracking per workspace
- ⏳ Notification system — no @mentions, async collaboration infrastructure
- ⏳ Wiki / knowledge base — memory API exists but not structured wiki
- ⏳ Agent evaluation metrics — no success rate/cost queries available to agents
- ⏳ Full ticket lifecycle — PR review stage and closure process incomplete

## Requirements

### Validated

(None yet — ship to validate)

### Active

#### Workspace Management
- [ ] **WORKSPACE-01** — User can create a workspace (name, slug, mission statement, emoji, color)
- [ ] **WORKSPACE-02** — Workspace has isolated data: agents, tickets, crons, wiki, cost budget
- [ ] **WORKSPACE-03** — Admin can set workspace budget (monthly token limit)
- [ ] **WORKSPACE-04** — Admin can set default workspace
- [ ] **WORKSPACE-05** — Users see only their assigned workspaces

#### Agent Registration & Management
- [ ] **AGENT-01** — Agent can register via REST API (POST /api/agents) with endpoint + capabilities
- [ ] **AGENT-02** — Admin can view pending agent registrations and approve/reject
- [ ] **AGENT-03** — Agent receives API key upon approval (Bearer token)
- [ ] **AGENT-04** — Agent can authenticate via API key in Authorization header
- [ ] **AGENT-05** — Agent can list other agents in workspace via REST API (GET /api/agents)
- [ ] **AGENT-06** — Agent can rotate API key (old key has grace period)
- [ ] **AGENT-07** — Admin can deactivate/remove agents

#### Ticket / Work Item Management
- [ ] **TICKET-01** — Agent can poll for available tickets (GET /api/tickets/available?limit=10)
- [ ] **TICKET-02** — Agent can claim unclaimed ticket (PATCH /api/tickets/{id}/claim)
- [ ] **TICKET-03** — Agent can update ticket status (PATCH /api/tickets/{id}) with state machine validation
- [ ] **TICKET-04** — Agent can add comments to ticket (POST /api/tickets/{id}/comments)
- [ ] **TICKET-05** — Agent can @mention individuals or @all in comments (triggers notifications)
- [ ] **TICKET-06** — Agent can reference PR in comment (system auto-detects PR#123 or URL, creates link)
- [ ] **TICKET-07** — Ticket lifecycle: To-do → In Progress → PR Review → Done → Closed (with state machine)
- [ ] **TICKET-08** — Admin can assign tickets to agents (alternative to agents claiming)
- [ ] **TICKET-09** — Human can view ticket with full context: description, agent progress, comments, linked PR, wiki refs

#### Notifications System
- [ ] **NOTIF-01** — When agent is @mentioned in comment, agent receives webhook callback (async)
- [ ] **NOTIF-02** — Agent can poll for notifications (GET /api/notifications)
- [ ] **NOTIF-03** — Notifications include: timestamp, type (mention/tag), content, context (ticketId, etc.)
- [ ] **NOTIF-04** — Webhook delivery has retry logic with exponential backoff

#### Activity Logging & Observability
- [ ] **ACTIVITY-01** — Every agent action logged: timestamp, agentId, workspaceId, action, metadata
- [ ] **ACTIVITY-02** — Execution log includes: startTime, endTime, duration, status (success/failed/blocked)
- [ ] **ACTIVITY-03** — Resource tracking per execution: tokens consumed, API calls, compute cost
- [ ] **ACTIVITY-04** — Agent decisions logged: input → reasoning → output/decision made
- [ ] **ACTIVITY-05** — Agent can query activity log (GET /api/activity?agentId=x&limit=50)
- [ ] **ACTIVITY-06** — Activity log searchable by agent, workspace, date range, status

#### Agent Evaluation & Metrics
- [ ] **METRIC-01** — Success metrics tracked: (tasks completed / tasks attempted) per agent
- [ ] **METRIC-02** — Cost efficiency metrics: average tokens per task completion
- [ ] **METRIC-03** — Outcome quality: tracked when human rates agent work as good/bad
- [ ] **METRIC-04** — Agent can query own metrics (GET /api/agents/{id}/metrics)
- [ ] **METRIC-05** — Metrics available per workspace, per time period (day/week/month)

#### Cron Job Management
- [ ] **CRON-01** — Admin can create cron job (POST /api/crons): schedule, agent, task definition, workspace(s)
- [ ] **CRON-02** — Crons are globally visible (filterable by workspace)
- [ ] **CRON-03** — Cron can reference agents in single or multiple workspaces
- [ ] **CRON-04** — Admin can edit cron (PATCH /api/crons/{id}): update schedule, agent, task
- [ ] **CRON-05** — Admin can delete cron (DELETE /api/crons/{id})
- [ ] **CRON-06** — Bidirectional sync: OpenClaw crons sync to Mission Control; MC crons sync to OpenClaw
- [ ] **CRON-07** — Cron execution activity logged: metadata, output, tickets created, cost
- [ ] **CRON-08** — Cron failures trigger automatic retry with exponential backoff
- [ ] **CRON-09** — Cost attribution: if cross-workspace, charge to workspace where agent executed

#### Workflow Management
- [ ] **WORKFLOW-01** — User can define workflow (DAG of agents and tasks)
- [ ] **WORKFLOW-02** — Workflow validates: no cycles, all tasks have dependencies satisfied
- [ ] **WORKFLOW-03** — Multiple concurrent executions allowed per workflow (no serial blocking)
- [ ] **WORKFLOW-04** — Step N output automatically merged into step N+1 input (data chaining)
- [ ] **WORKFLOW-05** — Workflow state machine enforced: pending → running → success/failed/aborted
- [ ] **WORKFLOW-06** — User can trigger workflow execution (POST /api/workflows/{id}/execute)
- [ ] **WORKFLOW-07** — Agent can query workflow status (GET /api/workflows/{id}/executions)

#### Per-Workspace Wiki
- [ ] **WIKI-01** — Workspace admin can create wiki pages (markdown documents)
- [ ] **WIKI-02** — Wiki pages stored in git (path: {workspace_slug}/wiki/)
- [ ] **WIKI-03** — Changes to wiki require PR review (CI validates markdown, editor can auto-format)
- [ ] **WIKI-04** — Wiki pages accessible via REST API (GET /api/workspaces/{id}/wiki/pages)
- [ ] **WIKI-05** — Tickets can link to wiki pages for architecture/decision context
- [ ] **WIKI-06** — PR reviewers can read wiki to understand architectural decisions

#### OpenClaw Integration
- [ ] **OPENCLAW-01** — OpenClaw agents can poll Mission Control for work (pull-based discovery)
- [ ] **OPENCLAW-02** — OpenClaw agents can create tickets via REST API (push-based reporting)
- [ ] **OPENCLAW-03** — Mission Control can invoke OpenClaw agents (async dispatch)
- [ ] **OPENCLAW-04** — Mission Control sends to agent: ticket data, task parameters, workspace context
- [ ] **OPENCLAW-05** — OpenClaw agents report results via Mission Control REST API
- [ ] **OPENCLAW-06** — Agents can reference OpenClaw cron jobs in Mission Control

#### REST API Standards
- [ ] **API-01** — All endpoints follow RESTful routing (GET/POST/PUT/DELETE/PATCH)
- [ ] **API-02** — All errors return: `{success: false, error: {code, message, requestId}}`
- [ ] **API-03** — Responses consistent: `{success: true, data: {...}}`
- [ ] **API-04** — List endpoints support pagination: `?limit=50&offset=0` OR cursor-based
- [ ] **API-05** — List endpoints support filtering: `?status=pending&workspaceId=x`
- [ ] **API-06** — List endpoints support sorting: `?sort=-createdAt` (- = descending)
- [ ] **API-07** — All endpoints require API key auth (Authorization: Bearer {apiKey})
- [ ] **API-08** — Rate limiting enforced: X-RateLimit-* headers, 429 on limit exceeded
- [ ] **API-09** — OpenAPI 3.0 spec generated and updated automatically
- [ ] **API-10** — Swagger UI available at /api-docs
- [ ] **API-11** — Support /api/v1/ and /api/v2/ endpoints for backwards compatibility

### Out of Scope

- **Real-time chat** — Use comments/mentions on tickets instead
- **Video content storage** — Agents can reference external video links
- **Mobile app** — Web-first, mobile later
- **OAuth / SAML enterprise auth** — API key auth sufficient for v1
- **Data warehouse / BI dashboards** — Query metrics API directly for custom analysis
- **Audit compliance (SOC 2, etc.)** — Out of scope for v1; activity logs provide foundation

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| REST API-first architecture | Agents must be able to use all features; REST is universal | Pending |
| Multi-workspace isolation | Teams need independent, cost-tracked work | Pending |
| Kanban ticket lifecycle (5 states) | Aligns agent work with human PR review process | Pending |
| Bidirectional OpenClaw integration | Agents can pull work (poll) AND MC can push (invoke) | Pending |
| API versioning (/api/v1/, /api/v2/) | Backwards compatibility as platform evolves | Pending |
| Per-workspace wiki in git | Version control, PR review, audit trail for decisions | Pending |
| Agents learn via metrics queries | Self-improvement without retraining | Pending |
| Cost attribution to execution workspace | Fair accounting for multi-workspace crons | Pending |

## Constraints

- **Tech stack locked:** Convex + Next.js, existing patterns and monorepo structure
- **Brownfield project:** Existing codebase; preserve working features while adding new ones
- **OpenClaw dependency:** Agents run in OpenClaw; Mission Control orchestrates them

## Context

Mission Control is being built to replace ad-hoc, silo'd AI agent usage across teams. The current codebase has a solid foundation (Convex schema, 32 API routes, workflow validation, OpenClaw integration). This project fills critical gaps: workspace isolation, cron management, cost governance, notification system, and comprehensive REST API coverage. The goal is to create a unified, observable, cost-aware platform for autonomous agent orchestration.

---

*Last updated: 2026-02-26 after initialization*
