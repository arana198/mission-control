# Phase 1: REST API Foundation & Standardization — Plan

**Phase:** 1
**Mode:** Standard
**Created:** 2026-02-26
**Estimated Duration:** 7-10 days (1 sprint)
**Estimated Effort:** 60-80 engineer-hours

---

## Frontmatter

```yaml
waves: 4
depends_on: []
files_modified:
  - frontend/src/app/api/** (all 32 routes)
  - frontend/src/middleware.ts (new/updated)
  - frontend/src/lib/api/** (new utilities)
  - convex/schema.ts (new apiKeyQuota table)
  - convex/types.ts (rate limit types)
  - convex/** (new rate limiting mutations)
  - frontend/package.json (if zod-openapi needs version bump)
autonomous: false (testing gates at Waves 2, 3, 4)
prerequisites:
  - Convex backend running (npm run convex:dev)
  - Next.js frontend can start (npm run dev)
  - All existing tests passing (npm test)
```

---

## Phase Overview

This phase standardizes all 32 existing API routes with:
- Uniform request/response formatting (RFC 9457 errors, standardized success)
- Cursor-based pagination with base64 encoding and 5-minute expiration
- Token bucket rate limiting (1000 req/hour, 10k req/day per API key)
- OpenAPI 3.0 spec auto-generated from Zod schemas
- Swagger UI at /api/docs with Try-It-Out mode
- Support for both `/api/v1/` (canonical) and `/api/` (deprecated) paths
- Bearer token authentication alongside existing header-based auth

**Requirements Mapped:** API-01, API-02, API-03, API-04, API-05, API-06, API-07, API-08, API-09, API-10, API-11, API-12

### Must-Haves (Phase Goal Verification)

These are the outcomes that prove Phase 1 goal was achieved:

- [ ] All 32 routes accessible via `/api/v1/` with consistent URL pattern: `/api/v1/workspaces/{workspaceId}/...`
- [ ] All error responses in RFC 9457 format with unique request ID tracing
- [ ] All list endpoints support cursor pagination: `?limit=50&cursor=base64Encoded`
- [ ] Rate limiting enforced: per API key, token bucket algorithm, 1000 req/hr quota
- [ ] OpenAPI spec complete and auto-generated from Zod schemas (includes all 32 endpoints)
- [ ] Swagger UI operational at `/api/docs` with Try-It-Out functionality
- [ ] Bearer token auth working: `Authorization: Bearer {apiKey}` accepted on all endpoints
- [ ] Both `/api/` and `/api/v1/` paths return identical responses (backwards compatible)
- [ ] E2E test suite validates API contract (error format, pagination, rate limits, versioning)
- [ ] Zero breaking changes to existing agent integrations (soft launch with dual-path support)

---

## Wave 1: Foundation & Infrastructure (Days 1-2)

Build the underlying schema, middleware, and utility layer. No routes modified yet.

### Task 1.1: Schema & Convex Setup — Rate Limiting

**Requirement:** API-09

**Objective:** Add rate limiting infrastructure to Convex for per-API-key quota tracking.

**Scope:**
- Create `apiKeyQuota` table in Convex schema with fields:
  - `_id`, `_creationTime`: Auto-generated
  - `apiKeyId`: String (indexed for fast lookup)
  - `tokensRemaining`: Number (current quota)
  - `tokensPerHour`: Number (default 1000)
  - `tokensPerDay`: Number (default 10000)
  - `hourlyResetAt`: Timestamp (when hourly quota resets)
  - `dailyResetAt`: Timestamp (when daily quota resets)
  - `createdAt`, `updatedAt`: Timestamps

- Create TypeScript types:
  - `RateLimitState` — shape of quota record
  - `RateLimitCheckResult` — {allowed: boolean, remaining: number, resetAt: Date}

- Create Convex mutation `rateLimit.checkAndDecrement(apiKeyId)`:
  - Takes API key ID
  - Returns `{allowed: boolean, remaining: number, resetAt: Date}`
  - Implements token bucket: refills tokens based on elapsed time
  - Decrements by 1 on each call
  - Atomic (no race conditions)

- Create Convex query `rateLimit.getQuotaStatus(apiKeyId)`:
  - Returns current quota state (for observability/debugging)

**Success Criteria:**
- [ ] `convex/schema.ts` updated with `apiKeyQuota` table definition
- [ ] `convex/types.ts` exports `RateLimitState`, `RateLimitCheckResult` types
- [ ] Mutation `rateLimit.checkAndDecrement()` implemented and tested (unit tests pass)
- [ ] Mutation handles edge cases:
  - New API key (auto-initialize quota)
  - Multiple concurrent calls (atomic, no race)
  - Quota reset after expiration
- [ ] Build passes: `npm run build` (TypeScript clean)

**Files:**
- `convex/schema.ts` (update)
- `convex/types.ts` (update)
- `convex/rateLimit.ts` (create)
- `convex/__tests__/rateLimit.test.ts` (create, unit tests)

**Verification:**
```bash
# Run rate limit unit tests
npm test -- convex/__tests__/rateLimit.test.ts

# Verify schema compiles
convex functions

# Check TypeScript
npx tsc --noEmit
```

---

### Task 1.2: Error Response Standardization

**Requirement:** API-02, API-03

**Objective:** Create unified error/success response wrappers that implement RFC 9457 format.

