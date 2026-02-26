# Mission Control API Refactoring Roadmap

**Date:** 2026-02-26
**Based on:** API-AUDIT-REPORT.md, REST-COMPLIANCE-MATRIX.md, STANDARDIZATION-RECOMMENDATIONS.md
**Scope:** All 42 HTTP operations across 11 domains — REST standardization and security hardening

This document translates audit findings into a prioritized, phased implementation plan.
It is a work breakdown, not a narrative. Each section maps to concrete implementation tasks
that can be converted to Jira/Linear tickets.

---

## 1. Executive Summary

**Current state:** Mission Control exposes 42 HTTP operations across 32 route files. Richardson Maturity Level distribution: ~5% at Level 0 (gateway ?action= anti-pattern), ~25% at Level 1 (resources defined, wrong verbs), ~70% at Level 2 (correct HTTP verbs and status codes). Six CRITICAL violations exist: two admin endpoints with no authentication, one gateway endpoint using the Level 0 ?action= anti-pattern, fifteen endpoints with deprecated non-RFC-6750 auth patterns, twelve endpoints returning non-standard error shapes, and one missing auth guard on the workspace structure endpoint.

**Target state:** All 42 operations at Richardson Level 2 with standardized auth (`Authorization: Bearer` per RFC 6750), consistent error shapes (Shape A: `{ success, error: { code, message }, timestamp }`), resource-oriented URLs (no verb-in-URL anti-patterns), and auth guards on all non-public endpoints. The OpenAPI spec generated from Zod schemas (implemented in Plan 01.1-02) will replace the hand-written 1300-line generator.

**Scope:** This roadmap covers REST standardization changes only. Deferred items include: HATEOAS/Level 3 (permanently deferred — no benefit for machine-to-machine API), API versioning (no external consumers), and memory endpoint filesystem-to-Convex migration (Phase 5+). All changes are backward-compatible except those explicitly marked BREAKING.

---

## 2. Phase 1 Recommendations (Data Foundation Integration)

Work that should be done alongside Phase 1 schema work because it affects the same files or establishes patterns all subsequent work depends on.

### Phase 1.1 — Immediate Security & Standardization

**These should be completed before any other Phase 1 work proceeds.**

#### Task R-01: Add Auth Guards to Admin Endpoints (CRITICAL) — covers NB-01

Both admin endpoints are publicly accessible with no authentication. Anyone with network access to the server can reset agent workspace paths or run DB migrations.

**Implementation:**
```typescript
// Add to top of each handler:
const adminKey = request.headers.get("Authorization")?.slice(7);
if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
  return jsonResponse(
    { success: false, error: { code: "UNAUTHORIZED", message: "Admin access required" }, timestamp: Date.now() },
    401
  );
}
```

**Files:**
- `frontend/src/app/api/admin/agents/setup-workspace/route.ts`
- `frontend/src/app/api/admin/migrations/agent-workspace-paths/route.ts`

**Environment variable:** Add `ADMIN_API_KEY` to `.env.local` and deployment secrets.

---

#### Task R-02: Add Auth Guard to Workspace Structure Endpoint — extends NB-01

`GET /api/agents/workspace/structure` reads the agent's filesystem with no auth. Any request can trigger filesystem reads.

**Implementation:** Validate `agentId` query param against a stored agent key before serving filesystem data. This endpoint's URL structure is non-standard (agentId in query, not path) — consider moving to `/api/agents/{agentId}/workspace/structure` in Phase 1.2 (see R-14).

---

#### Task R-03: Standardize Error Response Shape (Shape B and C → Shape A) — covers NB-02

12 files use Shape B (`{ error: "string" }`) and 3 files use Shape C (`{ success: false, error: "string" }`). Replace all with Shape A via `handleApiError()` from `lib/utils/apiResponse.ts`.

**Per-file changes:**

