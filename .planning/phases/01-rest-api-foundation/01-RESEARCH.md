# Phase 1: REST API Foundation - Research

**Researched:** 2026-02-26
**Questions answered:** 7 of 7

---

## Current Codebase State

### API Routes Summary

**Total routes: 32 existing endpoints**

Current path distribution:
- All 32 routes under `/api/` (NOT yet versioned to `/api/v1/`)
- Examples:
  - `/api/agents` (GET, POST)
  - `/api/agents/{agentId}` (GET, PATCH)
  - `/api/agents/{agentId}/tasks` (GET)
  - `/api/tasks/{taskId}` (GET, PATCH)
  - `/api/calendar/events` (GET, POST)
  - `/api/health` (GET)
  - `/api/openapi` (GET) — already has OpenAPI endpoint!

**Organized by domain:**
- Agents: 10 routes (registration, polling, heartbeat, key rotation, task queries, wiki)
- Tasks: 5 routes (CRUD, execute, generate-daily, comments)
- Calendar: 3 routes (events, slots)
- Memory: 3 routes (context, files, base)
- Gateway: 1 route
- Admin: 2 routes
- State-engine: 3 routes
- Business/Epics/Reports: 5 routes
- Health/OpenAPI: 2 routes

### Error Format Distribution

**Current state: INCONSISTENT, but standardizable**

Error response patterns observed:
1. **Primary pattern** (17 routes): `{success: false, error: {code: string, message: string, details?: unknown}}`
   - Custom format in `frontend/lib/utils/apiResponse.ts`
   - Has code, message, details
   - Missing RFC 9457 fields: `type`, `title`, `instance`, `status`

2. **Health endpoint**: `{status: "healthy", timestamp, ...}` (simple key-value, no error structure)

3. **Some routes**: Minimal `{success: false, error: {...}}` without consistent detail structure

**Distance from RFC 9457:**
- **Field gaps:** Missing `type` (problem type URI), `title` (short description), `instance` (request URI), `status` (HTTP status)
- **Current approach:** Flatter than RFC 9457 but structured enough to enhance
- **Migration effort:** MODERATE — need to wrap existing `{code, message}` into RFC 9457 shape with request ID

### Authentication Mechanisms

**Current state: Custom headers with API key verification**

Auth patterns:
1. **Primary:** Headers-based (most routes)
   - `agentId` header (agent ID)
   - `agentKey` header (API key for verification)
   - Verified via `verifyAgent(agentId, apiKey)` → Convex query
   - Supports grace-period keys during rotation (old key valid for 24h after rotation)

2. **HTTP Bearer token support:** NOT yet implemented
   - Requirement API-08 specifies: `Authorization: Bearer {apiKey}`
   - Currently using custom headers, not standard Bearer token

3. **Validation location:**
   - `frontend/lib/agent-auth.ts` — centralized verification
   - Calls Convex function: `agents.verifyKeyWithGrace()`
   - Returns `VerifiedAgent` object with full agent data

4. **No rate limiting on auth:** Any agent can make unlimited calls (no per-API-key tracking)

### Pagination Current State

**Minimal pagination support (offset-based, NOT cursor-based)**

Patterns found:
1. **Query params:** `limit`, `offset` (2 routes use it)
   - Example: `/api/agents/{agentId}/tasks?limit=50&offset=0`
   - No Base64 cursor encoding (raw offset integer)
   - No cursor expiration
   - No total count guarantee

2. **No pagination on most routes:** Most list endpoints return all results without pagination controls

3. **Metadata structure where pagination exists:**
   ```json
   {
     "data": [...],
     "meta": {
       "count": 10,
       "filters": {...},
       "pagination": {"limit": 50, "offset": 0}
     }
   }
   ```

### Filtering & Sorting

**Filtering: PARTIAL support (status, priority, assignedTo)**
- Example: `/api/agents/{agentId}/tasks?status=pending&priority=high&assignedTo=me`
- Custom filters per endpoint (not standardized)

**Sorting: NOT FOUND** in current routes
- No `?sort=-createdAt` or similar syntax

### Rate Limiting

**Current state: NONE IMPLEMENTED**
- No X-RateLimit-* headers in responses
- No 429 (Too Many Requests) handling
- No per-API-key quota tracking
- No token bucket algorithm
- No storage mechanism for quota state