**Scope:**
- Create `frontend/src/lib/api/responses.ts`:
  - `generateRequestId()`: UUID-based or `req-{timestamp}-{hex}` format
  - `errorResponse(status, code, title, detail, instance?)`: RFC 9457 format
    - Includes: `type`, `title`, `detail`, `instance` (request path), `status`, `requestId`, `timestamp`
    - Example error body:
      ```json
      {
        "type": "https://api.mission-control.dev/errors/validation",
        "title": "Validation Error",
        "detail": "Missing required field: agentKey",
        "instance": "/api/v1/agents/abc123",
        "status": 400,
        "requestId": "req-1234567890-a1b2c3",
        "timestamp": "2026-02-26T12:00:00Z"
      }
      ```
  - `successResponse(data, meta?)`: Standard success format
    - Returns: `{success: true, data: {...}, timestamp: ISO8601}`
  - `listResponse(items, total, limit, nextCursor?)`: Paginated response
    - Returns: `{success: true, data: [...], pagination: {total, limit, cursor, nextCursor, hasMore}, timestamp}`

- Create middleware to:
  - Generate `requestId` on every request
  - Attach to request context for handlers to use
  - Include in all error responses

**Success Criteria:**
- [ ] All error responses have RFC 9457 fields
- [ ] All success responses have `{success: true, data}`
- [ ] All list responses have pagination metadata
- [ ] Request IDs are unique (test 1000 requests, all unique)
- [ ] Error responses include HTTP status code
- [ ] Timestamps are ISO8601 format

**Files:**
- `frontend/src/lib/api/responses.ts` (create)
- `frontend/src/lib/api/errors.ts` (create, error type definitions)
- `frontend/src/middleware.ts` (update to add request ID generation)

**Verification:**
```bash
# Test response formatting
npm test -- lib/api/responses.test.ts

# Verify RFC 9457 compliance (manual inspection of error structure)
```

---

### Task 1.3: Cursor Pagination Utility

**Requirement:** API-04

**Objective:** Implement base64-encoded cursor pagination with expiration.

**Scope:**
- Create `frontend/src/lib/api/pagination.ts`:
  - `encodeCursor(offset: number, createdAt?: Date)`: Encodes offset + timestamp to base64
    - Format: `base64("offset:{offset}:createdAt:{timestamp}")`
    - Returns: Base64 string like `"b2Zmc2V0OjIwOmNyZWF0ZWRBdDoxMjM0NTY3ODkw"`

  - `decodeCursor(cursor: string)`: Decodes base64 and validates format
    - Returns: `{offset: number, createdAt: Date}`
    - Throws: `CursorError` on invalid format

  - `isCursorExpired(cursor: string, maxAgeSecs: number = 300)`: Checks 5-min expiration
    - Returns: `boolean`
    - Returns `true` if older than maxAgeSecs

  - `validateCursor(cursor: string)`: Combines decode + expiration check
    - Returns: `{offset: number}` or throws error
    - Error message: "Cursor expired. Please restart pagination from the beginning."

  - `createPaginatedResponse(items, total, limit, offset)`: Builds response object
    - Calculates next offset
    - Generates next cursor (if more items exist)
    - Returns: `{items, pagination: {total, limit, offset, cursor, nextCursor, hasMore}}`

- Defaults and constraints:
  - Default limit: 20 items
  - Max limit: 100 items
  - Cursor expiration: 5 minutes (300 seconds)
  - Always include total count

**Success Criteria:**
- [ ] Cursors encode/decode correctly (round-trip: offset → cursor → offset)
- [ ] Expired cursors rejected with clear error message
- [ ] Response includes: `{total, limit, offset, cursor, nextCursor, hasMore}`
- [ ] Edge cases handled:
  - Offset > total (return empty items, hasMore=false)
  - Invalid base64 cursor (return 400 error)
  - Max limit enforced (limit > 100 capped to 100)

**Files:**
- `frontend/src/lib/api/pagination.ts` (create)
- `frontend/src/lib/api/__tests__/pagination.test.ts` (create, unit tests)

**Verification:**
```bash
# Test pagination utilities
npm test -- lib/api/__tests__/pagination.test.ts

# Verify cursor encoding/decoding
# Test cursor expiration (use jest fake timers)
```

---

## Wave 2: Middleware & Route Preparation (Days 3-4)

Add middleware to all routes, then prepare routes for standardization.

### Task 2.1: Unified Middleware Layer

**Requirement:** API-02, API-07, API-08, API-09

**Objective:** Create centralized middleware that extracts workspace context, validates auth, checks rate limits, generates request IDs.

**Scope:**
- Create `frontend/src/middleware.ts` (or enhance existing):
  - `extractWorkspaceId(pathname)`: Parses `/api/v1/workspaces/{id}/...`
    - Returns: `{workspaceId: string, rest: string}` or throws 400
    - Example: `/api/v1/workspaces/ws-123/agents` → `{workspaceId: "ws-123", rest: "/agents"}`

  - `validateBearerToken(req)`: Extracts `Authorization: Bearer {token}` header
    - Returns: `{apiKeyId: string, token: string}`
    - Throws 401 if missing or invalid format

  - `validateLegacyAuth(req)`: Extracts legacy `agentId` + `agentKey` headers
    - Returns: `{agentId: string, apiKey: string}`
    - Throws 401 if missing or invalid format

  - Middleware function that:
    1. Generates request ID
    2. Extracts workspace ID from URL
    3. Validates Bearer token OR legacy headers (dual support)
    4. Stores context in request object for handlers to access
    5. Returns early with 401/400 if auth fails