| File | Current Pattern | Fix |
|------|----------------|-----|
| `api/openapi/route.ts` | `JSON.stringify({ error: "..." })` | `const [e, s] = handleApiError(error); return jsonResponse(e, s);` |
| `api/agents/workspace/structure/route.ts` | `NextResponse.json({ error: "..." }, { status: N })` | Replace with `jsonResponse(...)` from `lib/utils/apiResponse` |
| `api/tasks/execute/route.ts` | `new Response(JSON.stringify({ error: "..." }))` | Use `handleApiError()` in catch |
| `api/gateway/[gatewayId]/route.ts` | `JSON.stringify({ error: "..." })` in all 7 handlers | Add `import { jsonResponse, handleApiError }` + update all returns |
| `api/state-engine/metrics/route.ts` | `Response.json({ error, details })` | `const [e, s] = handleApiError(error); return jsonResponse(e, s);` |
| `api/state-engine/decisions/route.ts` | Same pattern | Same fix |
| `api/state-engine/alerts/route.ts` | Same pattern | Same fix |
| `api/reports/route.ts` | `new Response(JSON.stringify({ error: "..." }))` | Use `handleApiError()` |
| `api/epics/route.ts` | Local `jsonResponse({ error: "..." })` | Remove local function; import from `lib/utils/apiResponse` |
| `api/memory/route.ts` | `NextResponse.json({ files: [] }, { status: 500 })` | Return actual error shape on 500 |
| `api/memory/files/route.ts` | `NextResponse.json({ content: '' })` on errors | Return `jsonResponse(errorResponse(...), 500)` |
| `api/businesses/route.ts` | `{ success: false, error: error?.message }` | Change `error` to `{ code: "...", message: error?.message }` |
| `api/tasks/generate-daily/route.ts` | `{ success: false, error: "string" }` | Use `handleApiError()` in catch |

**Non-breaking:** Agent clients receive new fields they previously ignored. Clients reading `error.message` must update to `error.error.message` — but only error paths, not happy path.

---

#### Task R-04: Remove Local `jsonResponse` Duplicate in Epics Route — covers NB-03

`api/epics/route.ts` defines its own local `jsonResponse` function that duplicates and diverges from `lib/utils/apiResponse.ts`. Remove it.

```typescript
// Remove:
function jsonResponse(data: unknown, status?: number) { ... }  // ~6 lines

// Add import:
import { jsonResponse, successResponse, handleApiError } from "@/lib/utils/apiResponse";
```

Also fix the non-standard success shape: wrap `{ epics: [...] }` in `successResponse()` so it returns `{ success: true, data: { epics: [...] } }`.

---

#### Task R-05: Wire New OpenAPI Generator to `/api/openapi` Route — covers NB-04 + NB-05

The `frontend/lib/openapi/spec-generator.ts` created in Plan 01.1-02 is a drop-in replacement for `lib/openapi-generator.ts`. Wire it to the route handler.

```typescript
// frontend/src/app/api/openapi/route.ts — change import:
import { generateOpenAPISpec } from "@/lib/openapi/spec-generator";  // was: @/lib/openapi-generator
```

After wiring, the old `lib/openapi-generator.ts` can be archived or deleted. The new generator produces a more accurate spec aligned with actual Zod validators.

---

#### Task R-06: Add `X-Request-Id` Middleware — covers NB-07

All responses should include `X-Request-Id` for traceability. Currently only `POST /api/agents/{agentId}/rotate-key` adds this header.

**Implementation:**
```typescript
// Create: frontend/middleware.ts
import { NextResponse, type NextRequest } from "next/server";
export function middleware(request: NextRequest) {
  const requestId = request.headers.get("X-Request-Id") || crypto.randomUUID();
  const response = NextResponse.next();
  response.headers.set("X-Request-Id", requestId);
  return response;
}
export const config = { matcher: "/api/:path*" };
```

---

### Phase 1.2 — Auth Standardization

#### Task R-07: Implement `extractAgentAuth()` Grace Period Helper — foundation for B-01

Create a utility that accepts both old (deprecated) and new (standard) auth formats. This is the foundation for the two-phase auth migration.