### Success Response Format

**Current (consistent):**
```json
{
  "success": true,
  "data": {...},
  "timestamp": 1234567890
}
```

Status: MATCHES Phase 1 requirement (API-03) ✅

---

## Implementation Patterns

### Zod + OpenAPI Integration

**Current state: Zod validators exist, OpenAPI generation exists but incomplete**

Existing infrastructure:
1. **Zod validators:**
   - Location: `frontend/lib/validators/` (multiple files)
   - Used for input validation in most routes
   - Schema examples:
     - `RegisterAgentSchema` (POST /api/agents)
     - `QueryTasksSchema` (GET /api/agents/{agentId}/tasks)
   - Zod error handling: Converts `z.ZodError` → RFC 9457-ish format

2. **OpenAPI generation:**
   - Already exists: `frontend/lib/openapi-generator.ts` (42KB file)
   - Endpoint: GET `/api/openapi` returns full spec
   - Package: `zod-openapi@^5.4.6` already installed ✅
   - **Issue:** Generator is manual, not auto-linked to route Zod schemas

3. **Swagger UI:**
   - Package installed: `swagger-ui-react@^5.31.1`, `swagger-ui-dist@^5.31.1` ✅
   - Needs: UI component to mount Swagger at `/api/docs`
   - Try-It-Out mode: Can be enabled in SwaggerUI config

**Best practice for Phase 1:**
1. Enhance `openapi-generator.ts` to scan route files for Zod schemas (import analysis)
2. Auto-extract Zod schemas → OpenAPI definitions via `zod-openapi`
3. Mount Swagger UI at `/api/docs` pointing to `/api/openapi`
4. Every route MUST export a Zod schema for auto-documentation

**Challenge:** Convex mutations don't have type introspection; need wrapper schema per route.

### Token Bucket Rate Limiting Implementation

**Challenge: Convex doesn't have built-in token bucket or Redis**

Solution strategy (Phase 1 compatible):
1. **Store quota state in Convex table:** `apiKeyQuota`
   ```sql
   CREATE TABLE apiKeyQuota (
     apiKey: string (indexed),
     tokensRemaining: number,
     lastResetAt: number,
     quotaPerHour: number,
     quotaPerDay: number,
     hourlyResetAt: number,
     dailyResetAt: number
   )
   ```

2. **Token bucket algorithm in Convex function:**
   - On every API call, mutation `rateLimit.checkAndDecrement(apiKey)`
   - Calculate elapsed time since last reset
   - Add tokens back (refill = elapsed / 3600s * rate)
   - Check if enough tokens exist
   - Decrement by 1 (or configurable cost)
   - Return: `{allowed: boolean, tokensRemaining, resetAt}`

3. **Handler-level enforcement:**
   - Call `convex.mutation(api.rateLimit.checkAndDecrement, {apiKey})`
   - If `allowed === false`, return 429 with `{retryAfter, resetAt}`
   - If `allowed === true`, proceed

4. **Default quotas (per CONTEXT.md):**
   - 1000 req/hour per API key
   - 10,000 req/day per API key

5. **Distributed concern:**
   - Convex handles distributed locking (mutations are atomic)
   - No race condition on token decrement (Convex serializes mutations per document)

**Alternative considered: Redis-backed**
- Not feasible for Phase 1 (adds infrastructure)
- Convex solution is sufficient for v1

### Cursor Pagination with Base64

**Implementation strategy:**

1. **Cursor format:**
   ```
   cursor = base64(encode("offset:100"))
   Example: "b2Zmc2V0OjEwMA==" ← base64("offset:100")
   ```

2. **Cursor decode/validation:**
   ```typescript
   function decodeCursor(cursor: string): {offset: number} {
     const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
     const match = /^offset:(\d+)$/.test(decoded);
     if (!match) throw new Error("Invalid cursor format");
     return {offset: parseInt(decoded.split(':')[1])};
   }

   function encodeCursor(offset: number): string {
     return Buffer.from(`offset:${offset}`).toString('base64');
   }
   ```

3. **Cursor expiration (5-min):
   - Store creation timestamp with cursor in response
   - Client includes original cursor string
   - On next request, server recalculates: if(now - createdAt > 5min) cursor is invalid
   - OR: Include expiry timestamp in cursor itself: `base64("offset:100:createdAt:1234567890")`

