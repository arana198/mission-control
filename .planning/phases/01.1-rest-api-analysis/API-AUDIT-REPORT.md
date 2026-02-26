# Mission Control API Audit Report

**Date:** 2026-02-26
**Auditor:** Automated inspection of all route handler files in `frontend/src/app/api/`
**Scope:** All 32 route files covering 42 distinct operations across 11 domains

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total route files inspected | 32 |
| Total HTTP operations | 42 |
| Domains | 11 |

### Auth Mechanism Breakdown

| Auth Mechanism | Operation Count | Endpoints |
|----------------|-----------------|-----------|
| `agentId` + `agentKey` custom headers | 3 | `GET /api/agents`, `GET /api/agents/[agentId]` (partial), `GET /api/agents/[agentId]/tasks` (via header), `POST /api/agents/[agentId]/heartbeat`, `POST /api/agents/[agentId]/poll` |
| `agentKey` query param | 7 | `GET /api/agents/[agentId]`, `GET /api/agents/[agentId]/tasks`, `GET /api/agents/[agentId]/tasks/[taskId]`, `GET /api/agents/[agentId]/wiki/pages`, `GET /api/agents/[agentId]/wiki/pages/[pageId]`, `PATCH /api/agents/[agentId]/wiki/pages/[pageId]` |
| `agentKey` in request body | 6 | `POST /api/agents/[agentId]/heartbeat`, `POST /api/agents/[agentId]/poll`, `POST /api/agents/[agentId]/tasks/[taskId]/comments`, `PATCH /api/tasks/[taskId]` (4 actions), `POST /api/calendar/events`, `PUT /api/calendar/events/[eventId]` |
| `Authorization: Bearer` (standard) | 4 | `PATCH /api/agents/[agentId]` (accepts both), `POST /api/agents/[agentId]/rotate-key` (accepts both), `POST /api/calendar/events`, `PUT /api/calendar/events/[eventId]`, `GET /api/calendar/slots` |
| `agentId` + `agentKey` in request body | 3 | `POST /api/tasks/[taskId]/calendar-events`, `POST /api/calendar/events`, `PUT /api/calendar/events/[eventId]` |
| No auth | 12 | `GET /api/health`, `GET /api/openapi`, `GET /api/businesses`, `POST /api/businesses`, `GET /api/epics`, `GET /api/memory`, `GET /api/memory/files`, `GET /api/memory/context`, `GET /api/state-engine/metrics`, `GET /api/state-engine/decisions`, `GET /api/state-engine/alerts`, `GET /api/agents/workspace/structure`, `GET /api/tasks/execute`, `POST /api/tasks/execute`, `GET /api/tasks/generate-daily`, `POST /api/tasks/generate-daily`, `GET /api/reports`, `POST /api/reports`, `POST /api/admin/agents/setup-workspace`, `POST /api/admin/migrations/agent-workspace-paths` |

### Error Response Shape Breakdown

| Shape | Description | Operation Count |
|-------|-------------|-----------------|
| Shape A (standardized) | `{ success, error: { code, message }, timestamp }` via `jsonResponse(successResponse(...))` / `handleApiError()` | ~25 |
| Shape B (raw) | `{ error: "string" }` or `{ error: "...", details: "..." }` via `Response.json(...)` or `new Response(JSON.stringify(...))` | ~12 |
| Shape C (mixed) | `{ success: false, error: "string" }` via `Response.json({success, error: string})` | ~5 |

---

## Full Endpoint Inventory