**Implementation:**
```typescript
// Create: frontend/lib/utils/extractAgentAuth.ts
export function extractAgentAuth(
  request: Request,
  agentIdFromPath?: string
): { agentId: string; agentKey: string } | null {
  // Standard: Authorization: Bearer <key>
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    if (!agentIdFromPath) return null;
    return { agentId: agentIdFromPath, agentKey: authHeader.slice(7) };
  }

  // Deprecated: query param
  const url = new URL(request.url);
  const queryKey = url.searchParams.get("agentKey");
  if (queryKey && agentIdFromPath) {
    console.warn("[DEPRECATED] agentKey query param: use Authorization: Bearer instead");
    return { agentId: agentIdFromPath, agentKey: queryKey };
  }

  // Deprecated: custom header
  const headerKey = request.headers.get("agentKey");
  const headerId = request.headers.get("agentId");
  if (headerKey && (agentIdFromPath || headerId)) {
    console.warn("[DEPRECATED] agentKey/agentId headers: use Authorization: Bearer instead");
    return { agentId: agentIdFromPath || headerId!, agentKey: headerKey };
  }

  return null;
}
```

---

#### Task R-08: Migrate Auth — Group A: `agentKey` Query Param Endpoints (8 endpoints) — B-01 Group A

Replace direct `url.searchParams.get("agentKey")` calls with `extractAgentAuth()`. Deprecation warnings are logged automatically.

**Files to update:**
- `api/agents/[agentId]/route.ts` (GET handler)
- `api/agents/[agentId]/tasks/route.ts`
- `api/agents/[agentId]/tasks/[taskId]/route.ts`
- `api/agents/[agentId]/wiki/pages/route.ts` (GET handler)
- `api/agents/[agentId]/wiki/pages/route.ts` (POST handler)
- `api/agents/[agentId]/wiki/pages/[pageId]/route.ts` (GET handler)
- `api/agents/[agentId]/wiki/pages/[pageId]/route.ts` (PATCH handler)
- `api/calendar/slots/route.ts`

---

#### Task R-09: Migrate Auth — Group B: `agentId`/`agentKey` Custom Header Endpoint (1 endpoint) — B-01 Group B

`GET /api/agents` uses non-standard `agentId` and `agentKey` headers. Migrate to `extractAgentAuth()`.

**File:** `api/agents/route.ts` (GET handler)

---

#### Task R-10: Migrate Auth — Group C: `agentKey` in Request Body (6 endpoints) — B-01 Group C

These endpoints parse the body before auth — wrong order (auth should be stateless, not require body parsing). After migration, auth is extracted from the header before body is parsed.

**Files to update:**
- `api/agents/[agentId]/heartbeat/route.ts`
- `api/agents/[agentId]/poll/route.ts`
- `api/agents/[agentId]/tasks/[taskId]/comments/route.ts`
- `api/tasks/[taskId]/calendar-events/route.ts`
- `api/calendar/events/route.ts`
- `api/calendar/events/[eventId]/route.ts`

**For POST-with-body endpoints:** Extract Bearer header first, fall back to body parsing only if header is absent (grace period behavior). Log deprecation when body fallback is used.

---

#### Task R-11: Add Pagination Meta to Unbounded List Endpoints (5 endpoints) — covers NB-06

Add `limit`/`offset` query params and `meta` field to list endpoints that currently return unbounded arrays.

**Standard shape to add to each:**
```json
{
  "data": {
    "items": [...],
    "meta": { "limit": 50, "offset": 0, "hasMore": false }
  }
}
```

**Endpoints to update:**
- `GET /api/agents` — add `limit`/`offset` query params + `meta` in response
- `GET /api/epics` — add pagination (fix non-standard shape simultaneously)
- `GET /api/state-engine/decisions` — already has `limit` param; add `meta` to response
- `GET /api/state-engine/alerts` — add `limit`/`offset` + `meta`
- `GET /api/agents/{agentId}/wiki/pages` — add pagination

**Note:** Omit `total` count — Convex does not support cheap `COUNT(*)`. `hasMore` is sufficient.

---

## 3. Phase 2 Recommendations (Workflow Definition)

Work that aligns with Phase 2 because it affects workflow-related endpoints or decisions made in Phase 2 affect URL structure.

### Phase 2.1 — Task URL Renames