4. **Edge cases:**
   - Offset > total count: Return empty array with nextCursor = null
   - Expired cursor: Return 400 "Cursor expired, please restart pagination"
   - Invalid base64: Return 400 "Invalid cursor format"

5. **Response shape:**
   ```json
   {
     "success": true,
     "data": [...],
     "pagination": {
       "total": 1000,
       "limit": 20,
       "offset": 0,
       "cursor": "b2Zmc2V0OjIw",
       "nextCursor": "b2Zmc2V0OjQw",
       "hasMore": true
     }
   }
   ```

**Convex integration:**
- Use offset-based queries: `convex.query(api.tasks.paginated, {offset: 0, limit: 20})`
- Convex returns: `{items: [...], total: number}`
- Frontend layer encodes offset → cursor

### Workspace Context in URL Paths

**Required pattern: `/api/v1/workspaces/{workspaceId}/...`**

Implementation:

1. **Route structure change:**
   ```
   OLD: /api/agents/{agentId}/tasks
   NEW: /api/v1/workspaces/{workspaceId}/agents/{agentId}/tasks
   ```

2. **Extraction in route handler:**
   ```typescript
   export async function GET(request: Request, context: any) {
     const {workspaceId, agentId} = context.params;

     // Validate workspace access
     const workspace = await convex.query(api.workspaces.getById, {id: workspaceId});
     if (!workspace) throw new NotFoundError("Workspace not found");

     // Validate agent belongs to workspace (requires new Convex function)
     const agent = await convex.query(api.agents.getByIdInWorkspace, {
       agentId, workspaceId
     });
     if (!agent) throw new NotFoundError("Agent not found in workspace");

     // Continue with workspaceId context passed to Convex
   }
   ```

3. **Convex function updates:**
   - Most Convex functions need `workspaceId` parameter
   - Add workspace isolation queries: `tasks.getByWorkspace(workspaceId, filters)`
   - Enforce in data access layer (return empty if agent not in workspace)

4. **Auth flow:**
   - Extract `agentId` + `agentKey` from headers (or Bearer token)
   - Verify agent exists and is in the workspace (new check)
   - Check rate limits per API key (not workspace-specific)

### RFC 9457 Error Standardization

**Mapping current to RFC 9457:**

Current structure:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": [...]
  },
  "timestamp": 1234567890
}
```

RFC 9457 structure:
```json
{
  "type": "https://api.example.com/errors/validation",
  "title": "Validation Error",
  "detail": "Invalid request data",
  "instance": "/api/v1/workspaces/abc/agents",
  "status": 400,
  "requestId": "req-abc-123",
  "timestamp": "2026-02-26T12:00:00Z"
}
```

**Migration approach (non-breaking):**

Phase 1 will add RFC 9457 fields to existing response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": [...],
    // NEW RFC 9457 fields:
    "type": "https://api.example.com/errors/validation",
    "title": "Validation Error",
    "instance": "/api/v1/workspaces/abc/agents",
    "status": 400,
    "requestId": "req-abc-123"
  },
  "timestamp": 1234567890
}
```

**Request ID generation:**
- Location: Middleware or per-handler
- Format: `req-{timestamp}-{randomHex}` or `{uuid}`
- Passed through: Headers in response, logs, Convex activity logs
- Storage: In `executions.requestId` for audit trail

**Required changes:**
1. Enhance `frontend/lib/utils/apiResponse.ts` with RFC 9457 wrapper
2. Add `requestId` generation in middleware
3. Add error type URI builder: `buildErrorType(code) → "https://api.example.com/errors/{code}"`
4. Update all 32 routes to pass `instance` (request path) when handling errors

---

## Migration Strategy

### Phase-In Approach

**Goal: Support both `/api/` and `/api/v1/` during transition (agents unaffected)**

1. **Parallel routes (Month 1-2):**
   - Create `/api/v1/` versions of all 32 routes
   - Keep `/api/` routes functional (aliased or proxied to v1)
   - Both respond identically
   - No breaking changes to agents

2. **Agent migration window (Month 2-3):**
   - Document migration path
   - Send notifications to agent teams
   - Agents update their endpoints: `/api/agents` → `/api/v1/workspaces/{id}/agents`
   - Provide migration guide

