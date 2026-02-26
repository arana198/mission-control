# Standardization Recommendations

**Date:** 2026-02-26
**Based on:** API-AUDIT-REPORT.md, REST-COMPLIANCE-MATRIX.md
**Scope:** All FAIL and PARTIAL ratings in the compliance matrix

Every FAIL or PARTIAL in the compliance matrix has a corresponding recommendation below. Breaking changes are clearly separated from non-breaking changes.

---

## 1. Non-Breaking Changes

Safe to deploy immediately. These changes are additive or substitute an equivalent behavior without changing URL paths or auth contracts.

### NB-01: Add Auth Guards to Admin Endpoints

**What to change:** Add authentication to `POST /api/admin/agents/setup-workspace` and `POST /api/admin/migrations/agent-workspace-paths`. These endpoints currently have no auth guard whatsoever — anyone with network access can reset agent workspace paths or run DB migrations.

**Files affected:**
- `frontend/src/app/api/admin/agents/setup-workspace/route.ts`
- `frontend/src/app/api/admin/migrations/agent-workspace-paths/route.ts`

**Effort:** Low — add `Authorization: Bearer <admin-token>` check at the top of each handler. An environment variable `ADMIN_API_KEY` checked against the header is sufficient for now.

**Implementation notes:**
```typescript
const adminKey = request.headers.get("Authorization")?.slice(7);
if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
  return jsonResponse({ success: false, error: { code: "UNAUTHORIZED", message: "Admin access required" } }, 401);
}
```

**Priority:** CRITICAL — deploy before any other change.

---

### NB-02: Standardize Error Response Shape (Shape B and C routes)

**What to change:** Replace all Shape B (`{ error: "string" }`) and Shape C (`{ success: false, error: "string" }`) error responses with Shape A (`{ success: false, error: { code, message }, timestamp }`). The `handleApiError()` utility in `lib/utils/apiResponse.ts` already does this — it is simply not used consistently.

**Files affected (Shape B — raw `{ error: "..." }`):**
- `frontend/src/app/api/openapi/route.ts` — error in catch: `{ error: "Failed to generate..." }`
- `frontend/src/app/api/agents/workspace/structure/route.ts` — all error returns use `NextResponse.json({ error: "..." })`
- `frontend/src/app/api/tasks/execute/route.ts` — error returns use `new Response(JSON.stringify({ error: "..." }))`
- `frontend/src/app/api/reports/route.ts` — all error returns use raw `new Response(JSON.stringify({ error: "..." }))`
- `frontend/src/app/api/epics/route.ts` — error returns use local `jsonResponse({ error: "..." })` (Shape B)
- `frontend/src/app/api/gateway/[gatewayId]/route.ts` — all 7 action error paths use `{ error: "..." }`
- `frontend/src/app/api/state-engine/metrics/route.ts` — `{ error, details }` shape
- `frontend/src/app/api/state-engine/decisions/route.ts` — same
- `frontend/src/app/api/state-engine/alerts/route.ts` — same
- `frontend/src/app/api/memory/route.ts` — swallows error silently (returns `{ files: [] }`)
- `frontend/src/app/api/memory/files/route.ts` — mixed `{ content, error }` shape

**Files affected (Shape C — `{ success: false, error: "string" }`):**
- `frontend/src/app/api/businesses/route.ts` — `{ success: false, error: error?.message }` (string, not object)
- `frontend/src/app/api/tasks/generate-daily/route.ts` — mixed: `{ success: false, error: "string" }` on errors

**For each file:** Replace the raw error pattern with `import { jsonResponse, handleApiError } from "@/lib/utils/apiResponse"` and wrap catch blocks with `const [errData, status] = handleApiError(error); return jsonResponse(errData, status);`.

**Effort:** Low — mechanical change. 12 files, ~2-4 lines each.

**Note:** This is non-breaking because agent clients that parse JSON responses will receive new fields (`code`, `timestamp`) they previously ignored. Clients checking for `error.message` must be updated to check `error.error.message` — but this only affects agent clients reading error bodies, not the happy path.