- Integration points:
  - Next.js middleware runs before route handlers
  - Context object includes: `{requestId, workspaceId, apiKeyId, agentId}`
  - All error responses use `requestId` for tracing

**Success Criteria:**
- [ ] Middleware runs on all `/api/` and `/api/v1/` routes
- [ ] Request ID generated on every request (unique)
- [ ] Workspace ID extracted from URL path (if present)
- [ ] Bearer token auth validated (valid → pass, invalid → 401)
- [ ] Legacy auth still works (headers → pass, invalid → 401)
- [ ] Request context accessible in route handlers
- [ ] Rate limit check executed before handler logic

**Files:**
- `frontend/src/middleware.ts` (create or enhance)
- `frontend/src/lib/api/auth.ts` (create, auth validation functions)
- `frontend/src/lib/api/__tests__/auth.test.ts` (create, unit tests)

**Verification:**
```bash
# Test middleware functions
npm test -- lib/api/__tests__/auth.test.ts

# Manual test: curl requests with/without auth headers
curl -H "Authorization: Bearer test-key" http://localhost:3000/api/v1/agents
# Should return 401 (key not found) or valid response
```

---

### Task 2.2: Route Handler Preparation

**Requirement:** API-01

**Objective:** Audit all 32 routes to understand current patterns, prepare for standardization.

**Scope:**
- Identify all 32 route files in `frontend/src/app/api/`
- For each route:
  1. Check current response format (success, error)
  2. Check authentication mechanism (headers, Bearer)
  3. Check if pagination exists
  4. Check filtering/sorting support
  5. Document findings in `.planning/routes-audit.md`

- Categorize routes:
  - Group 1: List endpoints (need pagination, filtering, sorting)
  - Group 2: CRUD endpoints (need RFC 9457 errors, success format)
  - Group 3: Action endpoints (execute, generate, etc.)

- Create route migration checklist:
  - [ ] Response format updated (errorResponse/successResponse)
  - [ ] Middleware context extracted
  - [ ] Pagination added (if list endpoint)
  - [ ] Filtering/sorting added (if list endpoint)
  - [ ] Workspace ID validation added
  - [ ] Zod schema exported (for OpenAPI)
  - [ ] Tests updated

**Success Criteria:**
- [ ] All 32 routes audited and categorized
- [ ] Migration checklist created
- [ ] Audit document in `.planning/routes-audit.md`
- [ ] No routes missed (verify count == 32)

**Files:**
- `.planning/routes-audit.md` (create)
- Spreadsheet or checklist for tracking migration progress

**Verification:**
```bash
# Count API routes
find frontend/src/app/api -name "route.ts" | wc -l
# Should output: 32

# Check audit document exists and is complete
cat .planning/routes-audit.md
```

---

## Wave 3: Route Standardization & Rate Limiting (Days 5-6)

Migrate all 32 routes to new standards in batches.

### Task 3.1: Batch 1 — Agent Routes (8 routes)

**Requirement:** API-01, API-02, API-03, API-04, API-07, API-08, API-09

**Objective:** Standardize all agent-related routes.

**Routes in Batch 1:**
1. `GET /api/agents` — List agents
2. `POST /api/agents` — Register agent
3. `GET /api/agents/{agentId}` — Get agent details
4. `PATCH /api/agents/{agentId}` — Update agent
5. `GET /api/agents/{agentId}/tasks` — List agent's tasks
6. `POST /api/agents/{agentId}/rotate-key` — Rotate API key
7. `GET /api/agents/{agentId}/metrics` — Get agent metrics
8. `POST /api/agents/{agentId}/heartbeat` — Heartbeat (keep-alive)

**Per-Route Changes:**
- Update response format: use `successResponse()` and `errorResponse()`
- Update URL pattern: `/api/v1/workspaces/{workspaceId}/agents/...`
- Extract workspace ID from URL
- Add rate limit check (from middleware)
- Add Zod schema export (for OpenAPI)
- Update/add pagination (for list endpoints):
  - `GET /api/agents` → support `?limit=20&cursor=...&status=active&sort=-createdAt`
  - `GET /api/agents/{agentId}/tasks` → support `?limit=50&cursor=...&status=pending`
- Update tests to validate RFC 9457 error format

**Success Criteria:**
- [ ] All 8 routes respond with RFC 9457 errors
- [ ] All list endpoints support cursor pagination
- [ ] All endpoints accept `Authorization: Bearer` header
- [ ] Rate limits checked on every request
- [ ] All routes have exported Zod schemas
- [ ] Unit tests pass (8/8)
- [ ] Integration tests pass (8/8)

**Files:**
- `frontend/src/app/api/agents/route.ts` (update)
- `frontend/src/app/api/agents/[agentId]/route.ts` (update)
- `frontend/src/app/api/agents/[agentId]/tasks/route.ts` (update)
- `frontend/src/app/api/agents/[agentId]/rotate-key/route.ts` (update)
- `frontend/src/app/api/agents/[agentId]/metrics/route.ts` (update)
- `frontend/src/app/api/agents/[agentId]/heartbeat/route.ts` (update)
- Plus any child routes
- Update corresponding test files