#### Task R-12: Rename Task Verb URLs to Resource-Oriented URLs — covers B-03

Two task endpoints use verbs in their URLs — a known anti-pattern.

**Breaking changes (with redirect grace period):**

| Current URL | New URL | Notes |
|-------------|---------|-------|
| `POST /api/tasks/execute` | `POST /api/tasks/executions` | Verb → noun (resource collection) |
| `GET /api/tasks/execute?executionId=X` | `GET /api/tasks/executions/{executionId}` | New sub-resource route file needed |
| `GET /api/tasks/generate-daily` | `GET /api/tasks/daily-batches` | Verb → noun |
| `POST /api/tasks/generate-daily` | `POST /api/tasks/daily-batches` | Verb → noun |

**Files to create:**
- `frontend/src/app/api/tasks/executions/route.ts`
- `frontend/src/app/api/tasks/executions/[executionId]/route.ts`
- `frontend/src/app/api/tasks/daily-batches/route.ts`

**Files to update (redirect):**
- `frontend/src/app/api/tasks/execute/route.ts` — return 301 to `/api/tasks/executions`
- `frontend/src/app/api/tasks/generate-daily/route.ts` — return 301 to `/api/tasks/daily-batches`

**Coordinate with Phase 2 execution engine work** since `execute` is partially mocked (HTTP dispatch disabled). The rename and real implementation can happen together.

---

### Phase 2.2 — Auth for Business-Domain Endpoints

#### Task R-13: Evaluate Auth on Business/Reports/Epics/State Engine Endpoints

Currently these domains are completely public. Before Phase 2 execution work adds new endpoints in the same domains, decide the auth strategy.

**Recommended approach:** Add workspace-scoped auth (check that caller has access to the requested workspaceId). This prevents cross-workspace data leakage if Mission Control is ever multi-tenant.

**Endpoints affected:** `GET /api/businesses`, `POST /api/businesses`, `GET /api/epics`, `GET /api/reports`, `POST /api/reports`, `GET /api/state-engine/*` (3 endpoints).

---

## 4. Phase 3 Recommendations (Execution Engine)

Work that must happen during Phase 3 because the gateway is redesigned and these changes align with execution engine architecture.

### Phase 3.1 — Gateway Sub-Route Decomposition

#### Task R-14: Decompose Gateway `?action=` Anti-Pattern into Sub-Routes — covers B-02

The gateway endpoint is the most severe REST violation — 7 operations tunneled through `?action=` parameter (Richardson Level 0). This is a breaking change requiring rewriting 70+ tests.

**Breaking change (atomic cutover — no grace period needed since internal UI-only):**

| Current URL | New Route File | Method |
|-------------|---------------|--------|
| `GET /api/gateway/[gatewayId]` (status/default) | `api/gateway/[gatewayId]/route.ts` (keep, simplify) | GET |
| `GET /api/gateway/[gatewayId]?action=sessions` | `api/gateway/[gatewayId]/sessions/route.ts` | GET |
| `GET /api/gateway/[gatewayId]?action=history` | `api/gateway/[gatewayId]/sessions/[sessionKey]/history/route.ts` | GET |
| `POST /api/gateway/[gatewayId]?action=message` | `api/gateway/[gatewayId]/sessions/[sessionKey]/messages/route.ts` | POST |
| `POST /api/gateway/[gatewayId]?action=provision` | `api/gateway/[gatewayId]/provision/route.ts` | POST |
| `POST /api/gateway/[gatewayId]?action=sync` | `api/gateway/[gatewayId]/sync/route.ts` | POST |
| `POST /api/gateway/[gatewayId]?action=validate` | `api/gateway/[gatewayId]/validate/route.ts` | POST |

**Files to create (7 new route files):** See URL table above.
**Files to update:** Remove `?action=` dispatch from current `api/gateway/[gatewayId]/route.ts`; update 70+ tests to use new paths.

**Do NOT implement before Phase 3.** The test migration alone is significant, and the gateway architecture will change in Phase 3 anyway.

---

### Phase 3.2 — Task Action Discriminator Decomposition