---

### NB-03: Fix Epics Route — Remove Local `jsonResponse` Copy

**What to change:** `frontend/src/app/api/epics/route.ts` defines its own local `jsonResponse` function at line 20. This duplicates `lib/utils/apiResponse.ts` and uses a different implementation that returns Shape B errors.

**Files affected:**
- `frontend/src/app/api/epics/route.ts`

**What to do:** Remove the local function and `import { jsonResponse, successResponse, handleApiError } from "@/lib/utils/apiResponse"`. Wrap the response in `successResponse({ epics: formatted })` to standardize the success shape.

**Effort:** Low — 1 file, ~10 lines.

**Also fix:** The success response `{ success: true, epics: [...], message: "..." }` is non-standard — epics should be wrapped in `data` per `ApiSuccessResponse<T>`. Change to: `jsonResponse(successResponse({ epics: formatted, message: "..." }))`.

---

### NB-04: Add `zod-openapi` Annotations to Existing Validators

**What to change:** Annotate existing Zod schemas in `frontend/lib/validators/` with `.openapi()` metadata. The `zod-openapi` package (v5.4.6) is already installed. This is purely additive — `.openapi()` adds documentation metadata without changing validation behavior.

**Files affected:**
- `frontend/lib/validators/agentValidators.ts` — `RegisterAgentSchema`, `UpdateAgentSchema`, `HeartbeatSchema`, `PollAgentSchema`, `RotateKeySchema`
- `frontend/lib/validators/agentTaskValidators.ts` — `QueryTasksSchema`, `GetTaskDetailsSchema`, `AddCommentSchema`
- `frontend/lib/validators/agentWorkspaceValidators.ts` — any schemas present

**Effort:** Medium — annotate ~10 schemas with examples and descriptions.

**Example (additive only, zero behavior change):**
```typescript
export const RegisterAgentSchema = z.object({
  name: z.string().min(2).max(50).openapi({ description: "Agent display name", example: "Atlas" }),
  role: z.string().openapi({ description: "Agent role description", example: "Backend Engineer" }),
  level: z.enum(["lead", "specialist", "intern"]).openapi({ example: "lead" }),
  // ... rest of fields
}).openapi({ ref: "RegisterAgentRequest" });
```

---

### NB-05: Replace Hand-Written `openapi-generator.ts` with `zod-openapi` Generation

**What to change:** Replace `frontend/lib/openapi-generator.ts` (1300+ lines of hand-written JSON) with a `zod-openapi` registry-based generator. The `/api/openapi` endpoint URL stays the same; only the internal generation changes.

**Files affected:**
- `frontend/lib/openapi-generator.ts` — replace implementation
- `frontend/src/app/api/openapi/route.ts` — update import if function name changes

**Effort:** Medium — requires setting up `OpenApiGeneratorV3` registry, registering all schemas and paths. Existing schemas from NB-04 become the source of truth.

**Benefit:** The spec stays automatically in sync with Zod validators. No more manual updates when fields change.

**Implementation approach:**
1. Create `frontend/lib/openapi-registry.ts` — registers all schemas and paths using `OpenApiGeneratorV3`
2. Update `lib/openapi-generator.ts` to call the registry generator
3. The `/api/openapi` endpoint is unchanged from the caller's perspective

---

### NB-06: Add Pagination `meta` to Unbounded List Endpoints