**Verification:**
```bash
# Run agent route tests
npm test -- frontend/src/app/api/agents/__tests__/

# Verify OpenAPI spec generation (after Task 3.3)
curl http://localhost:3000/api/openapi | jq '.paths | keys[] | select(contains("agents"))'
```

---

### Task 3.2: Batch 2 — Task Routes (5 routes)

**Requirement:** API-01, API-02, API-03, API-04, API-07, API-08, API-09

**Objective:** Standardize all task-related routes.

**Routes in Batch 2:**
1. `GET /api/tasks` — List tasks
2. `POST /api/tasks` — Create task
3. `GET /api/tasks/{taskId}` — Get task details
4. `PATCH /api/tasks/{taskId}` — Update task
5. `DELETE /api/tasks/{taskId}` — Delete task

(+ child routes for calendar events, comments, etc., handled in Task 3.3)

**Per-Route Changes:**
- Same as Batch 1: RFC 9457 errors, success format, pagination, workspace context, rate limits, Zod schemas

**Success Criteria:**
- [ ] All 5 routes pass tests
- [ ] Pagination works with filtering and sorting
- [ ] Error responses include request ID

**Files:**
- `frontend/src/app/api/tasks/route.ts` (update)
- `frontend/src/app/api/tasks/[taskId]/route.ts` (update)
- Plus related child routes
- Update corresponding test files

**Verification:**
```bash
npm test -- frontend/src/app/api/tasks/__tests__/
```

---

### Task 3.3: Batch 3 — Remaining Routes (19 routes)

**Requirement:** API-01, API-02, API-03, API-04, API-07, API-08, API-09

**Objective:** Standardize all remaining routes (calendar, memory, gateway, admin, state-engine, business, health, openapi).

**Routes in Batch 3:**
- Calendar: 5 routes (events, slots, create, schedule, mark-executed)
- Memory: 3 routes (context, files, base)
- Gateway: 1 route (status check)
- Admin: 2 routes (health, openapi)
- State-engine: 3 routes (list, get, execute)
- Business/Epics/Reports: 5 routes (various CRUD)

**Per-Route Changes:**
- Same as Batches 1 & 2

**Special Cases:**
- `/api/health`: May not need full RFC 9457 format (simple health check), but should still include requestId
- `/api/openapi`: Stays as-is (returns OpenAPI spec JSON), no RFC 9457 wrapper needed

**Success Criteria:**
- [ ] All 19 routes updated
- [ ] All tests pass (19+ test suites)
- [ ] Both `/api/` and `/api/v1/` paths work (verify in Task 3.4)

**Files:**
- All remaining route files in `frontend/src/app/api/`
- Update corresponding test files

---

### Task 3.4: Dual-Path Support (Backwards Compatibility)

**Requirement:** API-12

**Objective:** Ensure both `/api/` and `/api/v1/` paths work identically during transition.

**Scope:**
- Implement route aliasing or redirect:
  - Option A: Next.js rewrites (in `next.config.js`): `/api/*` → `/api/v1/workspaces/{default}/*`
  - Option B: Route proxying (single handler for both paths)
  - Option C: Duplicate routes (manual, least elegant)

  **Recommended: Option A (rewrites)** — cleanest, no code duplication
  ```js
  // next.config.js
  const nextConfig = {
    async rewrites() {
      return {
        beforeFiles: [
          {
            source: '/api/:path*',
            destination: '/api/v1/workspaces/:workspace/:path*',
            // Extract workspace ID from auth context (requires middleware)
          },
        ],
      };
    },
  };
  ```

- Alternatively, create a wrapper that:
  1. Detects `/api/` prefix (not `/api/v1/`)
  2. Injects default workspace ID
  3. Forwards to `/api/v1/` equivalent

- Add deprecation headers to `/api/` responses:
  - `Deprecation: true`
  - `Sunset: Wed, 26 Aug 2026 00:00:00 GMT` (6 months from now)
  - `Link: <https://docs.mission-control.dev/api-migration>; rel="deprecation"`

**Success Criteria:**
- [ ] Both `/api/agents` and `/api/v1/workspaces/{id}/agents` return same response
- [ ] Deprecation headers on `/api/` responses
- [ ] Old routes still work (no breaking changes)
- [ ] E2E tests verify both paths (Task 4.3)

**Files:**
- `next.config.js` (update rewrites or middleware config)
- `frontend/src/middleware.ts` (if handling rewriting)

**Verification:**
```bash
# Test both paths return same response
curl http://localhost:3000/api/agents -H "agentId: abc" -H "agentKey: xyz" | jq .
curl http://localhost:3000/api/v1/workspaces/ws-123/agents -H "Authorization: Bearer xyz" | jq .
# Compare output (minus version indicators)
```

---

## Wave 4: OpenAPI & Testing (Days 7-8)

Generate documentation and comprehensive test suite.

### Task 4.1: OpenAPI Spec Generation

**Requirement:** API-10

**Objective:** Auto-generate OpenAPI 3.0 spec from Zod schemas in routes.

