# Requirements: Mission Control

**Defined:** 2026-02-26
**Core Value:** Replace fragmented, opaque, silo'd agent usage with a coordinated, observable, cost-governed, multi-workspace control plane

## v1 Requirements

### Workspace Management
- [ ] **WS-01**: User can create a workspace (name, slug, mission statement, emoji, color)
- [ ] **WS-02**: Workspace has isolated data: agents, tickets, crons, wiki, cost budget
- [ ] **WS-03**: Admin can set workspace budget (monthly token limit)
- [ ] **WS-04**: Admin can set default workspace
- [ ] **WS-05**: Workspace isolation enforced (users see only assigned workspaces)
- [ ] **WS-06**: Workspace context propagated through all API calls (URL path `/api/v1/workspaces/{id}/...`)

### Agent Registration & Management
- [ ] **AG-01**: Agent can register via REST API (POST /api/v1/agents) with endpoint + capabilities
- [ ] **AG-02**: Admin can view pending registrations and approve/reject
- [ ] **AG-03**: Agent receives API key upon approval (Bearer token in Authorization header)
- [ ] **AG-04**: Agent can list other agents via REST API (GET /api/v1/agents)
- [ ] **AG-05**: Agent can rotate API key (old key has grace period before expiration)
- [ ] **AG-06**: Admin can deactivate/remove agents

### Ticket / Work Item Management
- [ ] **TK-01**: Agent can poll for available tickets (GET /api/v1/tickets/available?limit=10)
- [ ] **TK-02**: Agent can claim unclaimed ticket (PATCH /api/v1/tickets/{id}/claim)
- [ ] **TK-03**: Agent can update ticket status (PATCH /api/v1/tickets/{id}) with state machine: To-do → In Progress → PR Review → Done → Closed
- [ ] **TK-04**: Agent can add comments to ticket (POST /api/v1/tickets/{id}/comments)
- [ ] **TK-05**: Agent can @mention individuals or @all in comments
- [ ] **TK-06**: System auto-detects PR references in comments and creates backlinks
- [ ] **TK-07**: Admin can assign tickets to agents (alternative to agents claiming)

### Activity Logging & Observability
- [ ] **AC-01**: Every agent action logged: timestamp, agentId, workspaceId, action, metadata
- [ ] **AC-02**: Execution log includes: startTime, endTime, duration, status, tokens consumed, cost
- [ ] **AC-03**: Agent decisions logged: input → reasoning → output/decision
- [ ] **AC-04**: Agent can query activity log (GET /api/v1/activity?limit=50&cursor=...)
- [ ] **AC-05**: Activity log searchable by agent, workspace, date range, status

### Agent Evaluation & Metrics
- [ ] **MT-01**: Success metrics tracked: (tasks completed / tasks attempted) per agent
- [ ] **MT-02**: Cost efficiency metrics: average tokens per task completion
- [ ] **MT-03**: Agent can query own metrics (GET /api/v1/agents/{id}/metrics)
- [ ] **MT-04**: Metrics available per workspace and time period

### Cron Job Management
- [ ] **CR-01**: Admin can create cron job (POST /api/v1/crons): schedule, agent, task definition
- [ ] **CR-02**: Crons globally visible (filterable by workspace)
- [ ] **CR-03**: Cron can reference agents in single or multiple workspaces
- [ ] **CR-04**: Admin can edit cron (PATCH /api/v1/crons/{id})
- [ ] **CR-05**: Admin can delete cron (DELETE /api/v1/crons/{id})
- [ ] **CR-06**: Bidirectional sync with OpenClaw crons
- [ ] **CR-07**: Cron execution activity logged: metadata, output, tickets created, cost
- [ ] **CR-08**: Cron failures trigger automatic retry with exponential backoff

### Workflow Management
- [ ] **WF-01**: User can define workflow (DAG of agents and tasks)
- [ ] **WF-02**: Workflow validates: no cycles, all dependencies satisfied
- [ ] **WF-03**: Multiple concurrent executions allowed per workflow
- [ ] **WF-04**: Step N output automatically merged into step N+1 input (data chaining)
- [ ] **WF-05**: Workflow state machine enforced: pending → running → success/failed/aborted
- [ ] **WF-06**: User can trigger workflow execution (POST /api/v1/workflows/{id}/execute)