| Domain | Path | Methods | Auth Mechanism | Request Validation | Response Format | Status Codes | Issues |
|--------|------|---------|----------------|--------------------|-----------------|--------------|--------|
| Health | `/api/health` | GET | None | None | Custom flat JSON (no `success` field) | 200, 503 | Non-standard response shape |
| OpenAPI | `/api/openapi` | GET | None | None | Shape B (raw `{ error: "..." }`) | 200, 500 | Hand-crafted 1300+ line generator |
| Agents | `/api/agents` | GET | `agentId` + `agentKey` custom headers | RegisterAgentSchema (Zod) on POST | Shape A | 200, 201, 400, 401, 500 | GET uses non-standard `agentId` header; no 404 on missing |
| Agents | `/api/agents` | POST | None (open registration) | RegisterAgentSchema (Zod) | Shape A | 200, 201, 400, 500 | No auth on registration; returns 200 or 201 based on isNew |
| Agents | `/api/agents/[agentId]` | GET | `agentKey` query param OR `agentKey` header | None (manual check) | Shape A | 200, 400, 401, 500 | Auth via query param leaks key in logs |
| Agents | `/api/agents/[agentId]` | PATCH | `Authorization: Bearer` OR `apiKey` in body | UpdateAgentSchema (Zod) | Shape A | 200, 400, 401, 404, 500 | Dual auth: accepts both Bearer and body apiKey |
| Agents | `/api/agents/[agentId]/tasks` | GET | `agentKey` query param | QueryTasksSchema (Zod) | Shape A | 200, 400, 401, 500 | Auth via query param; auth not in header |
| Agents | `/api/agents/[agentId]/tasks/[taskId]` | GET | `agentKey` query param | GetTaskDetailsSchema (Zod) | Shape A | 200, 400, 401, 404, 500 | Auth via query param |
| Agents | `/api/agents/[agentId]/tasks/[taskId]/comments` | POST | `agentKey` in request body | AddCommentSchema (Zod) | Shape A | 201, 400, 401, 500 | Auth via request body |
| Agents | `/api/agents/[agentId]/heartbeat` | POST | `agentKey` in request body | HeartbeatSchema (Zod) | Shape A | 200, 400, 401, 500 | Auth via request body |
| Agents | `/api/agents/[agentId]/poll` | POST | `agentKey` in request body | PollAgentSchema (Zod) | Shape A | 200, 400, 401, 500 | Auth via request body; `workspaceId` checked twice (schema + manual) |
| Agents | `/api/agents/[agentId]/rotate-key` | POST | `Authorization: Bearer` OR `apiKey` in body | RotateKeySchema (Zod) | Shape A | 200, 400, 401, 404, 429, 500 | Best practice endpoint; adds `X-Request-Id` header; in-memory rate limiting (non-durable) |
| Agents | `/api/agents/[agentId]/wiki/pages` | GET, POST | `agentKey` query param | Manual (title check) | Shape A | 200, 201, 400, 401, 500 | Auth via query param; no Zod schema for wiki |
| Agents | `/api/agents/[agentId]/wiki/pages/[pageId]` | GET, PATCH | `agentKey` query param | Manual (title/content) | Shape A | 200, 400, 401, 404, 500 | Auth via query param |
| Agents | `/api/agents/workspace/structure` | GET | None (no auth) | None (manual check) | Shape B (`{ error: "..." }`) | 200, 400, 404, 500 | No auth; reads server filesystem directly via `readdirSync`/`statSync`; no `success` field in response |
| Tasks | `/api/tasks/[taskId]` | PATCH | `agentKey` in request body (for 4 actions) | None (action discriminator) | Shape A | 200, 400, 401, 500 | **Action discriminator anti-pattern**: 8 sub-operations via `action` body field: `assign`, `complete`, `update-status`, `update-tags`, `escalate`, `reassign`, `unblock`, `mark-executed`; 4 actions have no auth (escalate, reassign, unblock, mark-executed) |
| Tasks | `/api/tasks/execute` | GET, POST | None | Manual (taskId, taskTitle, taskDescription) | Shape B (raw `new Response(JSON.stringify(...))`) | 200, 400, 500 | **Verb in URL**; GET polls status but queries non-existent data; mock implementation; execution logging disabled (`Phase 6A TODO`) |
| Tasks | `/api/tasks/generate-daily` | GET, POST | None | Manual (workspaceId) | Shape B/C mixed | 200, 201, 400, 500 | **Verb in URL**; GET is mock stub; POST uses raw `new Response(JSON.stringify(...))` with mixed `success` fields |
| Tasks | `/api/tasks/[taskId]/calendar-events` | POST | `agentId` + `agentKey` in request body | Manual (all fields) | Shape A | 201, 400, 401, 500 | Auth via request body |
| Businesses | `/api/businesses` | GET, POST | None | Manual (name, slug, missionStatement) | Shape C (`{ success: false, error: "string" }`) | 200, 201, 400, 500 | No auth; error uses Shape C (string not object); route name is alias for workspaces |
| Epics | `/api/epics` | GET | None | Manual (workspaceId) | Mixed: success=true uses `{ success, epics }` (non-standard); error uses Shape B | 200, 400, 500 | No auth; defines its own local `jsonResponse()` function instead of importing from `lib/utils/apiResponse`; non-standard success shape |
| Calendar | `/api/calendar/events` | POST | `agentId` + `agentKey` in request body | Manual (all fields) | Shape A | 201, 400, 401, 500 | Auth via request body (both `agentId` and `agentKey` in body) |
| Calendar | `/api/calendar/events/[eventId]` | PUT | `agentId` + `agentKey` in request body | Manual (agentId, agentKey, executedAt) | Shape A | 200, 400, 401, 500 | Auth via request body; uses PUT (correct for full replace/update-with-known-state) |
| Calendar | `/api/calendar/slots` | GET | `agentId` + `agentKey` query params | Manual (all params) | Shape A | 200, 400, 401, 500 | Auth via query params |
| Memory | `/api/memory` | GET | None | None | `{ files: [...] }` (non-standard) | 200, 500 | **Reads local filesystem** (`~/.openclaw/workspace/memory`); no auth; non-standard response shape; returns 500 status on empty dir |
| Memory | `/api/memory/files` | GET | None | Manual (`path` query param) | `{ content }` or `{ content, error }` (non-standard) | 200, 400, 403, 500 | Reads local filesystem; no auth; non-standard response; has path traversal guard |
| Memory | `/api/memory/context` | GET | None | None | Custom flat JSON (non-standard) | 200, 500 | No auth; stub implementation (returns empty data); no filesystem access |
| Gateway | `/api/gateway/[gatewayId]` | GET, POST | None | Manual (per action) | Shape B (`{ error: "..." }`) | 200, 400, 404, 500 | **CRITICAL: `?action=` anti-pattern** — 3 GET actions: `sessions`, `history`, `status`; 4 POST actions: `message`, `provision`, `sync`, `validate`; all 7 operations on one URL; no standard auth |
| State Engine | `/api/state-engine/metrics` | GET | None | Manual (workspaceId) | Raw `Response.json(metrics)` (no `success` field) + Shape B on error | 200, 400, 500 | No auth; raw response shape |
| State Engine | `/api/state-engine/decisions` | GET | None | Manual (workspaceId) | Raw `Response.json({...})` (no `success` field) + Shape B on error | 200, 400, 500 | No auth; raw response shape |
| State Engine | `/api/state-engine/alerts` | GET | None | Manual (workspaceId) | Raw `Response.json({...})` (no `success` field) + Shape B on error | 200, 400, 500 | No auth; raw response shape |
| Reports | `/api/reports` | GET, POST | None | Manual (week/type for GET; workspaceId/type for POST) | Shape B (`{ error: "..." }` raw `new Response`) | 200, 400, 404, 500 | No auth; GET returns 404 for ungerated reports; POST returns raw report without `success` field; error persistence silently swallowed |
| Admin | `/api/admin/agents/setup-workspace` | POST | None | Manual (agentName, workspacePath) | Shape A | 200, 400, 404, 500 | **No auth guard** on admin endpoint; uses `jsonResponse` from apiResponse; workaround implementation using `register` mutation |
| Admin | `/api/admin/migrations/agent-workspace-paths` | POST | None | Manual (defaultWorkspacePath optional) | Shape A | 200, 500 | **No auth guard** on admin/migration endpoint |

