# REST Compliance Matrix

**Date:** 2026-02-26
**Based on:** API-AUDIT-REPORT.md (audit of all 32 route handler files)
**Model:** Richardson Maturity Model Level 2

---

## How to Read This Matrix

Each endpoint group is rated on 6 REST dimensions:
- **PASS** — Meets the standard
- **PARTIAL** — Partially meets; minor issues
- **FAIL** — Violates the standard
- **N/A** — Not applicable (endpoint has no auth requirement)

**Severity:**
- **CRITICAL** — Level 0/1 behavior; fundamental REST violation
- **HIGH** — Auth non-compliance or major error format issues affecting security/interoperability
- **MEDIUM** — Naming, code semantics, or auth consistency issues
- **LOW** — Minor deviation; cosmetic or future-only concern
- **None** — Fully compliant

---

## Compliance Matrix

| Endpoint Group | HTTP Verbs | Resource Naming | Statelessness | Response Codes | Auth Standard | Error Consistency | Severity |
|---------------|-----------|-----------------|--------------|----------------|---------------|-------------------|----------|
| `GET /api/health` | PASS | PASS | PASS | PARTIAL | N/A | FAIL | LOW |
| `GET /api/openapi` | PASS | PASS | PASS | PASS | N/A | FAIL | LOW |
| `GET /api/agents` | PASS | PASS | PASS | PASS | FAIL | PASS | HIGH |
| `POST /api/agents` | PASS | PASS | PASS | PASS | N/A | PASS | None |
| `GET /api/agents/[agentId]` | PASS | PASS | PASS | PASS | FAIL | PASS | HIGH |
| `PATCH /api/agents/[agentId]` | PASS | PASS | PASS | PASS | PARTIAL | PASS | MEDIUM |
| `GET /api/agents/[agentId]/tasks` | PASS | PASS | PASS | PASS | FAIL | PASS | HIGH |
| `GET /api/agents/[agentId]/tasks/[taskId]` | PASS | PASS | PASS | PASS | FAIL | PASS | HIGH |
| `POST /api/agents/[agentId]/tasks/[taskId]/comments` | PASS | PASS | PASS | PASS | FAIL | PASS | HIGH |
| `POST /api/agents/[agentId]/heartbeat` | PASS | PARTIAL | PASS | PASS | FAIL | PASS | MEDIUM |
| `POST /api/agents/[agentId]/poll` | PASS | PARTIAL | PASS | PASS | FAIL | PASS | MEDIUM |
| `POST /api/agents/[agentId]/rotate-key` | PASS | PARTIAL | PASS | PASS | PARTIAL | PASS | MEDIUM |
| `GET /api/agents/[agentId]/wiki/pages` | PASS | PASS | PASS | PASS | FAIL | PASS | HIGH |
| `POST /api/agents/[agentId]/wiki/pages` | PASS | PASS | PASS | PASS | FAIL | PASS | HIGH |
| `GET /api/agents/[agentId]/wiki/pages/[pageId]` | PASS | PASS | PASS | PASS | FAIL | PASS | HIGH |
| `PATCH /api/agents/[agentId]/wiki/pages/[pageId]` | PASS | PASS | PASS | PASS | FAIL | PASS | HIGH |
| `GET /api/agents/workspace/structure` | PASS | PARTIAL | FAIL | PARTIAL | FAIL | FAIL | CRITICAL |
| `PATCH /api/tasks/[taskId]` (8 actions) | PARTIAL | FAIL | PASS | PASS | FAIL | PASS | HIGH |
| `GET /api/tasks/execute` | FAIL | FAIL | PASS | PARTIAL | N/A | FAIL | CRITICAL |
| `POST /api/tasks/execute` | FAIL | FAIL | PASS | PARTIAL | N/A | FAIL | CRITICAL |
| `GET /api/tasks/generate-daily` | FAIL | FAIL | PASS | PARTIAL | N/A | FAIL | CRITICAL |
| `POST /api/tasks/generate-daily` | FAIL | FAIL | PASS | PARTIAL | N/A | FAIL | CRITICAL |
| `POST /api/tasks/[taskId]/calendar-events` | PASS | PASS | PASS | PASS | FAIL | PASS | HIGH |
| `GET /api/businesses` | PASS | PASS | PASS | PASS | N/A | FAIL | LOW |
| `POST /api/businesses` | PASS | PASS | PASS | PASS | N/A | FAIL | LOW |
| `GET /api/epics` | PASS | PASS | PASS | PASS | N/A | FAIL | MEDIUM |
| `POST /api/calendar/events` | PASS | PASS | PASS | PASS | FAIL | PASS | HIGH |
| `PUT /api/calendar/events/[eventId]` | PASS | PASS | PASS | PASS | FAIL | PASS | HIGH |
| `GET /api/calendar/slots` | PASS | PASS | PASS | PASS | FAIL | PASS | HIGH |
| `GET /api/memory` | PASS | PASS | FAIL | FAIL | N/A | FAIL | CRITICAL |
| `GET /api/memory/files` | PASS | PASS | FAIL | PARTIAL | N/A | FAIL | HIGH |
| `GET /api/memory/context` | PASS | PASS | PASS | PASS | N/A | FAIL | LOW |
| `GET /api/gateway/[gatewayId]` (3 actions) | FAIL | FAIL | PASS | PARTIAL | N/A | FAIL | CRITICAL |
| `POST /api/gateway/[gatewayId]` (4 actions) | FAIL | FAIL | PASS | PARTIAL | N/A | FAIL | CRITICAL |
| `GET /api/state-engine/metrics` | PASS | PASS | PASS | PARTIAL | N/A | FAIL | MEDIUM |
| `GET /api/state-engine/decisions` | PASS | PASS | PASS | PARTIAL | N/A | FAIL | MEDIUM |
| `GET /api/state-engine/alerts` | PASS | PASS | PASS | PARTIAL | N/A | FAIL | MEDIUM |
| `GET /api/reports` | PASS | PASS | PASS | PARTIAL | N/A | FAIL | MEDIUM |
| `POST /api/reports` | PASS | PASS | PASS | PARTIAL | N/A | FAIL | MEDIUM |
| `POST /api/admin/agents/setup-workspace` | PASS | PASS | PASS | PASS | FAIL | PASS | CRITICAL |
| `POST /api/admin/migrations/agent-workspace-paths` | PASS | PASS | PASS | PASS | FAIL | PASS | CRITICAL |