**Scope:**
- Update all 32 routes to export Zod schemas:
  ```typescript
  // Example in frontend/src/app/api/agents/route.ts
  export const ListAgentsRequestSchema = z.object({
    limit: z.number().min(1).max(100).default(20),
    cursor: z.string().optional(),
    status: z.enum(['active', 'inactive']).optional(),
  });

  export const ListAgentsResponseSchema = z.object({
    success: z.literal(true),
    data: z.array(AgentSchema),
    pagination: z.object({
      total: z.number(),
      limit: z.number(),
      cursor: z.string().nullable(),
      nextCursor: z.string().nullable(),
      hasMore: z.boolean(),
    }),
    timestamp: z.string(),
  });
  ```

- Enhance `frontend/src/lib/openapi-generator.ts`:
  - Scan all route files for exported schemas
  - Use `zod-openapi` to convert Zod → OpenAPI definitions
  - Build complete OpenAPI 3.0 spec
  - Include all 32 endpoints with:
    - Request body/query schemas
    - Response schemas (success + error examples)
    - Status codes (200, 400, 401, 429, 500)
    - Descriptions
    - Example requests/responses

- Endpoint: `GET /api/openapi` returns generated spec
  ```json
  {
    "openapi": "3.0.0",
    "info": {
      "title": "Mission Control API",
      "version": "1.0.0"
    },
    "paths": {
      "/v1/workspaces/{workspaceId}/agents": {
        "get": { ... },
        "post": { ... }
      },
      ...
    }
  }
  ```

- Build-time validation:
  - Add npm script: `npm run validate:openapi`
  - Checks all routes have schemas
  - Validates spec against OpenAPI 3.0 schema
  - Fails build if validation errors

**Success Criteria:**
- [ ] OpenAPI spec generated successfully
- [ ] All 32 endpoints documented
- [ ] Each endpoint has request + response schemas
- [ ] Error example included (400, 401, 429)
- [ ] Spec validates against OpenAPI 3.0 standard
- [ ] Spec includes: servers, security schemes, components
- [ ] Build task validates spec

**Files:**
- `frontend/src/lib/openapi-generator.ts` (enhance)
- All 32 route files (add Zod schema exports)
- `package.json` (add `validate:openapi` script)

**Verification:**
```bash
# Generate and validate spec
npm run validate:openapi

# Fetch spec
curl http://localhost:3000/api/openapi | jq '.paths | keys | length'
# Should output: 32+ (including child routes)

# Validate spec
npm install -g openapi-cli
openapi validate /tmp/spec.json
```

---

### Task 4.2: Swagger UI Integration

**Requirement:** API-11

**Objective:** Serve Swagger UI at `/api/docs` with Try-It-Out functionality.

**Scope:**
- Create `frontend/src/app/api/docs/route.ts`:
  - Serves HTML page with Swagger UI mounted
  - Points to `/api/openapi` as spec source
  - Enables Try-It-Out mode (allows authenticated requests from UI)
  - Includes default workspace ID selector (for testing)

- HTML template includes:
  ```html
  <!DOCTYPE html>
  <html>
    <head>
      <title>Mission Control API Docs</title>
      <link rel="stylesheet" type="text/css" href="/swagger-ui.css">
    </head>
    <body>
      <div id="swagger-ui"></div>
      <script src="/swagger-ui.js"></script>
      <script>
        SwaggerUIBundle({
          url: "/api/openapi",
          dom_id: '#swagger-ui',
          presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
          layout: "StandaloneLayout",
          deepLinking: true,
          persistAuthorization: true,
        });
      </script>
    </body>
  </html>
  ```

- Try-It-Out mode:
  - User enters API key in UI
  - Swagger sends requests with `Authorization: Bearer {apiKey}` header
  - Workspace ID included in URL (selectable from dropdown)

- Styling:
  - Dark theme (optional)
  - Responsive design
  - Clear endpoint organization by domain (agents, tasks, calendar, etc.)

**Success Criteria:**
- [ ] Swagger UI loads at `http://localhost:3000/api/docs`
- [ ] All 32 endpoints visible with descriptions
- [ ] Try-It-Out works (can send requests from UI)
- [ ] Successful request shows response + response code
- [ ] Error request shows error details with request ID
- [ ] Workspace ID selectable for testing
- [ ] API key persisted in browser storage

**Files:**
- `frontend/src/app/api/docs/route.ts` (create)
- `frontend/public/swagger-ui-standalone-preset.js` (if needed)
- `frontend/public/swagger-ui.css` (if needed)

**Verification:**
```bash
# Start frontend
npm run dev

# Open browser
open http://localhost:3000/api/docs

# Manually test: Enter API key, try to list agents
# Verify: Request/response shown in UI, no CORS errors
```

---

### Task 4.3: Comprehensive E2E Test Suite

**Requirement:** All (API-01 through API-12)

**Objective:** Create E2E tests that verify all API requirements and prevent regressions.

**Scope:**
- Create `frontend/e2e/api-standardization.spec.ts` with 11+ test scenarios:

1. **REST Compliance (API-01):**
   - [ ] GET returns 200
   - [ ] POST returns 201 (if creating resource)
   - [ ] PATCH returns 200 (or 204)
   - [ ] DELETE returns 204
   - [ ] All methods are idempotent where expected