**What to change:** Currently only `GET /api/agents/[agentId]/tasks` has pagination. All other list endpoints return unbounded arrays. Add `limit`/`offset` query params and `meta` response fields to:
- `GET /api/agents` — returns full agents list
- `GET /api/agents/[agentId]/wiki/pages` — returns full wiki tree
- `GET /api/epics` — returns all epics
- `GET /api/state-engine/decisions` — returns all decisions (already has `limit` param in query but doesn't expose it in response meta)
- `GET /api/state-engine/alerts` — returns all alert rules

**Standard response shape:**
```json
{
  "success": true,
  "data": {
    "items": [...],
    "meta": {
      "limit": 50,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

**Effort:** Medium — 5 endpoints, ~10-15 lines each. Note: omit `total` count for Convex-backed endpoints (Convex does not support cheap `COUNT(*)` — computing total requires iterating all records).

---

### NB-07: Add `X-Request-Id` Header via Middleware

**What to change:** Currently only `POST /api/agents/[agentId]/rotate-key` adds `X-Request-Id` to responses. All responses should include this for traceability.

**Files affected:**
- `frontend/middleware.ts` (create if not exists) — add `X-Request-Id` header to all responses

**Effort:** Low — single middleware file.

```typescript
// frontend/middleware.ts
import { NextResponse } from "next/server";
export function middleware(request: NextRequest) {
  const requestId = request.headers.get("X-Request-Id") || crypto.randomUUID();
  const response = NextResponse.next();
  response.headers.set("X-Request-Id", requestId);
  return response;
}
```

---

## 2. Breaking Changes

These changes modify URL paths, auth contracts, or request/response shapes in ways that will break existing agent clients. Each requires coordinated migration.

### B-01: Auth Header Standardization — `agentId`/`agentKey` to `Authorization: Bearer`

**What breaks:** All agent clients currently using `agentId`/`agentKey` custom headers, query params, or body fields for auth. This affects the majority of agent API calls.

**Who is affected:** All autonomous agent processes (OpenClaw agents) that call any of the following endpoints:
- `GET /api/agents` — custom `agentId` + `agentKey` headers
- `GET /api/agents/[agentId]` — `agentKey` query param
- `GET /api/agents/[agentId]/tasks` — `agentKey` query param
- `GET /api/agents/[agentId]/tasks/[taskId]` — `agentKey` query param
- `POST /api/agents/[agentId]/tasks/[taskId]/comments` — `agentKey` in body
- `POST /api/agents/[agentId]/heartbeat` — `agentKey` in body
- `POST /api/agents/[agentId]/poll` — `agentKey` in body
- `GET /api/agents/[agentId]/wiki/pages` — `agentKey` query param
- `POST /api/agents/[agentId]/wiki/pages` — `agentKey` query param
- `GET /api/agents/[agentId]/wiki/pages/[pageId]` — `agentKey` query param
- `PATCH /api/agents/[agentId]/wiki/pages/[pageId]` — `agentKey` query param
- `POST /api/tasks/[taskId]/calendar-events` — `agentId` + `agentKey` in body
- `POST /api/calendar/events` — `agentId` + `agentKey` in body
- `PUT /api/calendar/events/[eventId]` — `agentId` + `agentKey` in body
- `GET /api/calendar/slots` — `agentId` + `agentKey` query params

**Target standard:** All authenticated endpoints use `Authorization: Bearer <agentKey>`. The `agentId` is already in the URL path for per-agent endpoints, or can be resolved from the token itself for list endpoints.

**Migration strategy (two-phase grace period):**
- **Phase A (2 weeks):** Accept BOTH old form (`agentId`/`agentKey` headers/params) AND new form (`Authorization: Bearer`). Log a deprecation warning when old form is used:
  ```typescript
  function extractAgentAuth(request: Request, agentIdFromPath?: string): { agentId: string; agentKey: string } | null {
    // New standard: Authorization: Bearer <key>
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      return { agentId: agentIdFromPath!, agentKey: authHeader.slice(7) };
    }

    // Deprecated: agentKey in query param or body
    const url = new URL(request.url);
    const agentKey = url.searchParams.get("agentKey") || request.headers.get("agentKey");
    const agentId = request.headers.get("agentId") || agentIdFromPath;
    if (agentKey && agentId) {
      console.warn(`[DEPRECATED] Use Authorization: Bearer header instead of agentKey param/header`);
      return { agentId, agentKey };
    }

    return null;
  }
  ```
- **Phase B (after 2 weeks):** Remove deprecated form. All callers must use `Authorization: Bearer`.

**Files to update (15 route files):** All routes listed in "Who is affected" above.

---

### B-02: Gateway Sub-Route Decomposition — `?action=` to Separate Route Files

**What breaks:** Any client using `GET /api/gateway/[gatewayId]?action=sessions`, `?action=history`, `POST /api/gateway/[gatewayId]?action=message`, etc.

**Who is affected:** The Mission Control UI components that call the gateway API (BrainHub, AgentCards, etc.) and any agents that call gateway endpoints directly.

**Target URLs:**

| Current URL | New URL | Method |
|-------------|---------|--------|
| `GET /api/gateway/[gatewayId]?action=status` or no action | `GET /api/gateway/[gatewayId]` | GET |
| `GET /api/gateway/[gatewayId]?action=sessions` | `GET /api/gateway/[gatewayId]/sessions` | GET |
| `GET /api/gateway/[gatewayId]?action=history&sessionKey=X` | `GET /api/gateway/[gatewayId]/sessions/[sessionKey]/history` | GET |
| `POST /api/gateway/[gatewayId]?action=message` | `POST /api/gateway/[gatewayId]/sessions/[sessionKey]/messages` | POST |
| `POST /api/gateway/[gatewayId]?action=provision` | `POST /api/gateway/[gatewayId]/provision` | POST |
| `POST /api/gateway/[gatewayId]?action=sync` | `POST /api/gateway/[gatewayId]/sync` | POST |
| `POST /api/gateway/[gatewayId]?action=validate` | `POST /api/gateway/[gatewayId]/validate` | POST |

**Files to create:**
- `frontend/src/app/api/gateway/[gatewayId]/route.ts` — keep only `handleGatewayStatus` (becomes the default GET)
- `frontend/src/app/api/gateway/[gatewayId]/sessions/route.ts` — `handleGetSessions`
- `frontend/src/app/api/gateway/[gatewayId]/sessions/[sessionKey]/history/route.ts` — `handleGetHistory`
- `frontend/src/app/api/gateway/[gatewayId]/sessions/[sessionKey]/messages/route.ts` — `handleSendMessage`
- `frontend/src/app/api/gateway/[gatewayId]/provision/route.ts` — `handleProvision`
- `frontend/src/app/api/gateway/[gatewayId]/sync/route.ts` — `handleSync`
- `frontend/src/app/api/gateway/[gatewayId]/validate/route.ts` — `handleValidateConnection`

**Test impact:** 70+ tests in `frontend/src/app/api/gateway/[gatewayId]/__tests__/sessions.test.ts` and `provision.test.ts` will need to be rewritten for the new route structure. Plan the test migration as part of the implementation task — do not mark as done until tests pass.

**Migration strategy:** Atomic cutover — no grace period needed since this is an internal UI-only API (not agent-to-server). Deploy UI updates and route changes simultaneously.

**Recommended phase:** Phase 3 (Execution Engine) when gateway dispatch is redesigned. Do not refactor prematurely.

---

### B-03: Task URL Renames — `/execute` and `/generate-daily`

**What breaks:** Clients using:
- `POST /api/tasks/execute` — rename to `POST /api/tasks/executions`
- `GET /api/tasks/execute?executionId=X` — rename to `GET /api/tasks/executions/[executionId]`
- `GET /api/tasks/generate-daily` — rename to `GET /api/tasks/daily-batches`
- `POST /api/tasks/generate-daily` — rename to `POST /api/tasks/daily-batches`

**Who is affected:** The Mission Control UI and any agents that call these endpoints. Note: `tasks/execute` is partially a mock/stub (execution logging disabled), so this rename is low-risk in practice.

**Migration strategy:** Atomic cutover. Create new route files and update all callers simultaneously. Old URLs can return 301 redirects for a grace period.

**Files to create:**
- `frontend/src/app/api/tasks/executions/route.ts` (replaces `execute/route.ts`)
- `frontend/src/app/api/tasks/executions/[executionId]/route.ts` (new GET for status polling)
- `frontend/src/app/api/tasks/daily-batches/route.ts` (replaces `generate-daily/route.ts`)

---

### B-04: Task Action Discriminator — Decompose 4 State-Engine Actions

**What breaks:** Clients using `PATCH /api/tasks/[taskId]` with `action: "escalate"`, `action: "reassign"`, `action: "unblock"`, or `action: "mark-executed"`.

**Who is affected:** The state-engine code paths and any Mission Control UI components that trigger escalation/reassignment.

**Target:** Move state-engine-specific operations to resource-oriented URLs:
- `PATCH /api/tasks/[taskId]` with `action: "assign"|"complete"|"update-status"|"update-tags"` — keep (agent operations)
- `POST /api/tasks/[taskId]/escalations` — new (replaces `action: "escalate"`)
- `POST /api/tasks/[taskId]/reassignments` — new (replaces `action: "reassign"`)
- `DELETE /api/tasks/[taskId]/blockers` — new (replaces `action: "unblock"`)
- `POST /api/tasks/[taskId]/executions` — new (replaces `action: "mark-executed"`)

**Note:** The remaining 4 agent actions (`assign`, `complete`, `update-status`, `update-tags`) via PATCH discriminator are acceptable and need not be broken up — the discriminator pattern within a single resource is manageable.

**Auth fix included:** The new sub-resource endpoints should add proper auth. Currently these 4 operations accept any `decidedBy` string with zero auth verification.

**Recommended phase:** Phase 3 (when state engine operations are formally modeled).

---

## 3. Auth Migration Strategy

### Current Non-Standard Auth Inventory

The following endpoints use non-standard authentication. **All require migration to `Authorization: Bearer`.**

**Group A: `agentKey` in query param (credentials exposed in server logs)**
| Endpoint | Current Auth | Target Auth |
|----------|-------------|-------------|
| `GET /api/agents/[agentId]` | `?agentKey=` query param | `Authorization: Bearer <agentKey>` |
| `GET /api/agents/[agentId]/tasks` | `?agentKey=` query param | `Authorization: Bearer <agentKey>` |
| `GET /api/agents/[agentId]/tasks/[taskId]` | `?agentKey=` query param | `Authorization: Bearer <agentKey>` |
| `GET /api/agents/[agentId]/wiki/pages` | `?agentKey=` query param | `Authorization: Bearer <agentKey>` |
| `POST /api/agents/[agentId]/wiki/pages` | `?agentKey=` query param | `Authorization: Bearer <agentKey>` |
| `GET /api/agents/[agentId]/wiki/pages/[pageId]` | `?agentKey=` query param | `Authorization: Bearer <agentKey>` |
| `PATCH /api/agents/[agentId]/wiki/pages/[pageId]` | `?agentKey=` query param | `Authorization: Bearer <agentKey>` |
| `GET /api/calendar/slots` | `?agentKey=`, `?agentId=` query params | `Authorization: Bearer <agentKey>` |

**Group B: `agentId`/`agentKey` non-standard headers (not RFC 6750)**
| Endpoint | Current Auth | Target Auth |
|----------|-------------|-------------|
| `GET /api/agents` | `agentId:` and `agentKey:` headers | `Authorization: Bearer <agentKey>` (agentId from Bearer token or path) |

**Group C: `agentKey` in request body (auth after body parse — wrong order)**
| Endpoint | Current Auth | Target Auth |
|----------|-------------|-------------|
| `POST /api/agents/[agentId]/heartbeat` | `{ agentKey }` in body | `Authorization: Bearer <agentKey>` |
| `POST /api/agents/[agentId]/poll` | `{ agentKey }` in body | `Authorization: Bearer <agentKey>` |
| `POST /api/agents/[agentId]/tasks/[taskId]/comments` | `{ agentKey }` in body | `Authorization: Bearer <agentKey>` |
| `POST /api/tasks/[taskId]/calendar-events` | `{ agentId, agentKey }` in body | `Authorization: Bearer <agentKey>` |
| `POST /api/calendar/events` | `{ agentId, agentKey }` in body | `Authorization: Bearer <agentKey>` |
| `PUT /api/calendar/events/[eventId]` | `{ agentId, agentKey }` in body | `Authorization: Bearer <agentKey>` |

**Group D: Mixed (accepts Bearer AND body/header fallback — migration-period state)**
| Endpoint | Current Auth | Status |
|----------|-------------|--------|
| `PATCH /api/agents/[agentId]` | `Authorization: Bearer` OR `{ apiKey }` in body | Acceptable migration state — remove body fallback after migration |
| `POST /api/agents/[agentId]/rotate-key` | `Authorization: Bearer` OR `{ apiKey }` in body | Acceptable migration state — remove body fallback after migration |

**Group E: No auth (intentional or gap)**
| Endpoint | Current Auth | Action |
|----------|-------------|--------|
| `POST /api/agents` | None (open registration) | Intentional — registration is public |
| `POST /api/admin/agents/setup-workspace` | None | **CRITICAL gap — add admin auth (NB-01)** |
| `POST /api/admin/migrations/agent-workspace-paths` | None | **CRITICAL gap — add admin auth (NB-01)** |
| `GET /api/agents/workspace/structure` | None | Add auth — reads server filesystem |
| `PATCH /api/tasks/[taskId]` (state-engine actions) | None | Add auth for escalate/reassign/unblock/mark-executed |
| Gateway, memory, state-engine, reports, businesses, epics | None | Evaluate: should these be protected? |

### Two-Phase Migration Pattern

**Phase A — Grace Period (deploy first, ~2 weeks):**
Add an `extractAgentAuth()` helper that accepts both old and new form:

```typescript
// frontend/lib/utils/extractAgentAuth.ts
export function extractAgentAuth(
  request: Request,
  agentIdFromPath?: string
): { agentId: string; agentKey: string } | null {
  // Standard: Authorization: Bearer <key>
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    if (!agentIdFromPath) return null; // agentId required for per-agent endpoints
    return { agentId: agentIdFromPath, agentKey: authHeader.slice(7) };
  }

  // Deprecated: query param
  const url = new URL(request.url);
  const queryKey = url.searchParams.get("agentKey");
  if (queryKey && agentIdFromPath) {
    console.warn("[DEPRECATED] Use Authorization: Bearer instead of agentKey query param");
    return { agentId: agentIdFromPath, agentKey: queryKey };
  }

  // Deprecated: custom header
  const headerKey = request.headers.get("agentKey");
  const headerId = request.headers.get("agentId");
  if (headerKey && (agentIdFromPath || headerId)) {
    console.warn("[DEPRECATED] Use Authorization: Bearer instead of agentKey/agentId headers");
    return { agentId: agentIdFromPath || headerId!, agentKey: headerKey };
  }

  return null;
}
```

**Phase B — Remove deprecated forms:** After 2 weeks, remove query param and header fallbacks. All callers must use `Authorization: Bearer`.

### Endpoints Already Using Standard Auth

These endpoints already use `Authorization: Bearer` (fully or partially) and are the reference implementation:
- `PATCH /api/agents/[agentId]` — accepts Bearer (and body fallback)
- `POST /api/agents/[agentId]/rotate-key` — accepts Bearer (and body fallback)
- `POST /api/calendar/events` — AUTH IS IN BODY (`agentId` + `agentKey`) — **not yet standard**
- `PUT /api/calendar/events/[eventId]` — same
- `GET /api/calendar/slots` — same (query params)

Correction: `rotate-key` is the only endpoint that correctly implements Bearer-first auth. It is the reference pattern.

---

## 4. Error Response Standardization Plan

### Routes Using Shape B (Raw `{ error: "string" }`)

These routes bypass `handleApiError()` and return raw error strings. Each needs to import and use `handleApiError`:

| File | Current Error Pattern | Required Change |
|------|----------------------|-----------------|
| `frontend/src/app/api/openapi/route.ts` | `JSON.stringify({ error: "Failed to generate..." })` | `const [e, s] = handleApiError(error); return jsonResponse(e, s);` |
| `frontend/src/app/api/agents/workspace/structure/route.ts` | `NextResponse.json({ error: "..." }, { status: N })` | Replace with `jsonResponse(...)` from `lib/utils/apiResponse` |
| `frontend/src/app/api/tasks/execute/route.ts` | `new Response(JSON.stringify({ error: "..." }))` | Use `handleApiError()` in catch; update success to `successResponse()` |
| `frontend/src/app/api/gateway/[gatewayId]/route.ts` | `JSON.stringify({ error: "..." })` in all 7 action handlers | Add `import { jsonResponse, handleApiError }` and update all error returns |
| `frontend/src/app/api/state-engine/metrics/route.ts` | `Response.json({ error, details })` | `const [e, s] = handleApiError(error); return jsonResponse(e, s);` |
| `frontend/src/app/api/state-engine/decisions/route.ts` | Same | Same fix |
| `frontend/src/app/api/state-engine/alerts/route.ts` | Same | Same fix |
| `frontend/src/app/api/reports/route.ts` | `new Response(JSON.stringify({ error: "..." }))` | Use `handleApiError()` |
| `frontend/src/app/api/epics/route.ts` | Local `jsonResponse({ error: "..." })` | Remove local function; import and use `handleApiError()` |
| `frontend/src/app/api/memory/route.ts` | `NextResponse.json({ files: [] }, { status: 500 })` | Return actual error shape; `{ files: [] }` should only be on 200 |
| `frontend/src/app/api/memory/files/route.ts` | `NextResponse.json({ content: '' })` on errors | Return `jsonResponse(errorResponse(...), 500)` |

### Routes Using Shape C (String Error in `success: false`)

| File | Current Error Pattern | Required Change |
|------|----------------------|-----------------|
| `frontend/src/app/api/businesses/route.ts` | `{ success: false, error: error?.message }` | Change `error` from string to `{ code: "...", message: error?.message }` |
| `frontend/src/app/api/tasks/generate-daily/route.ts` | `{ success: false, error: "string" }` | Use `handleApiError()` in catch |
| `frontend/src/app/api/reports/route.ts` (POST) | `{ success: false, error: "..." }` | Use `handleApiError()` |

### Correctness of `handleApiError()`

The `handleApiError()` function in `frontend/lib/utils/apiResponse.ts` correctly handles:
- `AppError` (and subclasses `ValidationError`, `NotFoundError`, `UnauthorizedError`, `ConflictError`) → extracts `code`, `message`, `statusCode`
- `ZodError` → extracts field-level validation details
- `Error` → wraps in `INTERNAL_ERROR` code with 500
- Unknown → generic `INTERNAL_ERROR`

This is sufficient. The fix is purely to use it consistently — no new logic needed.

---

## 5. Deferred Recommendations

These items were identified but are explicitly deferred for later phases.

### DEFER-01: API Versioning

**What:** Add URL path versioning (`/api/v1/...`) to all routes.

**Why deferred:** Mission Control has zero external consumers. Versioning creates maintenance burden with no current benefit. Introduce versioning only when a breaking change is needed AND there is a consumer that cannot update simultaneously. Current status: all consumers (agents and UI) are in the same monorepo and can be updated atomically.

**Decision trigger:** Introduce when Mission Control exposes a public API to external third parties, or when agents are deployed externally and cannot be restarted simultaneously with a server update.

---

### DEFER-02: HATEOAS (Richardson Level 3)

**What:** Add hypermedia links to responses so clients can discover available actions.

**Why deferred:** Agent clients are autonomous processes that know their API from a spec, not browsers navigating links. Level 3 adds response payload overhead and schema complexity without benefit for machine-to-machine APIs. The Richardson Maturity Model documentation itself notes Level 3 is rarely seen in production.

**Decision trigger:** Never for this use case. Agent clients will always use spec-driven API access.

---

### DEFER-03: Memory Endpoint Filesystem to Database Migration

**What:** Replace `GET /api/memory`, `GET /api/memory/files`, `GET /api/memory/context` filesystem reads with Convex database storage.

**Why deferred:** This is an architectural change (new Convex schema, migration of existing memory files), not a REST standardization change. The endpoints are development-only features that only work when the server runs co-located with the OpenClaw workspace.

**Decision trigger:** When memory endpoints need to be production-ready or accessed from remote servers.

**Interim recommendation:** Mark these endpoints as `x-development-only: true` in the OpenAPI spec and exclude from production deployment.

---

### DEFER-04: RFC 9457 Problem Details Format

**What:** Migrate error responses to RFC 9457 Problem Details format (`{ type, title, status, detail, instance }`).

**Why deferred:** The existing `{ success, error: { code, message } }` shape is already well-typed, well-used, and provides machine-readable error discrimination via `code`. Migrating to RFC 9457 would be a breaking change affecting all agent error handling code with no functional benefit.

**Decision trigger:** If Mission Control develops a public API that needs to interoperate with RFC 9457-aware tooling (API gateways, monitoring services).

---

## 6. Priority Matrix

| # | Change | ID | Type | Priority | Effort | Recommended Phase |
|---|--------|----|------|----------|--------|-------------------|
| 1 | Add auth to admin endpoints | NB-01 | Non-breaking | CRITICAL | Low | Immediately (Phase 1.1) |
| 2 | Standardize error shapes (Shape B/C → A) | NB-02, NB-03 | Non-breaking | HIGH | Low | Phase 1.1 |
| 3 | Auth: standardize to `Authorization: Bearer` | B-01 | Breaking | HIGH | Medium | Phase 1.2 |
| 4 | Gateway: decompose `?action=` anti-pattern | B-02 | Breaking | HIGH | Medium | Phase 3 |
| 5 | Remove local `jsonResponse` in epics | NB-03 | Non-breaking | HIGH | Low | Phase 1.1 |
| 6 | Add `zod-openapi` annotations to validators | NB-04 | Non-breaking | HIGH | Medium | Phase 1.1 |
| 7 | Replace hand-written OpenAPI generator | NB-05 | Non-breaking | HIGH | Medium | Phase 1.1 |
| 8 | Add auth to workspace/structure endpoint | NB-01 (extend) | Non-breaking | HIGH | Low | Phase 1.1 |
| 9 | Task URL renames (`/execute` → `/executions`, `/generate-daily` → `/daily-batches`) | B-03 | Breaking | MEDIUM | Low | Phase 3 |
| 10 | Task action discriminator: decompose state-engine actions | B-04 | Breaking | MEDIUM | Medium | Phase 3 |
| 11 | Add pagination meta to list endpoints | NB-06 | Non-breaking | MEDIUM | Medium | Phase 1.2 |
| 12 | Add `X-Request-Id` middleware | NB-07 | Non-breaking | MEDIUM | Low | Phase 1.2 |
| 13 | Fix auth for calendar/slots (query param → header) | B-01 (part of) | Breaking | MEDIUM | Low | Phase 1.2 |
| 14 | Add auth to state-engine/reports/businesses/epics | Design decision | Breaking/Non-breaking | MEDIUM | Low | Phase 2 |
| 15 | Memory endpoint filesystem → Convex DB | DEFER-03 | Breaking (architecture) | LOW | High | Phase 5+ |
| 16 | API versioning | DEFER-01 | N/A | DEFER | — | Never / external launch |
| 17 | HATEOAS Level 3 | DEFER-02 | N/A | DEFER | — | Never |
| 18 | RFC 9457 error format | DEFER-04 | N/A | DEFER | — | Never for internal |