---

## Dimension Justifications

### 1. HTTP Verb Correctness

**PASS criteria:** GET for reads, POST for creates, PATCH for partial updates, PUT for full replace, DELETE for removes. No operations tunneled through wrong verb.

| Rating | Endpoints | Justification |
|--------|-----------|---------------|
| PASS | Most agents, calendar, businesses, admin | Correct verb usage throughout |
| PARTIAL | `PATCH /api/tasks/[taskId]` | PATCH is used but 8 sub-operations are bundled via body discriminator; some operations (assign, complete) semantically warrant dedicated sub-resource POST |
| FAIL | `GET /api/tasks/execute`, `POST /api/tasks/execute` | Verb in URL name (`execute`); GET polls but executions resource should be POST-only for creates |
| FAIL | `GET /api/tasks/generate-daily`, `POST /api/tasks/generate-daily` | Verb in URL name (`generate-daily`); non-resource URL |
| FAIL | `GET /api/gateway/[gatewayId]` (sessions, history, status actions) | `?action=sessions` conflates 3 distinct resources; GET for `?action=sessions` is correct but the URL structure is wrong |
| FAIL | `POST /api/gateway/[gatewayId]` (message, provision, sync, validate actions) | 4 distinct POST operations on same URL; each requires a separate resource URL |

### 2. Resource Naming

**PASS criteria:** URLs use nouns (not verbs), plural collections, hierarchical nesting. No action parameters in URL path or query string.

| Rating | Endpoints | Justification |
|--------|-----------|---------------|
| PASS | `/api/agents`, `/api/agents/[agentId]`, `/api/calendar/events`, etc. | Clean noun-based, hierarchical URLs |
| PARTIAL | `/api/agents/[agentId]/heartbeat`, `/api/agents/[agentId]/poll`, `/api/agents/[agentId]/rotate-key` | These are acceptable as sub-resources of agent lifecycle (heartbeat and poll are standard patterns); rotate-key is acceptable as an action sub-resource |
| PARTIAL | `/api/agents/workspace/structure` | Breaks the agent hierarchy — should be `/api/agents/[agentId]/workspace/structure` (agentId is in query param, not path) |
| FAIL | `/api/tasks/execute` | Verb in URL; should be `/api/tasks/executions` (noun) |
| FAIL | `/api/tasks/generate-daily` | Verb in URL; should be `/api/tasks/daily-batches` (noun) |
| FAIL | `GET /api/gateway/[gatewayId]?action=sessions` | Action in query param = RPC-over-HTTP; each action should be a separate sub-resource path |
| FAIL | `POST /api/gateway/[gatewayId]?action=message` | Same issue — 4 POST operations behind `?action=` |

### 3. Statelessness

**PASS criteria:** Each request contains all information the server needs. No server-side session state required (Convex is the backing store, not the concern here).