2. **Error Response Format (API-02):**
   - [ ] 400 error includes: `type`, `title`, `detail`, `instance`, `status`, `requestId`, `timestamp`
   - [ ] 401 error on missing auth
   - [ ] 404 error on not found
   - [ ] 500 error on server error
   - [ ] Request ID unique across requests

3. **Success Response Format (API-03):**
   - [ ] All success responses: `{success: true, data: {...}, timestamp: ISO8601}`
   - [ ] List responses include pagination metadata

4. **Cursor Pagination (API-04):**
   - [ ] List endpoint accepts `?limit=20&cursor=...`
   - [ ] First request returns: `{data: [...], pagination: {total, limit, cursor, nextCursor, hasMore}}`
   - [ ] Second request with cursor returns next page
   - [ ] Expired cursor rejected (> 5 minutes)
   - [ ] Max limit 100 enforced

5. **Filtering (API-05):**
   - [ ] List endpoint accepts filters: `?status=pending&priority=high`
   - [ ] Returned items match filter criteria
   - [ ] Invalid filter returns empty or 400

6. **Sorting (API-06):**
   - [ ] List endpoint accepts sort: `?sort=-createdAt` (descending)
   - [ ] List endpoint accepts sort: `?sort=name` (ascending)
   - [ ] Results ordered correctly

7. **Workspace Context (API-07):**
   - [ ] URL pattern includes workspace: `/api/v1/workspaces/{id}/...`
   - [ ] Missing workspace ID returns 400
   - [ ] Invalid workspace ID returns 404
   - [ ] Agent verified to be in workspace (soft check)

8. **Authentication (API-08):**
   - [ ] Bearer token accepted: `Authorization: Bearer {apiKey}`
   - [ ] Legacy headers accepted: `agentId`, `agentKey`
   - [ ] Missing auth returns 401
   - [ ] Invalid token returns 401
   - [ ] API key rotation: old key valid during grace period (24h)

9. **Rate Limiting (API-09):**
   - [ ] Request includes rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
   - [ ] After 1000 requests: next request returns 429
   - [ ] 429 response includes: `{retryAfter, resetAt}`
   - [ ] Rate limit resets after 1 hour

10. **OpenAPI & Swagger (API-10, API-11):**
    - [ ] GET /api/openapi returns valid OpenAPI 3.0 spec
    - [ ] Spec includes all 32 endpoints
    - [ ] Each endpoint has request + response schemas
    - [ ] Swagger UI loads at /api/docs
    - [ ] Try-It-Out sends request with correct auth

11. **API Versioning (API-12):**
    - [ ] GET /api/agents and GET /api/v1/workspaces/{id}/agents return same data
    - [ ] Deprecation headers on `/api/` routes: `Deprecation: true`, `Sunset: ...`
    - [ ] Both paths return identical responses

12. **No Breaking Changes:**
    - [ ] Existing agent integration test passes (old paths still work)
    - [ ] Response format backwards compatible

**Test Structure:**
```typescript
import { test, expect } from '@playwright/test';

test.describe('API Standardization', () => {
  test('should support cursor pagination', async ({ request }) => {
    // Fetch first page
    const page1 = await request.get('/api/v1/agents?limit=10');
    expect(page1.status()).toBe(200);
    const data1 = await page1.json();
    expect(data1.pagination.nextCursor).toBeDefined();

    // Fetch second page
    const page2 = await request.get(`/api/v1/agents?limit=10&cursor=${data1.pagination.nextCursor}`);
    expect(page2.status()).toBe(200);
  });

  test('should enforce rate limits', async ({ request }) => {
    // Make 1000 requests
    for (let i = 0; i < 1000; i++) {
      const response = await request.get('/api/v1/agents');
      expect(response.status()).toBe(200);
    }

    // 1001st request should fail
    const response = await request.get('/api/v1/agents');
    expect(response.status()).toBe(429);
    const data = await response.json();
    expect(data.retryAfter).toBeDefined();
    expect(data.resetAt).toBeDefined();
  });

  // ... 9 more tests
});
```

**Success Criteria:**
- [ ] All 12 test scenarios pass
- [ ] No regressions in existing functionality
- [ ] Tests run in CI/CD pipeline
- [ ] Test execution < 5 minutes

**Files:**
- `frontend/e2e/api-standardization.spec.ts` (create)

**Verification:**
```bash
# Run E2E tests
npm run e2e

# Run with UI
npm run e2e:ui

# Check coverage
npm run e2e -- --reporter=html
```

---

### Task 4.4: Documentation & Migration Guide

**Requirement:** All (communication + agent support)

**Objective:** Document API changes and provide migration guide for agents.

**Scope:**
- Create `docs/API-MIGRATION.md`:
  - Title: "API Migration Guide — v1.0"
  - Sections:
    1. **What's Changing:** Overview of new endpoints, error format, auth
    2. **Timeline:** Deprecation window (6 months), sunset date
    3. **Old vs New:**
       ```
       OLD: GET /api/agents with agentId + agentKey headers
       NEW: GET /api/v1/workspaces/{id}/agents with Authorization: Bearer {apiKey}
       ```
    4. **New Features:**
       - Cursor pagination: `?limit=20&cursor=...`
       - Filtering: `?status=active`
       - Sorting: `?sort=-createdAt`
    5. **Error Format:** RFC 9457 example with request ID
    6. **API Docs:** Link to Swagger UI at /api/docs
    7. **Support:** Contact info for questions