### Per-Workspace Wiki
- [ ] **WK-01**: Workspace admin can create wiki pages (markdown documents)
- [ ] **WK-02**: Wiki pages stored in git with PR review requirement
- [ ] **WK-03**: Wiki pages accessible via REST API (GET /api/v1/workspaces/{id}/wiki/pages)
- [ ] **WK-04**: Tickets can link to wiki pages for context

### OpenClaw Integration
- [ ] **OC-01**: OpenClaw agents can poll Mission Control for work (pull-based)
- [ ] **OC-02**: OpenClaw agents can create/update tickets via REST API (push-based)
- [ ] **OC-03**: Mission Control can invoke OpenClaw agents (async dispatch)
- [ ] **OC-04**: Agents receive ticket data, task parameters, workspace context on invocation
- [ ] **OC-05**: Agents report results via REST API (update ticket, post comments, link PRs)

### REST API Standards (CRITICAL - Foundation for All Above)
- [ ] **API-01**: All endpoints follow RESTful routing (GET/POST/PUT/DELETE/PATCH)
- [ ] **API-02**: All errors return RFC 9457 format: `{type, title, detail, instance, status}`
- [ ] **API-03**: Success responses: `{data: {...}, success: true}`
- [ ] **API-04**: List endpoints support cursor pagination: `?limit=50&cursor=abc123`
- [ ] **API-05**: List endpoints support filtering: `?status=pending&agent=x`
- [ ] **API-06**: List endpoints support sorting: `?sort=-createdAt`
- [ ] **API-07**: Workspace context in URL path: `/api/v1/workspaces/{workspaceId}/...`
- [ ] **API-08**: All endpoints require API key auth (Authorization: Bearer {apiKey})
- [ ] **API-09**: Rate limiting enforced: X-RateLimit-* headers, 429 on limit exceeded
- [ ] **API-10**: OpenAPI 3.0 spec auto-generated from Zod schemas (zod-openapi)
- [ ] **API-11**: Swagger UI available at /api/docs
- [ ] **API-12**: Support /api/v1/ and /api/v2/ for backwards compatibility

### Critical Bug Fixes (Research-Identified)
- [ ] **BUG-01**: Fix workspace isolation bypass in notifications.ts and executions.ts
- [ ] **BUG-02**: Implement retry limit and timeout protection (no infinite retries)
- [ ] **BUG-03**: Fix cost calculation silent $0 fallback (fail loudly on misconfiguration)

## v2 Requirements

### Notifications System
- **NOTIF-01**: When agent @mentioned in comment, agent receives webhook callback (async)
- **NOTIF-02**: Agent can poll for notifications (GET /api/v1/notifications)
- **NOTIF-03**: Webhook delivery with retry logic and exponential backoff

### Advanced Approval & Decision Making
- **APPR-01**: Step-level approval gates in workflows
- **APPR-02**: Approval velocity metrics and stale approval escalation
- **APPR-03**: Tiered confidence thresholds (low/medium/high risk)

### Audit & Compliance
- **AUD-01**: Consolidate audit systems (activities, decisions, events, executionLog → single event stream)
- **AUD-02**: Immutable workflow_events table for regulatory compliance
- **AUD-03**: Audit viewer and replay UI

### Observability Dashboard
- **DASH-01**: Real-time workflow execution monitoring
- **DASH-02**: Cost breakdown by workspace, agent, workflow
- **DASH-03**: Agent performance metrics and trends

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time chat | Use comments/mentions on tickets instead |
| Video content storage | Agents reference external links |
| Mobile app | Web-first, mobile later |
| OAuth / SAML enterprise auth | API key auth sufficient for v1 |
| Data warehouse / BI dashboards | Query metrics API for custom analysis |
| Audit compliance (SOC 2) | Activity logs provide foundation |

## Traceability

(To be populated during roadmap creation)

| Requirement | Phase | Status |
|------------|-------|--------|
| (Phase 1 requirements mapped here) | Phase 1 | Pending |
| (Phase 2 requirements mapped here) | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 47 total
- Mapped to phases: (pending)
- Unmapped: (pending)

---
*Requirements defined: 2026-02-26*
*Last updated: 2026-02-26 after research synthesis*