| Rating | Endpoints | Justification |
|--------|-----------|---------------|
| PASS | All routes except memory | All non-memory routes are stateless; each request carries auth credentials and sufficient parameters |
| FAIL | `GET /api/memory` | Reads `~/.openclaw/workspace/memory` on the local server filesystem. Server must be co-located with the OpenClaw workspace. If server is redeployed or run on a different machine, the endpoint breaks |
| FAIL | `GET /api/memory/files` | Same filesystem dependency as `/api/memory` |

### 4. Response Codes

**PASS criteria:** 201 for creates, 204 for deletes, 400 for validation errors, 401 for auth failures, 403 for authorization failures, 404 for not-found, 409 for conflicts, 429 for rate limits, 500 for server errors.

| Rating | Endpoints | Justification |
|--------|-----------|---------------|
| PASS | Most agent routes, calendar | Correct codes throughout; 201 used for creates |
| PARTIAL | `GET /api/health` | Uses 200 for healthy, 503 for unhealthy — correct but missing `success` field structure |
| PARTIAL | `GET /api/tasks/execute` | Returns 200 for mock stub that doesn't query DB; should probably be 501 Not Implemented |
| PARTIAL | `POST /api/tasks/execute` | Returns 200 on success (not 201) and 500 on execution error when a 424 Failed Dependency might be more precise |
| PARTIAL | `GET /api/tasks/generate-daily` | Returns 200 for mock stub |
| PARTIAL | `POST /api/tasks/generate-daily` | Returns 200 for "no tasks generated" — semantically ambiguous (success or nothing?) |
| PARTIAL | `GET /api/memory` | Returns 500 with `{ files: [] }` on error — should be distinct error shape, not silently masking the error |
| PARTIAL | State engine + reports | Return raw Convex data without wrapping; errors use `{ error, details }` which is acceptable but inconsistent |
| FAIL | `GET /api/gateway/[gatewayId]?action=validate` invalid URL | Returns 200 with `{ success: false, error }` for URL validation failures — should be 400 |

### 5. Auth Standard

**PASS criteria:** Authenticated endpoints use `Authorization: Bearer <token>` per RFC 6750. N/A for endpoints that intentionally require no auth (public endpoints).

| Rating | Endpoints | Justification |
|--------|-----------|---------------|
| N/A | Health, OpenAPI, businesses, epics, tasks/execute, tasks/generate-daily, memory, gateway, state-engine, reports, admin setup/migration | These endpoints have no auth (intentionally or as a gap) |
| PASS | `PATCH /api/agents/[agentId]` (partial — also accepts body), `POST /api/agents/[agentId]/rotate-key` (partial — also accepts body), `POST /api/calendar/events`, `PUT /api/calendar/events/[eventId]`, `GET /api/calendar/slots` | Correctly use `Authorization: Bearer` (though some accept body-based fallback) |
| PARTIAL | `PATCH /api/agents/[agentId]`, `POST /api/agents/[agentId]/rotate-key` | Accept both `Authorization: Bearer` AND `apiKey` in body — dual auth is a migration-period pattern, not final state |
| FAIL | `GET /api/agents` | Uses `agentId` + `agentKey` non-standard header names (not `Authorization: Bearer`) |
| FAIL | `GET /api/agents/[agentId]` | Uses `agentKey` query param (leaks credentials in server logs and browser history) |
| FAIL | `GET /api/agents/[agentId]/tasks` | Uses `agentKey` query param |
| FAIL | `GET /api/agents/[agentId]/tasks/[taskId]` | Uses `agentKey` query param |
| FAIL | `POST /api/agents/[agentId]/tasks/[taskId]/comments` | Uses `agentKey` in request body |
| FAIL | `POST /api/agents/[agentId]/heartbeat` | Uses `agentKey` in request body |
| FAIL | `POST /api/agents/[agentId]/poll` | Uses `agentKey` in request body |
| FAIL | `GET /api/agents/[agentId]/wiki/pages` | Uses `agentKey` query param |
| FAIL | `POST /api/agents/[agentId]/wiki/pages` | Uses `agentKey` query param |
| FAIL | `GET /api/agents/[agentId]/wiki/pages/[pageId]` | Uses `agentKey` query param |
| FAIL | `PATCH /api/agents/[agentId]/wiki/pages/[pageId]` | Uses `agentKey` query param |
| FAIL | `GET /api/agents/workspace/structure` | No auth at all on a filesystem-access endpoint |
| FAIL | `PATCH /api/tasks/[taskId]` (4 state-engine actions) | `escalate`, `reassign`, `unblock`, `mark-executed` have NO auth whatsoever |
| FAIL | `POST /api/tasks/[taskId]/calendar-events` | `agentId` + `agentKey` in request body |
| FAIL | `GET /api/calendar/slots` | `agentId` + `agentKey` in query params |
| FAIL | `POST /api/calendar/events` | `agentId` + `agentKey` in request body |
| FAIL | `PUT /api/calendar/events/[eventId]` | `agentId` + `agentKey` in request body |
| FAIL | `POST /api/admin/agents/setup-workspace` | No auth on admin endpoint — **security gap** |
| FAIL | `POST /api/admin/migrations/agent-workspace-paths` | No auth on migration endpoint — **security gap** |