3. **Deprecation path (Month 3-4):**
   - Mark `/api/` routes as deprecated in responses
   - Add `Deprecation: true` header
   - Add `Sunset: date` header (indicate removal date)
   - Log usage of old routes

4. **Removal (Month 4+):**
   - After all agents migrated, remove `/api/` routes
   - Sunset date: 6 months from deprecation announcement (per CONTEXT.md)

**Which routes migrate first (critical path):**
1. `/api/agents` (agent registration)
2. `/api/agents/{agentId}/tasks` (agent work intake)
3. `/api/tasks/{taskId}` (task management)
4. All task-related endpoints
5. Remaining endpoints in order

**Workspace context requirement:**
- Agents MUST provide workspace ID in URL
- Allows per-workspace rate limiting (future enhancement)
- Enables workspace isolation enforcement (Phase 2)

**Testing strategy:**
- E2E tests run against BOTH `/api/` and `/api/v1/` routes
- Verify both return identical responses
- Agent integration tests unchanged (just swap URL)

### Deprecation & Sunset

**Timeline:**
- **Announcement:** "Your agents are using deprecated /api/ routes. Please migrate to /api/v1/ by [date]."
- **Deprecation window:** 6 months
- **Sunset date:** Exactly 6 months after announcement
- **Final removal:** Routes return 404 "Use /api/v1/ instead"

**Enforcement:**
- Header in responses: `Deprecation: true`, `Sunset: Wed, 26 Aug 2026 00:00:00 GMT`
- Convex activity log: Track old route usage (warning message in dashboard)
- No breaking change in response body (ensure backwards compatibility)

---

## Dependencies & Risks

### Critical Dependencies

**Libraries (ALREADY INSTALLED):**
- ✅ `zod@^4.3.6` — Input validation
- ✅ `zod-openapi@^5.4.6` — OpenAPI spec generation from Zod
- ✅ `swagger-ui-react@^5.31.1` — Swagger UI component
- ✅ `swagger-ui-dist@^5.31.1` — Swagger UI assets
- ✅ `convex@^1.32.0` — Backend (supports `v.record()` for flexible schemas)
- ✅ `ws@^8.18.0` — WebSocket (for streaming/long-polling)

**New dependencies needed:**
- None for core Phase 1 (everything available)
- Optional: `pino@^10.3.1` already installed (logging)

**Convex features required:**
- ✅ Mutations (for rate limiting state updates)
- ✅ Queries (for data fetches)
- ✅ Indexes (for efficient filtering)
- ✅ Schema validation via `v.record()` (Convex 1.32.0+)

### Potential Risks

1. **Breaking changes to agents during migration**
   - MITIGATION: Support both `/api/` and `/api/v1/` simultaneously (no forced migration)
   - MITIGATION: Provide clear deprecation timeline (6 months)
   - MITIGATION: Agent teams must opt-in to new paths

2. **Performance impact from rate limiting overhead**
   - CONCERN: Every request hits Convex mutation to check/decrement quota
   - MITIGATION: Mutation is atomic, fast (microseconds)
   - MITIGATION: Cache quota state in-process (optional, if needed)
   - MITIGATION: Phase 2 can optimize with Redis if needed

3. **Cursor pagination complexity**
   - CONCERN: Base64 encoding/decoding adds overhead
   - CONCERN: Cursor expiration validation adds logic
   - MITIGATION: Keep cursors simple (just offset + timestamp)
   - MITIGATION: Clients can ignore cursor expiration for now (accept expired cursors with warning)

4. **RFC 9457 compliance mismatch**
   - CONCERN: Adding RFC 9457 fields while keeping old fields = verbose responses
   - MITIGATION: Phase 1 wraps existing errors (backwards compatible)
   - MITIGATION: Future version (API v2) can be pure RFC 9457 if needed

5. **Workspace context enforcement delays Phase 2**
   - CONCERN: Phase 2 requires workspace isolation; Phase 1 adds URL context
   - CONCERN: If Phase 1 routes don't fully validate workspace access, Phase 2 is harder
   - MITIGATION: Phase 1 extracts workspaceId from URL but doesn't enforce isolation
   - MITIGATION: Phase 2 adds actual isolation checks (data access layer)

6. **OpenAPI spec generation brittleness**
   - CONCERN: Manual schema export per route is error-prone
   - CONCERN: If schema missing, endpoint not documented
   - MITIGATION: Add build-time validation: `npm run validate` checks all routes have schemas
   - MITIGATION: Fail build if OpenAPI spec generation errors