#### Task R-15: Decompose State-Engine Task Actions to Sub-Resource URLs — covers B-04

Four of the eight actions in `PATCH /api/tasks/[taskId]` are state-engine operations (escalate, reassign, unblock, mark-executed) that have no auth and represent state transitions, not data updates. These should be separate endpoints.

**Breaking change:**

| Current Action | New URL | Method | Notes |
|---------------|---------|--------|-------|
| `action: "escalate"` | `POST /api/tasks/{taskId}/escalations` | POST | State transition endpoint |
| `action: "reassign"` | `POST /api/tasks/{taskId}/reassignments` | POST | State transition endpoint |
| `action: "unblock"` | `DELETE /api/tasks/{taskId}/blockers` | DELETE | Removes blocked state |
| `action: "mark-executed"` | `POST /api/tasks/{taskId}/executions` | POST | State transition endpoint |

**Remaining in PATCH (keep):** `assign`, `complete`, `update-status`, `update-tags` — these are resource updates, discriminator pattern is acceptable.

**Auth:** New sub-resource endpoints must have proper auth. Current escalate/reassign/unblock/mark-executed accept any `decidedBy` string with zero verification.

**Coordinate with Phase 3 state engine modeling** — these are state engine operations that will be formally modeled in Phase 3.

---

### Phase 3.3 — Auth for State Engine Sub-Resources

#### Task R-16: Add Auth to New State-Engine Sub-Resource Endpoints

When R-15 creates new endpoints for state-engine operations, those endpoints must have auth guards. Since the state engine may run autonomously, consider a service-account token or dedicated state-engine API key rather than per-agent auth.

**Decision needed (Phase 3):** Should state-engine operations require human/admin auth, or accept a service-account token?

---

## 5. Deferred (Post-v1)

These items were evaluated and explicitly deferred. They should NOT be implemented unless the decision trigger occurs.

### DEFER-01: API Versioning

**Decision:** Never implement until external consumers exist.

**Trigger:** Mission Control exposes a public API to external third parties, OR agents are deployed externally and cannot restart simultaneously with a server update.

**Current state:** Zero external consumers. All callers (agents + UI) are in the same monorepo — atomic updates are possible.

---

### DEFER-02: HATEOAS (Richardson Level 3)

**Decision:** Permanently deferred.

**Reason:** Agent clients are autonomous processes that use spec-driven API access, not browsers navigating links. Level 3 adds response payload overhead and schema complexity with zero benefit for machine-to-machine APIs.

---

### DEFER-03: Memory Endpoint Filesystem → Convex DB

**Decision:** Deferred to Phase 5+.

**Trigger:** Memory endpoints need to be production-ready or accessed from remote servers.

**Interim:** Tag memory endpoints as `x-development-only: true` in OpenAPI spec (done in Plan 01.1-02 spec generator). Exclude from production deployment.

---

### DEFER-04: RFC 9457 Problem Details Format

**Decision:** Permanently deferred.

**Reason:** Existing Shape A (`{ success, error: { code, message } }`) is already well-typed and provides machine-readable error discrimination via `code`. Migrating to RFC 9457 is a breaking change affecting all agent error handling with no functional benefit.

---

## 6. Implementation Task Table

All 16 concrete implementation tasks. Rows are sorted by recommended execution order within each phase.