### 6. Error Consistency

**PASS criteria:** All error responses use Shape A: `{ success: false, error: { code, message }, timestamp }` via `handleApiError()` / `jsonResponse()` from `lib/utils/apiResponse.ts`.

| Rating | Endpoints | Justification |
|--------|-----------|---------------|
| PASS | All agent routes (agents, heartbeat, poll, rotate-key, wiki, tasks, comments, calendar-events) | Consistently use `jsonResponse(handleApiError(error))` or `jsonResponse({ success: false, error: { code, message } }, status)` |
| FAIL | `GET /api/health` | Returns `{ status: "unhealthy", timestamp, error }` — no `success` field, non-standard |
| FAIL | `GET /api/openapi` | Returns `{ error: "Failed to generate..." }` — Shape B |
| FAIL | `GET /api/agents/workspace/structure` | Returns `{ error: "..." }` — Shape B via `NextResponse.json` |
| FAIL | `GET /api/tasks/execute`, `POST /api/tasks/execute` | Returns raw `{ success: false, error: "string" }` (Shape C) and `{ error: "string" }` (Shape B) |
| FAIL | `GET /api/tasks/generate-daily`, `POST /api/tasks/generate-daily` | Mixed: `{ success: false, error: "string" }` (Shape C) |
| FAIL | `GET /api/businesses`, `POST /api/businesses` | Returns `{ success: false, error: error.message }` (Shape C — error is string, not object) |
| FAIL | `GET /api/epics` | Defines local `jsonResponse` function; error returns `{ error: "string" }` (Shape B) |
| FAIL | `GET /api/memory` | Returns `{ files: [] }` on error — completely different shape, not an error response at all |
| FAIL | `GET /api/memory/files` | Returns `{ content, error }` — mixed shape |
| FAIL | `GET /api/memory/context` | Returns `{ relevantSections: [], ... }` on error — same shape as success, no indication of error |
| FAIL | `GET /api/gateway/[gatewayId]`, `POST /api/gateway/[gatewayId]` | Returns `{ error: "string" }` (Shape B) for all error cases |
| FAIL | `GET /api/state-engine/metrics` | Returns `{ error: "...", details: "..." }` (Shape B variant) |
| FAIL | `GET /api/state-engine/decisions` | Same Shape B variant |
| FAIL | `GET /api/state-engine/alerts` | Same Shape B variant |
| FAIL | `GET /api/reports`, `POST /api/reports` | Returns `{ error: "string" }` (Shape B) and `{ success: false, error: "string" }` (Shape C mixed) |

---

## FAIL/PARTIAL Count Summary

| Dimension | FAIL Count | PARTIAL Count |
|-----------|-----------|---------------|
| HTTP Verb Correctness | 6 operations | 1 |
| Resource Naming | 8 operation groups | 3 |
| Statelessness | 2 endpoints | 0 |
| Response Codes | 5 endpoints | 9 |
| Auth Standard | 19 operations | 2 |
| Error Consistency | 16 operation groups | 0 |

---

## Richardson Maturity Level by Domain

| Domain | Current Level | Primary Blocker |
|--------|--------------|-----------------|
| Health | Level 2 | Response shape inconsistency only |
| OpenAPI | Level 2 | Error shape only |
| Agents (core CRUD) | Level 2 | Auth not RFC 6750 |
| Agents (heartbeat, poll, wiki) | Level 1-2 | Auth pattern; some verb-style sub-paths |
| Tasks (PATCH [taskId]) | Level 1 | Action discriminator in body; 4 operations lack auth |
| Tasks (execute, generate-daily) | Level 0 | Verb in URL; no auth; RPC-style naming |
| Tasks (calendar-events) | Level 2 | Auth via body |
| Businesses | Level 2 | No auth (by design?); error shape |
| Epics | Level 2 | No auth; duplicate jsonResponse; error shape |
| Calendar | Level 2 | Auth via body/query param |
| Memory | Level 0 | Filesystem coupling (stateful); no auth |
| Gateway | Level 0 | `?action=` anti-pattern; no auth; error shape |
| State Engine | Level 2 | No auth; error shape |
| Reports | Level 2 | No auth; error shape |
| Admin | Level 2 | No auth (CRITICAL security gap) |