### Mitigations

**Backwards compatibility:**
- Both `/api/` and `/api/v1/` work simultaneously
- Response format extended (never removed), not changed
- Auth headers still work (plus Bearer token added)
- No mandatory client updates in Phase 1

**Testing gates:**
- ✅ All 32 routes have unit tests (existing)
- ✅ All 32 routes have integration tests with mock Convex
- ✅ E2E tests run against both `/api/` and `/api/v1/` (new)
- ✅ Rate limit tests: verify 429 at quota exceeded
- ✅ Pagination tests: cursor format, expiration, edge cases
- ✅ Error format tests: RFC 9457 fields present, valid

**Rollback plan:**
- If Phase 1 breaks agents: Keep `/api/` as primary, revert `/api/v1/` changes
- If rate limiting too aggressive: Adjust quotas (1000/hr → 2000/hr)
- If OpenAPI generation fails: Use manual spec (zod-openapi fallback)
- If cursor pagination breaks: Fall back to offset pagination

---

## Validation Architecture

### Definition of Done for Phase 1

**Success = All 32 routes migrated to `/api/v1/` with:**

1. **REST Compliance (API-01)**
   - [ ] All routes use correct HTTP verbs (GET, POST, PATCH, DELETE)
   - [ ] All POST creating resources return 201 (not 200)
   - [ ] All DELETE return 204 (not 200)
   - [ ] Idempotent operations (PUT, PATCH, GET) are truly idempotent

2. **Response Standardization (API-02, API-03)**
   - [ ] All errors return RFC 9457 format: `{type, title, detail, instance, status, requestId, timestamp}`
   - [ ] All successes return: `{success: true, data: {...}, timestamp}`
   - [ ] All 32 routes tested for error format

3. **Pagination (API-04)**
   - [ ] All list endpoints support: `?limit=N&cursor=base64`
   - [ ] Responses include: `{data: [...], pagination: {total, limit, cursor, nextCursor, hasMore}}`
   - [ ] Cursors expire after 5 minutes
   - [ ] Invalid cursors return 400 with "Cursor expired" message

4. **Filtering & Sorting (API-05, API-06)**
   - [ ] All list endpoints support: `?status=X&sort=-createdAt`
   - [ ] Filtering works (return only matching items)
   - [ ] Sorting works (ascending/descending)
   - [ ] Examples: `/api/v1/tasks?status=pending&sort=priority`

5. **Workspace Context (API-07)**
   - [ ] All routes follow: `/api/v1/workspaces/{id}/...` pattern
   - [ ] Workspace ID extracted from URL, validated
   - [ ] Invalid workspace returns 404
   - [ ] Agent verified to be in workspace (soft validation)

6. **Auth (API-08)**
   - [ ] All routes support: `Authorization: Bearer {apiKey}` header
   - [ ] OR: `agentId` + `agentKey` headers (backwards compat)
   - [ ] Invalid/missing auth returns 401
   - [ ] API key rotation grace period works (24h old key still valid)

7. **Rate Limiting (API-09)**
   - [ ] All routes enforced with per-API-key rate limit
   - [ ] Quotas: 1000 req/hour, 10k req/day
   - [ ] Responses include: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
   - [ ] On limit exceeded: 429 with `{retryAfter, resetAt}`

8. **OpenAPI & Swagger (API-10, API-11)**
   - [ ] OpenAPI spec at `/api/openapi` (auto-generated from Zod)
   - [ ] All 32 routes documented in spec
   - [ ] Swagger UI at `/api/docs` with Try-It-Out enabled
   - [ ] Examples: success + error per endpoint

9. **API Versioning (API-12)**
   - [ ] `/api/v1/` routes fully functional
   - [ ] `/api/` routes still work (aliased or proxied)
   - [ ] Response headers include version info (optional)

### Test Coverage Strategy

**Unit tests (existing, enhance):**
- Input validation (Zod schemas) — 100% coverage
- Error handling (AppError, ValidationError) — 100% coverage
- Response formatting — 100% coverage