---

## Per-Domain Findings

### Domain: Health (`/api/health`)

**GET /api/health** — No auth required. Returns `{ status, timestamp, uptime, environment, version }`. Custom flat shape — does not use `success` field or `jsonResponse` utility. Error returns `{ status: "unhealthy", timestamp, error }` with 503. Functionally fine for monitoring but inconsistent response shape.

---

### Domain: OpenAPI (`/api/openapi`)

**GET /api/openapi** — No auth required. Calls `generateOpenAPISpec()` from `@/lib/openapi-generator`. Error response is `{ error: "Failed to generate OpenAPI specification" }` (Shape B) via raw `new Response(JSON.stringify(...))`. The generator is a 1300+ line hand-crafted file. No connection to Zod validators.

---

### Domain: Agents (`/api/agents`, `/api/agents/[agentId]`, sub-routes)

**GET /api/agents** — Requires `agentId` AND `agentKey` as non-standard HTTP headers. Uses `verifyAgent()`. Returns agent list. Shape A.

**POST /api/agents** — No auth (open registration). Uses `RegisterAgentSchema` (Zod). Returns 201 for new agents, 200 for existing. Shape A.

**GET /api/agents/[agentId]** — Auth via `agentKey` as query param OR header (not Bearer). Shape A.

**PATCH /api/agents/[agentId]** — Auth via `Authorization: Bearer` OR `apiKey` in request body. Uses `UpdateAgentSchema` (Zod). Shape A. Best endpoint for auth pattern.