| # | Task | ID | Type | Priority | Effort | Breaking | Recommended Phase | Files Affected | Dependencies |
|---|------|----|------|----------|--------|----------|-------------------|----------------|--------------|
| 1 | Add auth guards to admin endpoints | R-01 | Security | CRITICAL | Low (1 day) | No | Phase 1.1 (immediately) | 2 route files | None |
| 2 | Add auth to workspace/structure endpoint | R-02 | Security | HIGH | Low (0.5 day) | No | Phase 1.1 | 1 route file | None |
| 3 | Standardize error shapes (Shape B/C → A) | R-03 | Non-breaking | HIGH | Low (2 days) | No | Phase 1.1 | 13 route files | None |
| 4 | Remove local jsonResponse in epics | R-04 | Non-breaking | HIGH | Low (0.5 day) | No | Phase 1.1 | 1 route file | R-03 |
| 5 | Wire new OpenAPI generator to /api/openapi | R-05 | Non-breaking | HIGH | Low (0.5 day) | No | Phase 1.1 | 1 route file | Plan 01.1-02 |
| 6 | Add X-Request-Id middleware | R-06 | Non-breaking | MEDIUM | Low (0.5 day) | No | Phase 1.1/1.2 | 1 new file | None |
| 7 | Implement extractAgentAuth() helper | R-07 | Non-breaking | HIGH | Low (1 day) | No | Phase 1.2 | 1 new file | None |
| 8 | Migrate auth: query param endpoints (8) | R-08 | Breaking (auth) | HIGH | Medium (2 days) | Yes | Phase 1.2 | 8 route files | R-07 |
| 9 | Migrate auth: custom header endpoint (1) | R-09 | Breaking (auth) | HIGH | Low (0.5 day) | Yes | Phase 1.2 | 1 route file | R-07 |
| 10 | Migrate auth: body auth endpoints (6) | R-10 | Breaking (auth) | HIGH | Medium (2 days) | Yes | Phase 1.2 | 6 route files | R-07 |
| 11 | Add pagination meta to list endpoints | R-11 | Non-breaking | MEDIUM | Medium (2 days) | No | Phase 1.2 | 5 route files | None |
| 12 | Rename task verb URLs | R-12 | Breaking (URL) | MEDIUM | Medium (2 days) | Yes | Phase 2 | 3 new + 2 redirect files | Phase 2 plan |
| 13 | Evaluate auth for business-domain endpoints | R-13 | Decision | MEDIUM | Low (0.5 day) | TBD | Phase 2 | 7 route files | Phase 2 design |
| 14 | Decompose gateway ?action= anti-pattern | R-14 | Breaking (URL) | HIGH | High (5 days) | Yes | Phase 3 | 7 new route files + 70+ tests | Phase 3 gateway redesign |
| 15 | Decompose state-engine task actions | R-15 | Breaking (URL/auth) | MEDIUM | Medium (3 days) | Yes | Phase 3 | 4 new route files | Phase 3 state engine |
| 16 | Add auth to new state-engine sub-resources | R-16 | Security | HIGH | Low (1 day) | No | Phase 3 | 4 new route files | R-15 |

**Total effort estimate:** ~25 developer-days across 3 phases

---

## 7. Migration Patterns

### Auth Migration Pattern (R-07 through R-10): Grace Period

Used for tasks R-08, R-09, R-10 — transitioning from deprecated auth forms to `Authorization: Bearer`.

**Phase A — Grace Period (~2 weeks, deployed first):**
- Implement `extractAgentAuth()` utility (R-07) that accepts both old and new auth
- Replace direct auth checks in all 15 endpoints with `extractAgentAuth()`
- Deprecation warnings are logged (not returned to caller)
- All existing agent clients continue to work without changes

**Phase B — Remove Deprecated Forms (after 2 weeks):**
- Remove query param, body, and custom header auth fallbacks from `extractAgentAuth()`
- All callers must use `Authorization: Bearer <agentKey>`
- Monitor deprecation warning logs before Phase B to ensure all agents have migrated

**Rollback strategy:** If Phase B causes failures, revert `extractAgentAuth()` to accept old forms again (one-line change per endpoint to re-enable fallback).

**Test requirements before Phase B cutover:**
- All agent integration tests pass with `Authorization: Bearer` only
- Zero deprecation warnings logged in staging for 24 hours

---

### Gateway Migration Pattern (R-14): Atomic Cutover

Used for Task R-14 — gateway is internal UI-only API, no external consumers.

**No grace period needed** (unlike auth migration). The Mission Control UI and all callers are in the same monorepo.

**Steps:**
1. Create 7 new route files (new sub-routes)
2. Update all UI components that call gateway API (BrainHub, AgentCards, etc.) to use new URLs
3. Update all 70+ gateway tests to use new route structure
4. Atomic deployment: new routes + updated UI + new tests all deployed together
5. Remove `?action=` dispatch from old `api/gateway/[gatewayId]/route.ts`