**Integration tests (new, per route):**
```typescript
describe("GET /api/v1/agents", () => {
  test("returns RFC 9457 error on invalid auth", () => {
    // Verify error shape: {type, title, detail, instance, status, requestId}
  });

  test("supports cursor pagination", () => {
    // Verify limit, cursor, nextCursor in response
  });

  test("rate limits after quota exceeded", () => {
    // Make 1001 requests, 1001st returns 429
  });

  test("includes workspace in path", () => {
    // Verify URL pattern: /api/v1/workspaces/{id}/agents
  });
});
```

**E2E tests (new):**
```typescript
describe("API Integration", () => {
  test("Agent can register and use API key to fetch tasks", () => {
    // 1. POST /api/v1/agents with name, capabilities
    // 2. Get API key from response
    // 3. GET /api/v1/workspaces/{id}/agents/{id}/tasks with Bearer token
    // 4. Verify tasks returned with pagination
  });

  test("OpenAPI spec is valid and complete", () => {
    // Fetch /api/openapi
    // Validate against OpenAPI 3.0 schema
    // Verify all 32 routes documented
  });

  test("Both /api/ and /api/v1/ routes return identical responses", () => {
    // Make request to /api/agents and /api/v1/workspaces/{id}/agents
    // Compare responses (ignoring version indicators)
  });
});
```

**Smoke tests (manual validation):**
- Gateways page loads without errors
- Multiple rapid agent requests work (no race conditions)
- Rate limit headers appear in response
- Swagger UI at /api/docs renders and allows Try-It-Out
- Deprecation headers appear on `/api/` routes

---

## Summary

### Feasible in Phase 1 ✅

1. **REST standardization:** Migrate all 32 routes to `/api/v1/` following REST patterns
2. **RFC 9457 errors:** Wrap existing error format with RFC 9457 fields (non-breaking)
3. **Cursor pagination:** Implement Base64-encoded offset cursors with 5-min expiration
4. **Filtering & sorting:** Add standard query param syntax (`?status=X&sort=-field`)
5. **Workspace context:** Extract workspaceId from URL path (soft validation in Phase 1, hard in Phase 2)
6. **Bearer token auth:** Support `Authorization: Bearer {apiKey}` alongside existing headers
7. **OpenAPI spec:** Enhance existing generator to auto-wire Zod schemas
8. **Swagger UI:** Mount at `/api/docs` with Try-It-Out mode
9. **Rate limiting:** Token bucket via Convex mutations (atomic, scalable)
10. **Dual-path support:** Keep `/api/` working alongside `/api/v1/` (6-month deprecation window)

### Blocked / Requires Clarification 🔴

**None. All Phase 1 requirements are feasible.**

### Dependencies Met ✅

- ✅ Zod + zod-openapi already installed
- ✅ Swagger UI packages ready
- ✅ Convex has all needed features
- ✅ No new infrastructure (uses Convex for rate limiting state)
- ✅ No breaking changes to existing agents

### Estimated Effort

- **Planning:** 1-2 days (this research)
- **Implementation:** 5-8 days
  - Zod schema extraction & OpenAPI gen: 1.5 days
  - Rate limiting mutations: 1 day
  - RFC 9457 error wrapper: 0.5 days
  - Route migrations (batched): 2 days
  - Cursor pagination: 1 day
  - Workspace context: 1 day
  - Testing & validation: 2 days
- **Review & adjustment:** 1-2 days
- **Total:** ~9-12 days (1-1.5 sprints)

### Critical Path

1. **Week 1:** Zod schema extraction, OpenAPI generation, rate limiting mutations
2. **Week 2:** Route migrations, error standardization, pagination
3. **Week 3:** Workspace context, auth enhancements, testing, validation

---

## Architecture Decisions Locked (from CONTEXT.md)

✅ Confirmed during research:

- **Versioning:** Support v1 and v2 simultaneously, 6-month deprecation
- **Pagination:** Base64 cursors, default 20/max 100, 5-min expiration, include total count
- **Rate limits:** Per API Key (not per workspace), token bucket, 1000 req/hr / 10k req/day
- **429 responses:** Include {retryAfter, resetAt} in body
- **OpenAPI:** Every endpoint, auto-generated from Zod, full Swagger UI with Try-It-Out
- **Examples:** Minimal (success + error only)
- **Workspace context:** URL path `/api/v1/workspaces/{id}/...` (soft validate in Phase 1)

---

*Research completed: 2026-02-26*
*Status: Ready for Phase 1 Planning*