- Update root `README.md` to link to migration guide
- Add changelog entry in `CHANGELOG.md`

**Success Criteria:**
- [ ] Migration guide written and clear
- [ ] Examples include old and new code
- [ ] Timeline clearly communicated
- [ ] All requirements documented
- [ ] Linked from API docs and README

**Files:**
- `docs/API-MIGRATION.md` (create)
- `README.md` (update with link)
- `CHANGELOG.md` (update)

**Verification:**
```bash
# Check file exists and is readable
cat docs/API-MIGRATION.md | head -50
```

---

## Verification Criteria

Before marking Phase 1 complete, verify all must-haves:

### Manual Checklist

- [ ] All 32 routes accessible via `/api/v1/`
  - [ ] Count routes: `find frontend/src/app/api -name "route.ts" | wc -l` == 32
  - [ ] Sample routes: `/api/v1/agents`, `/api/v1/tasks`, `/api/v1/calendar/events`

- [ ] Error responses in RFC 9457 format
  - [ ] Test invalid request: `curl -X GET http://localhost:3000/api/v1/agents (no auth)`
  - [ ] Response includes: `type`, `title`, `detail`, `instance`, `status`, `requestId`
  - [ ] Request ID is unique

- [ ] Cursor pagination working
  - [ ] `/api/v1/agents?limit=5` returns max 5 items + nextCursor
  - [ ] `/api/v1/agents?cursor={nextCursor}` returns next page
  - [ ] Expired cursor (> 5 min) rejected

- [ ] Rate limiting enforced
  - [ ] After 1000 requests/hour, next request returns 429
  - [ ] 429 response includes `retryAfter` and `resetAt`
  - [ ] Rate limits reset per API key (not global)

- [ ] OpenAPI spec complete
  - [ ] `/api/openapi` returns valid spec
  - [ ] All 32 endpoints documented
  - [ ] Each endpoint has request/response schemas

- [ ] Swagger UI functional
  - [ ] `/api/docs` loads in browser
  - [ ] All endpoints visible
  - [ ] Try-It-Out works (can send test request)

- [ ] Bearer token auth working
  - [ ] `curl -H "Authorization: Bearer {key}" http://localhost:3000/api/v1/agents` works
  - [ ] Missing token returns 401
  - [ ] Invalid token returns 401

- [ ] Backwards compatibility maintained
  - [ ] `/api/agents` and `/api/v1/workspaces/{id}/agents` return same data
  - [ ] Existing agent integration tests pass
  - [ ] Deprecation headers on old routes

### Automated Tests

```bash
# Run all tests
npm test

# Expected results:
# - All 32 route test suites pass
# - All 11 E2E scenarios pass
# - No regressions
# - Coverage > 80%

# Build validation
npm run build
npm run validate:openapi

# Expected: No TypeScript errors, spec valid
```

### Smoke Tests (Manual Verification)

1. **Start backend + frontend:**
   ```bash
   # Terminal 1
   npm run convex:dev

   # Terminal 2
   npm run dev
   ```

2. **Test agent registration:**
   ```bash
   curl -X POST http://localhost:3000/api/v1/agents \
     -H "Content-Type: application/json" \
     -d '{"name": "test-agent", "endpoint": "http://localhost:8000"}'
   ```
   Expected: 201 response with agent ID and API key

3. **Test with API key:**
   ```bash
   curl http://localhost:3000/api/v1/agents \
     -H "Authorization: Bearer {api-key-from-step-2}"
   ```
   Expected: 200 response with agent list

4. **Test rate limiting:**
   ```bash
   # Run 1001 requests (script)
   for i in {1..1001}; do
     curl http://localhost:3000/api/v1/agents \
       -H "Authorization: Bearer {api-key}" \
       -s -o /dev/null -w "%{http_code}\n"
   done
   ```
   Expected: 200 for first 1000, 429 for 1001st

5. **Test Swagger UI:**
   - Open browser to `http://localhost:3000/api/docs`
   - Expected: Swagger UI loads, all endpoints listed

6. **Test backwards compatibility:**
   ```bash
   curl http://localhost:3000/api/agents \
     -H "agentId: {id}" -H "agentKey: {key}"
   ```
   Expected: 200 response (same as `/api/v1/...`)

### Acceptance Criteria (Phase Gate)

Phase 1 is **COMPLETE** when:

✅ All 32 routes migrated to `/api/v1/`
✅ All error responses RFC 9457 compliant
✅ All list endpoints support cursor pagination
✅ Rate limiting enforced (1000 req/hour per API key)
✅ OpenAPI spec auto-generated, includes all endpoints
✅ Swagger UI operational with Try-It-Out
✅ Bearer token auth working
✅ Both `/api/` and `/api/v1/` paths functional
✅ E2E test suite passing (11+ scenarios)
✅ Zero breaking changes to agents
✅ Code review approved
✅ All tests passing (`npm test`)
✅ Build clean (`npm run build`)

---

## Dependencies & Risks

### Critical Dependencies

**Already in place:**
- ✅ Convex 1.32.0 (supports mutations, queries, indexes)
- ✅ Zod 4.3.6 (validation)
- ✅ zod-openapi 5.4.6 (OpenAPI generation)
- ✅ Swagger UI React 5.31.1 (UI component)
- ✅ Next.js 14+ (middleware, rewrites)