**GET /api/agents/[agentId]/tasks** — Auth via `agentKey` query param only. Uses `QueryTasksSchema` (Zod). Has pagination (`limit`/`offset`). Shape A.

**GET /api/agents/[agentId]/tasks/[taskId]** — Auth via `agentKey` query param. Uses `GetTaskDetailsSchema` (Zod). Shape A.

**POST /api/agents/[agentId]/tasks/[taskId]/comments** — Auth via `agentKey` in request body. Uses `AddCommentSchema` (Zod). Returns 201. Supports `Idempotency-Key` header (echoed back but not used for deduplication). Shape A.

**POST /api/agents/[agentId]/heartbeat** — Auth via `agentKey` in request body. Uses `HeartbeatSchema` (Zod). Shape A.

**POST /api/agents/[agentId]/poll** — Auth via `agentKey` in request body. Uses `PollAgentSchema` (Zod). `workspaceId` is validated twice (in schema and manually). Shape A.

**POST /api/agents/[agentId]/rotate-key** — Auth via `Authorization: Bearer` OR `apiKey` in body (prefers Bearer). Uses `RotateKeySchema` (Zod). Returns `X-Request-Id` header. Has in-memory rate limiting (3/hour per agent — **not durable across restarts**). Full audit logging. Shape A. This is the most well-implemented endpoint.

**GET /api/agents/[agentId]/wiki/pages** — Auth via `agentKey` query param. No Zod schema for wiki body. Shape A.

**POST /api/agents/[agentId]/wiki/pages** — Auth via `agentKey` query param. Manual title validation. Returns 201. Shape A.

**GET /api/agents/[agentId]/wiki/pages/[pageId]** — Auth via `agentKey` query param. Shape A.

**PATCH /api/agents/[agentId]/wiki/pages/[pageId]** — Auth via `agentKey` query param. Shape A.

**GET /api/agents/workspace/structure** — **No auth guard.** Reads agent's filesystem using Node.js `readdirSync`/`statSync`. Auth is missing. Returns custom flat JSON (no `success` field). Uses `NextResponse.json` (Shape B on error: `{ error: "..." }`). The `agentId` comes from query param, not path — this is a flat URL that doesn't follow the nested agent structure.

---

### Domain: Tasks (`/api/tasks/*`)

**PATCH /api/tasks/[taskId]** — The action discriminator consolidates 8 operations into one PATCH endpoint:
1. `action: "assign"` — assigns task to agents; auth via `agentKey` in body
2. `action: "complete"` — marks task done; auth via `agentKey` in body
3. `action: "update-status"` — updates task status; auth via `agentKey` in body
4. `action: "update-tags"` — adds/removes tags; auth via `agentKey` in body
5. `action: "escalate"` — escalates to P0; **no auth** (requires `decidedBy` field only)
6. `action: "reassign"` — reassigns task; **no auth** (requires `decidedBy` field only)
7. `action: "unblock"` — removes blocked status; **no auth** (requires `decidedBy` field only)
8. `action: "mark-executed"` — marks as executed; **no auth** (requires `decidedBy` field only)

The 4 state-engine actions (escalate, reassign, unblock, mark-executed) have no auth guard — they accept any `decidedBy` string value.

**GET /api/tasks/execute** — No auth. Polls execution status from executionId query param. Stub: returns hardcoded `status: "completed"` without querying DB (query is commented out). Shape B.

**POST /api/tasks/execute** — No auth. Spawns OpenClaw sub-agent (mocked — actual HTTP call commented out). Uses raw `new Response(JSON.stringify(...))`. No `handleApiError()`. Shape B. Error logging disabled (Phase 6A TODO comments).