**Rollback strategy:** Keep old `?action=` dispatch code behind a feature flag for 1 sprint. Remove after verified stable.

**Test requirements before cutover:**
- All 70+ gateway tests pass against new route structure
- Manual verification: BrainHub loads correctly and shows agent sessions/history

---

### URL Migration Pattern (R-12): Redirect + Atomic Cutover

Used for Task R-12 — task URL renames.

**Steps:**
1. Create new route files (`/api/tasks/executions/*`, `/api/tasks/daily-batches/*`)
2. Update old route files to return `301 Moved Permanently` to new URLs
3. Update all UI callers to use new URLs
4. Monitor redirect logs for 2 weeks
5. Remove old route files after 2 weeks

**Why redirect (not atomic):** Task execute and generate-daily are called from multiple UI components. A 2-week redirect grace period catches any missed callers.

**Rollback strategy:** Revert redirect to serving the handler again — no data loss possible (URL change only).

---

## 8. Risk Assessment

### Risk 1: Auth Migration (R-08 through R-10) — HIGH RISK

**Risk:** Autonomous agents running continuously (no restart) may miss the Phase B cutover window. Agents that don't update before Phase B is deployed will fail authentication.

**Mitigation:**
- Phase A logs deprecation warnings with timestamp — monitor logs to know which agents are still using old auth
- Coordinate Phase B deployment with agent restart cycle (agents typically restart on new task assignment)
- Keep Phase A in production for at least 2 weeks (one typical sprint cycle)
- Do NOT deploy Phase B during a period of high agent activity

**Rollback:** Re-enable deprecated auth forms in `extractAgentAuth()` — single commit, deployable in minutes.

---

### Risk 2: Gateway Decomposition (R-14) — HIGH RISK

**Risk:** 70+ tests must be rewritten. High probability of regression if test migration is incomplete.

**Mitigation:**
- Write new tests BEFORE creating new route files (TDD approach)
- Use old route handler code as reference — just change URL paths, not handler logic
- Do NOT delete old handler until all new tests pass
- Feature flag: keep `?action=` dispatch active alongside new routes during testing phase

**Rollback:** Old `?action=` dispatch code re-enabled via feature flag. New route files are additive — no data loss.

---

### Risk 3: Error Shape Standardization (R-03) — LOW RISK

**Risk:** Agent clients that parse error responses will receive new fields (`code`, `timestamp`). Clients checking `error.message` must check `error.error.message` instead.

**Impact:** Only error paths, not happy paths. Most agents check for HTTP status codes, not error body structure.

**Mitigation:** Search codebase for `error.message` access after API error responses. Update before deploying R-03.

**Rollback:** Revert individual route files — each is independent. If one file's change causes issues, revert that file only.

---

### Risk 4: Admin Endpoint Auth (R-01) — MEDIUM RISK (for deployment)

**Risk:** Adding auth to admin endpoints may break existing admin scripts or deployment automation that calls these endpoints without credentials.

**Mitigation:**
- Search codebase and deployment scripts for calls to `POST /api/admin/*` before implementing
- Set `ADMIN_API_KEY` environment variable in all environments before deploying R-01
- Test with `curl -H "Authorization: Bearer <key>" POST /api/admin/...` in staging first

**Rollback:** Remove auth check from admin routes — single commit.

---

### Risk 5: Task URL Renames (R-12) — LOW RISK (for production)

**Risk:** Missing a caller that uses the old URL before redirect grace period ends.

**Mitigation:**
- Search frontend codebase for all uses of `/api/tasks/execute` and `/api/tasks/generate-daily` before implementing
- Use 301 redirects for 2 weeks to catch any missed callers via server logs
- Note: `tasks/execute` is partially a stub (HTTP dispatch disabled), so low usage in production

**Rollback:** Remove redirect; restore old route handler directly.

---

*Document generated from API-AUDIT-REPORT.md, REST-COMPLIANCE-MATRIX.md, and STANDARDIZATION-RECOMMENDATIONS.md*
*Phase: 01.1-rest-api-analysis | Plan: 02 | Date: 2026-02-26*