**Must complete before Phase 1:**
- None. All infrastructure exists.

### Potential Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Breaking changes to agents during migration | HIGH | Support both `/api/` and `/api/v1/` simultaneously; 6-month deprecation window |
| Rate limiting too aggressive | MEDIUM | Start with 1000 req/hr; monitor usage; adjust if needed |
| Performance overhead from Convex mutations | MEDIUM | Optimize token bucket lookup; consider caching (Phase 2) |
| OpenAPI spec generation brittleness | MEDIUM | Fail build if schema missing; add pre-commit validation |
| Cursor pagination complexity | LOW | Keep cursors simple (offset + timestamp); accept expired cursors with warning |
| RFC 9457 response bloat | LOW | Keep old fields for backwards compat; Phase v2 can be pure RFC 9457 |

### Rollback Plan

If Phase 1 breaks agents or causes issues:

1. **Keep old `/api/` routes as primary** (revert v1 as secondary)
2. **Disable rate limiting** (set quota very high: 100k req/hr)
3. **Restore old error response format** (remove RFC 9457 fields)
4. **Maintain dual paths** for 6 months before removal
5. **Communicate clearly** with agent teams on status

Estimated rollback time: < 30 minutes (git revert + redeploy)

---

## Implementation Notes

### Workspace ID Handling

**Current state:** Routes don't validate workspace context (Phase 2 responsibility)

**Phase 1 approach:**
- Extract workspace ID from URL: `/api/v1/workspaces/{id}/...`
- Perform soft validation: workspace exists (basic 404 check)
- Do NOT enforce isolation yet (Phase 2)
- Do NOT verify agent is in workspace (Phase 2)

**Example:**
```typescript
// In route handler
const { workspaceId } = req.params;
const workspace = await convex.query(api.workspaces.getById, {id: workspaceId});
if (!workspace) {
  return errorResponse(404, 'NOT_FOUND', 'Workspace not found', 'Workspace does not exist');
}
// Continue with handler logic (workspace ID available for Convex calls)
```

### Rate Limiting Strategy

**Granularity:** Per API key (not per workspace)
- Fairness: One agent can't monopolize system
- Enforcement: Token bucket in Convex mutation
- Defaults: 1000 req/hr, 10k req/day

**Implementation:**
```typescript
// In route handler
const rateLimitCheck = await convex.mutation(api.rateLimit.checkAndDecrement, {
  apiKeyId: context.apiKeyId,
});

if (!rateLimitCheck.allowed) {
  return errorResponse(429, 'RATE_LIMIT_EXCEEDED', 'Rate limit exceeded',
    `Too many requests. Retry after ${rateLimitCheck.retryAfter} seconds.`,
    {retryAfter: rateLimitCheck.retryAfter, resetAt: rateLimitCheck.resetAt}
  );
}

// Continue with handler logic
```

### Zod Schema Export Pattern

**For OpenAPI generation to work, every route must export schemas:**

```typescript
// frontend/src/app/api/agents/route.ts

export const GetAgentsRequestSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  sort: z.string().optional(),
});

export const GetAgentsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(AgentSchema),
  pagination: PaginationSchema,
  timestamp: z.string(),
});

export async function GET(req: Request) {
  // Route handler
}
```

**OpenAPI generator scans for these exports and builds spec automatically.**

### Testing Strategy

**Unit tests:** Utility functions (pagination, auth, responses) — should pass before Wave 2

**Integration tests:** Each route with mocked Convex — should pass during Wave 3

**E2E tests:** Full end-to-end with real backend — should pass during Wave 4

---

## Success Metrics (Post-Phase 1)

How will we know Phase 1 succeeded?

1. **API Consistency:** All 32 routes follow same patterns (error format, pagination, auth)
2. **Agent Integration:** Existing agents can still poll tickets and report work (backwards compatible)
3. **Documentation:** Agents can discover all endpoints via Swagger UI
4. **Developer Experience:** New agents can integrate using OpenAPI spec (no SDK required)
5. **Observability:** All API calls have request IDs for tracing and debugging
6. **Scalability:** Rate limiting prevents single agents from overwhelming system

---

## Summary

Phase 1 establishes REST API foundation through:

1. **Middleware layer** — Request ID generation, workspace extraction, auth validation, rate limit checking
2. **Response standardization** — RFC 9457 errors, consistent success format, pagination metadata
3. **Cursor pagination** — Base64-encoded cursors with 5-minute expiration
4. **Rate limiting** — Token bucket per API key, 1000 req/hr default
5. **OpenAPI spec** — Auto-generated from Zod schemas, includes all 32 endpoints
6. **Swagger UI** — Interactive documentation with Try-It-Out mode
7. **Bearer token auth** — Modern HTTP auth alongside legacy header support
8. **Backwards compatibility** — Both `/api/` and `/api/v1/` paths work during 6-month transition

**Estimated effort:** 60-80 engineer-hours over 7-10 calendar days

**Critical path:** Schema/middleware (Day 1-2) → Route migrations (Day 3-6) → OpenAPI/testing (Day 7-8)

**No blockers.** All infrastructure exists; execution is primarily integration work.

---

*Plan created: 2026-02-26*
*Phase: 01-rest-api-foundation*
*Status: Ready for execution*