**GET /api/tasks/generate-daily** — No auth. Stub: returns hardcoded mock response. Shape B.

**POST /api/tasks/generate-daily** — No auth. Generates tasks using `taskGenerationService`. Returns 201 on success, 200 for empty result. Uses raw `new Response(JSON.stringify(...))`. Mixed shapes (success: `{ success, tasks, count, generatedAt }` — non-standard; error: `{ success: false, error: "string" }` — Shape C). Auth missing.

**POST /api/tasks/[taskId]/calendar-events** — Auth via `agentId` + `agentKey` in request body. Uses `ValidationError`/`UnauthorizedError` classes. Returns 201. Shape A.

---

### Domain: Businesses (`/api/businesses`)

**GET /api/businesses** — No auth. Returns `{ success: true, businesses: [...] }`. Error returns `{ success: false, error: error.message }` (Shape C — string, not object).

**POST /api/businesses** — No auth. Validates name/slug/missionStatement manually. Returns 201 on create. Error is Shape C. Internally calls `api.workspaces.create` but URL is `/api/businesses` (naming inconsistency).

---

### Domain: Epics (`/api/epics`)

**GET /api/epics** — No auth. Defines its own local `jsonResponse` function (duplicate of `lib/utils/apiResponse`). Success returns `{ success: true, epics: [...], message: "..." }` (non-standard — not wrapped in `data`). Error returns `{ error: "..." }` (Shape B) via its local `jsonResponse`.

---

### Domain: Calendar (`/api/calendar/*`)

**POST /api/calendar/events** — Auth via `agentId` + `agentKey` in request body. Uses `ValidationError`/`UnauthorizedError`. Returns 201. Shape A. Uses `Idempotency-Key` header (echoed back, not used for deduplication).

**PUT /api/calendar/events/[eventId]** — Auth via `agentId` + `agentKey` in request body. Shape A. Uses PUT semantics (marks event as executed — idempotent update). Note: uses PUT not PATCH — could be PATCH since it's a partial update.

**GET /api/calendar/slots** — Auth via `agentId` + `agentKey` query params. Uses `ValidationError`/`UnauthorizedError`. Shape A. Auth via query params exposes credentials in server logs.

---

### Domain: Memory (`/api/memory/*`)

**GET /api/memory** — No auth. Reads `~/.openclaw/workspace/memory` directory listing. Returns `{ files: [...] }` (non-standard shape — no `success` field). Error silently returns `{ files: [] }` with status 500 — wrong: 500 should return error, not empty data.

**GET /api/memory/files** — No auth. Reads file content from `~/.openclaw/workspace/` via `path` query param. Returns `{ content }` or `{ content, error }` (non-standard). Has path traversal guard (validates path stays within `memoryDir`). Returns 403 on traversal attempt.

**GET /api/memory/context** — No auth. Stub implementation — returns empty arrays for all fields. Returns custom flat object. No filesystem access. Error returns same flat shape.

All memory endpoints read from the **local server filesystem**. This only works in development environments where the server runs on the same machine as the OpenClaw workspace.

---

### Domain: Gateway (`/api/gateway/[gatewayId]`)

**GET /api/gateway/[gatewayId]** — **CRITICAL: `?action=` parameter discriminates 3 operations:**
- `?action=sessions` → calls `handleGetSessions()` — fetches active sessions via WebSocket RPC `sessions.list`
- `?action=history` → calls `handleGetHistory()` — fetches message history via WebSocket RPC `chat.history`; requires `sessionKey` query param
- `?action=status` (or no action) → calls `handleGatewayStatus()` — pings gateway and updates health status in DB

**POST /api/gateway/[gatewayId]** — **CRITICAL: `?action=` parameter discriminates 4 operations:**
- `?action=message` → calls `handleSendMessage()` — sends message via WebSocket RPC `chat.send`; requires `sessionKey` + `content` in body
- `?action=provision` → calls `handleProvision()` — 7-step agent provisioning via WebSocket; requires `agent`, `workspace`, `baseUrl` in body
- `?action=sync` → calls `handleSync()` — stub implementation (returns `{ ok: true, synced: true }`)
- `?action=validate` → calls `handleValidateConnection()` — validates WebSocket URL via `ping()`; requires `url` in body

No authentication on any gateway operations. Error responses are all Shape B (`{ error: "..." }`). Success responses are flat custom JSON (no `success` field structure).

---

### Domain: State Engine (`/api/state-engine/*`)

**GET /api/state-engine/metrics** — No auth. Returns raw Convex query result via `Response.json(metrics)` (no `success` wrapper). Error returns `{ error, details }` (Shape B).

**GET /api/state-engine/decisions** — No auth. Returns `{ workspaceId, decisions, patterns, count }` (non-standard, no `success` field). Error returns Shape B.

**GET /api/state-engine/alerts** — No auth. Returns `{ workspaceId, rules, count }` (non-standard, no `success` field). Error returns Shape B.

---

### Domain: Reports (`/api/reports`)

**GET /api/reports** — No auth. Returns 404 for ungenerated reports via raw `new Response(JSON.stringify({ week, year, message }))`. Error returns Shape B.

**POST /api/reports** — No auth. Generates weekly report. Returns raw report JSON without `success` wrapper. Silently swallows persistence errors. Error responses are mixed: 400 uses `{ error: "..." }` (Shape B), 500 uses `{ success: false, error: "..." }` (Shape C).

---

### Domain: Admin (`/api/admin/*`)

**POST /api/admin/agents/setup-workspace** — **No auth guard.** Sets workspace path for an agent by name. Uses Shape A (`jsonResponse` from `lib/utils/apiResponse`). Returns 200. Workaround implementation: calls `api.agents.register` to update existing agent.

**POST /api/admin/migrations/agent-workspace-paths** — **No auth guard.** Runs database migration for all agents. Uses Shape A. Returns 200. Exposes migration endpoint publicly.

---

## Special Pattern Analysis

### Gateway `?action=` Anti-Pattern (7 sub-operations)

All 7 operations are tunneled through a single URL with `?action=` parameter:

| HTTP Method | Action Value | Operation | Legitimate REST URL |
|-------------|-------------|-----------|---------------------|
| GET | `sessions` | List active sessions | `GET /api/gateway/[gatewayId]/sessions` |
| GET | `history` | Get message history | `GET /api/gateway/[gatewayId]/sessions/[sessionKey]/history` |
| GET | `status` (or omit) | Gateway health check | `GET /api/gateway/[gatewayId]` |
| POST | `message` | Send message to session | `POST /api/gateway/[gatewayId]/sessions/[sessionKey]/messages` |
| POST | `provision` | Provision agent | `POST /api/gateway/[gatewayId]/provision` |
| POST | `sync` | Sync gateway data | `POST /api/gateway/[gatewayId]/sync` |
| POST | `validate` | Validate WebSocket connection | `POST /api/gateway/[gatewayId]/validate` |

All 7 operations return Shape B errors. No auth on any operation. This is a **Richardson Maturity Level 0** pattern — single URL, action in parameter.

### Tasks Action Discriminator (8 sub-operations)

All 8 operations are tunneled through `PATCH /api/tasks/[taskId]` with `action` field in request body:

| Action | Auth | Purpose | Legitimate REST URL |
|--------|------|---------|---------------------|
| `assign` | `agentKey` in body | Assign task to agents | `POST /api/tasks/[taskId]/assignments` |
| `complete` | `agentKey` in body | Mark task done | `POST /api/tasks/[taskId]/completions` |
| `update-status` | `agentKey` in body | Update status | `PATCH /api/tasks/[taskId]` (body: `{ status }`) |
| `update-tags` | `agentKey` in body | Modify tags | `PATCH /api/tasks/[taskId]` (body: `{ tags }`) |
| `escalate` | None (decidedBy only) | Escalate to P0 | `POST /api/tasks/[taskId]/escalations` |
| `reassign` | None (decidedBy only) | Reassign task | `POST /api/tasks/[taskId]/reassignments` |
| `unblock` | None (decidedBy only) | Remove blocked status | `DELETE /api/tasks/[taskId]/blockers` |
| `mark-executed` | None (decidedBy only) | Mark as executed | `POST /api/tasks/[taskId]/executions` |

The 4 state-engine actions (escalate, reassign, unblock, mark-executed) accept any `decidedBy` string with no auth verification — this is a missing auth guard.

### Admin Endpoints Without Auth

Both admin endpoints (`/api/admin/agents/setup-workspace` and `/api/admin/migrations/agent-workspace-paths`) are publicly accessible with no authentication. Anyone with network access to the server can:
- Set any agent's workspace path to any string
- Run database migrations affecting all agents

---

## Files Inspected

| File | Route | Methods |
|------|-------|---------|
| `frontend/src/app/api/health/route.ts` | `/api/health` | GET |
| `frontend/src/app/api/openapi/route.ts` | `/api/openapi` | GET |
| `frontend/src/app/api/agents/route.ts` | `/api/agents` | GET, POST |
| `frontend/src/app/api/agents/[agentId]/route.ts` | `/api/agents/[agentId]` | GET, PATCH |
| `frontend/src/app/api/agents/[agentId]/tasks/route.ts` | `/api/agents/[agentId]/tasks` | GET |
| `frontend/src/app/api/agents/[agentId]/tasks/[taskId]/route.ts` | `/api/agents/[agentId]/tasks/[taskId]` | GET |
| `frontend/src/app/api/agents/[agentId]/tasks/[taskId]/comments/route.ts` | `/api/agents/[agentId]/tasks/[taskId]/comments` | POST |
| `frontend/src/app/api/agents/[agentId]/heartbeat/route.ts` | `/api/agents/[agentId]/heartbeat` | POST |
| `frontend/src/app/api/agents/[agentId]/poll/route.ts` | `/api/agents/[agentId]/poll` | POST |
| `frontend/src/app/api/agents/[agentId]/rotate-key/route.ts` | `/api/agents/[agentId]/rotate-key` | POST |
| `frontend/src/app/api/agents/[agentId]/wiki/pages/route.ts` | `/api/agents/[agentId]/wiki/pages` | GET, POST |
| `frontend/src/app/api/agents/[agentId]/wiki/pages/[pageId]/route.ts` | `/api/agents/[agentId]/wiki/pages/[pageId]` | GET, PATCH |
| `frontend/src/app/api/agents/workspace/structure/route.ts` | `/api/agents/workspace/structure` | GET |
| `frontend/src/app/api/tasks/[taskId]/route.ts` | `/api/tasks/[taskId]` | PATCH |
| `frontend/src/app/api/tasks/execute/route.ts` | `/api/tasks/execute` | GET, POST |
| `frontend/src/app/api/tasks/generate-daily/route.ts` | `/api/tasks/generate-daily` | GET, POST |
| `frontend/src/app/api/tasks/[taskId]/calendar-events/route.ts` | `/api/tasks/[taskId]/calendar-events` | POST |
| `frontend/src/app/api/businesses/route.ts` | `/api/businesses` | GET, POST |
| `frontend/src/app/api/epics/route.ts` | `/api/epics` | GET |
| `frontend/src/app/api/calendar/events/route.ts` | `/api/calendar/events` | POST |
| `frontend/src/app/api/calendar/events/[eventId]/route.ts` | `/api/calendar/events/[eventId]` | PUT |
| `frontend/src/app/api/calendar/slots/route.ts` | `/api/calendar/slots` | GET |
| `frontend/src/app/api/memory/route.ts` | `/api/memory` | GET |
| `frontend/src/app/api/memory/files/route.ts` | `/api/memory/files` | GET |
| `frontend/src/app/api/memory/context/route.ts` | `/api/memory/context` | GET |
| `frontend/src/app/api/gateway/[gatewayId]/route.ts` | `/api/gateway/[gatewayId]` | GET, POST |
| `frontend/src/app/api/state-engine/metrics/route.ts` | `/api/state-engine/metrics` | GET |
| `frontend/src/app/api/state-engine/decisions/route.ts` | `/api/state-engine/decisions` | GET |
| `frontend/src/app/api/state-engine/alerts/route.ts` | `/api/state-engine/alerts` | GET |
| `frontend/src/app/api/reports/route.ts` | `/api/reports` | GET, POST |
| `frontend/src/app/api/admin/agents/setup-workspace/route.ts` | `/api/admin/agents/setup-workspace` | POST |
| `frontend/src/app/api/admin/migrations/agent-workspace-paths/route.ts` | `/api/admin/migrations/agent-workspace-paths` | POST |
