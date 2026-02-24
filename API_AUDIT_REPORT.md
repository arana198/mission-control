# Mission Control REST API Audit Report
**Date:** February 24, 2026
**Scope:** Complete backend API surface (Convex-based architecture)
**Model:** Real-time agent orchestration system with multi-tenant support

---

## Executive Summary

### Overall API Quality Score: 6.5/10

**Status:** Good foundation with significant structural concerns for long-term scalability and developer experience.

#### Critical Findings:
- ✅ **Strong Points:** Comprehensive data model, multi-tenant isolation, Zod validation, activity logging
- ⚠️ **Major Concerns:** No standardized error handling, inconsistent response shapes, lack of API versioning, no pagination standards
- 🔴 **Risks:** Difficult for third-party API consumers, scaling error handling will be costly, no clear upgrade path

#### Quick Impact Assessment:
| Risk Level | Area | Impact |
|-----------|------|--------|
| 🔴 HIGH | Error Handling | Breaking changes likely when errors standardized; complex refactoring |
| 🔴 HIGH | Response Envelope | Inconsistent client expectations; unnecessary debugging |
| ⚠️ MEDIUM | Pagination | N+1 queries, OOM risk on large datasets |
| ⚠️ MEDIUM | API Naming | Developer confusion; decreased DX |
| 🟡 LOW | Type Safety | Currently good; fragile without versioning |

---

## 1. Resource Design & URL Structure

### Current State
Convex-based architecture uses `module.function` naming rather than HTTP URLs:
```
// Current pattern
tasks.create({ businessId, title, ... })
tasks.updateTask({ taskId, status, ... })
agents.updateStatus({ agentId, status, ... })
```

### Issues Identified

| Issue | Severity | Finding |
|-------|----------|---------|
| **Inconsistent Verb Naming** | MEDIUM | Mix of `create`, `update`, `get*`, `add*`, `remove*` |
| **No Resource Hierarchy** | MEDIUM | No clear `/businesses/:id/tasks/:id` style relationships |
| **Flat Function Namespace** | MEDIUM | 248 functions across 32 modules with no clear grouping |
| **No Versioning Strategy** | HIGH | No `/v1/` prefix or header-based versioning; breaking changes have no escape hatch |

### Examples of Inconsistency

```typescript
// Naming inconsistency: getter patterns
agents.getAllAgents()      // Plural, no args
agents.getAgentById()      // Singular with ID arg
agents.getByName()         // getBy* pattern
agents.getWithCurrentTask() // different naming
businesses.getDefault()     // getDefault instead of getDefaultBusiness

// Pattern mismatch: creation
tasks.create()             // lowercase
epics.createEpic()         // object reference + action
goals.create()             // lowercase

// Update patterns
tasks.updateTask()         // verbose
agents.updateStatus()      // specific field update
epics.updateEpic()         // object reference
```

### Recommendation
**Standardize to resource-centric naming:**
```typescript
// Proposed pattern (not implemented)
tasks.list()          // All tasks (business scoped)
tasks.get(id)         // Single task
tasks.create()        // New task
tasks.update(id)      // Update task
tasks.delete(id)      // Delete task

agents.list()         // All agents
agents.get(id)        // Single agent
agents.getByName()    // Alternative lookup
```

---

## 2. HTTP Method Semantics & Convex Equivalents

### Current Implementation
Convex uses three function types (not HTTP verbs):
- **Queries**: Read-only, cacheable
- **Mutations**: Write operations, serialized per-document
- **Actions**: Async jobs, external integrations

### Analysis

| Category | Status | Issue |
|----------|--------|-------|
| **Safe vs Unsafe** | ✅ OK | Queries are read-only; mutations handle writes |
| **Idempotency** | ❌ MISSING | No idempotency keys for POST-equivalent mutations |
| **Partial Updates** | ⚠️ MIXED | `update()` functions accept partial args; no PATCH vs PUT distinction |
| **Conditional Operations** | ❌ MISSING | No ETags or conditional mutation semantics |

### Critical Issue: Missing Idempotency
For mutable operations that might retry:
```typescript
// Current: No idempotency protection
export const create = mutation({
  args: { businessId, title, description },
  handler: async (ctx, args) => {
    return await ctx.db.insert("businesses", { ... });
  }
});

// Proposed: Idempotency key support
export const create = mutation({
  args: {
    businessId,
    title,
    description,
    idempotencyKey: convexVal.optional(convexVal.string()), // NEW
  },
  handler: async (ctx, args) => {
    // Check if already created with this key
    // Return existing if found
    // Create new otherwise
  }
});
```

### Recommendation
- Document which mutations are idempotent (likely most are safe to retry)
- Add idempotency key support for critical operations (task creation, epic creation, agent assignment)
- Use Convex's atomic transactions to prevent duplicate writes

---

## 3. Status Codes & Error Handling

### Current State: Generic Error Throwing ⚠️

```typescript
// Pattern: Raw error strings throughout
throw new Error("Epic not found");
throw new Error("Agent not found");
throw new Error("Task is already highest priority");
throw new Error("Invalid slug format. Use only lowercase letters, numbers, and hyphens.");
throw new Error("Business with slug \"X\" already exists.");
throw new Error("Maximum 5 businesses allowed per workspace.");
```

### Problems

| Issue | Count | Severity | Impact |
|-------|-------|----------|--------|
| **No Error Codes** | 60+ | HIGH | Clients must parse error messages as strings |
| **Inconsistent Messages** | N/A | HIGH | No machine-readable semantics |
| **No Error Hierarchy** | N/A | MEDIUM | Can't distinguish validation errors from system errors |
| **No Retry Logic** | N/A | MEDIUM | Clients don't know which errors are transient |
| **No Request ID** | N/A | MEDIUM | Impossible to trace errors in logs |

### Error Pattern Mapping

```
Current Errors → Should Be:

"Task not found"           → NOT_FOUND (404 equivalent)
"Agent already assigned"   → CONFLICT (409 equivalent)
"Invalid slug format"      → VALIDATION_ERROR (422 equivalent)
"Maximum 5 businesses"     → LIMIT_EXCEEDED (429 equivalent)
"Epic does not belong"     → FORBIDDEN (403 equivalent)
"Circular dependency"      → INVALID_STATE (422 equivalent)
```

### Recommended Error Schema

```typescript
// lib/errors.ts
export enum ApiErrorCode {
  // Client Errors
  VALIDATION_ERROR = "VALIDATION_ERROR",
  NOT_FOUND = "NOT_FOUND",
  CONFLICT = "CONFLICT",
  FORBIDDEN = "FORBIDDEN",
  LIMIT_EXCEEDED = "LIMIT_EXCEEDED",

  // Server Errors
  INTERNAL_ERROR = "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
}

export interface ApiError extends Error {
  code: ApiErrorCode;
  statusCode: number;
  message: string;
  details?: Record<string, any>;
  requestId?: string;
  retryable: boolean;
}

// Usage in mutations
export const createTask = mutation({
  args: { businessId, title, ... },
  handler: async (ctx, args) => {
    const business = await ctx.db.get(args.businessId);
    if (!business) {
      throw createApiError(
        ApiErrorCode.NOT_FOUND,
        "Business not found",
        404,
        { businessId: args.businessId },
        false // not retryable
      );
    }
    // ...
  }
});

// Wrapper for Convex error handling
function createApiError(
  code: ApiErrorCode,
  message: string,
  statusCode: number,
  details?: Record<string, any>,
  retryable: boolean = false
): ApiError {
  const error = new Error(message) as any;
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  error.retryable = retryable;
  error.requestId = generateRequestId();
  return error;
}
```

### Recommendation
- **Priority 1:** Implement standardized error codes (map to HTTP equivalents)
- **Priority 2:** Add request ID tracking for all mutations
- **Priority 3:** Distinguish validation errors from resource-not-found errors
- **Priority 4:** Document which errors are retryable in API reference

---

## 4. Request & Response Structure

### Current Response Patterns: Inconsistent ⚠️

```typescript
// Pattern 1: Direct object return
export const getAgentById = query({
  args: { agentId: convexVal.id("agents") },
  handler: async (ctx, { agentId }) => {
    return await ctx.db.get(agentId);  // Direct agent object or null
  },
});

// Pattern 2: Wrapped object with metadata
export const autoAssignBacklog = mutation({
  args: { jarvisId, limit },
  handler: async (ctx, { jarvisId, limit = 10 }) => {
    return {
      processed: results.length,
      assigned: results.filter(r => r.success).length,
      results,  // Array of objects
    };
  },
});

// Pattern 3: Array with embedded logic
export const getByProgress = query(async (ctx) => {
  return {
    accelerating: [...],
    onTrack: [...],
    atRisk: [...],
    blocked: [...],
  };
});

// Pattern 4: ID return only
export const createEpic = mutation({
  args: { businessId, title, description, ownerId },
  handler: async (ctx, args) => {
    const epicId = await ctx.db.insert("epics", { ... });
    return epicId;  // Just ID string
  },
});

// Pattern 5: Full object return
export const create = mutation({
  args: { name, slug, ... },
  handler: async (ctx, { ... }) => {
    const businessId = await ctx.db.insert("businesses", { ... });
    return await ctx.db.get(businessId);  // Full object
  },
});
```

### Issues

| Issue | Example | Severity |
|-------|---------|----------|
| **Inconsistent Creation Returns** | `createEpic()` returns ID; `create()` returns full object | HIGH |
| **No Envelope Consistency** | Mix of direct objects, wrapped objects, and arrays | HIGH |
| **Null Handling** | Some return `null`, others `undefined` or throw | MEDIUM |
| **Pagination Missing** | `take(500)` with no cursor/offset pattern | HIGH |
| **Denormalization Inconsistency** | Some include nested objects; others don't | MEDIUM |

### Recommended Response Envelope

```typescript
// lib/responses.ts

// Single Resource Response
export interface ResourceResponse<T> {
  data: T;
  meta: {
    timestamp: number;
    requestId: string;
  };
}

// List Response with Pagination
export interface ListResponse<T> {
  data: T[];
  pagination: {
    cursor?: string;
    hasMore: boolean;
    count: number;
    limit: number;
  };
  meta: {
    timestamp: number;
    requestId: string;
  };
}

// Bulk Operation Response
export interface BulkOperationResponse {
  processed: number;
  succeeded: number;
  failed: number;
  results: Array<{
    id: string;
    status: "success" | "error";
    message?: string;
    data?: any;
  }>;
  meta: {
    timestamp: number;
    requestId: string;
  };
}

// Proposed Usage:
export const createTask = mutation({
  args: { businessId, title, ... },
  handler: async (ctx, args) => {
    const taskId = await ctx.db.insert("tasks", { ... });
    const task = await ctx.db.get(taskId);
    return {
      data: task,
      meta: {
        timestamp: Date.now(),
        requestId: generateRequestId(),
      }
    };
  }
});
```

### Recommendation
- **Priority 1:** Standardize mutation returns to always include full resource (not just ID)
- **Priority 2:** Implement pagination cursor pattern for all list queries
- **Priority 3:** Wrap all responses with consistent metadata envelope
- **Priority 4:** Add `count` field to paginated responses

---

## 5. Validation & Typing

### Current State: Strong ✅

**Strengths:**
- ✅ Zod schemas for task creation/updates (CreateTaskSchema, UpdateTaskSchema)
- ✅ Convex value validators throughout (convexVal.string(), convexVal.id(), etc.)
- ✅ TypeScript strict mode with generated types
- ✅ Custom validators for specific domains (taskValidators, agentTaskValidators)

**Concerns:**
- ⚠️ Not all mutations use external validators (some only use Convex validators)
- ⚠️ No centralized validation error responses
- ⚠️ No OpenAPI/Swagger schema generation

### Example: Good Validation

```typescript
// Good: External Zod schema
export const CreateTaskSchema = z.object({
  title: z.string()
    .min(VALIDATION.TASK_TITLE_MIN)
    .max(VALIDATION.TASK_TITLE_MAX)
    .trim(),
  description: z.string()
    .min(VALIDATION.TASK_DESC_MIN)
    .max(VALIDATION.TASK_DESC_MAX)
    .trim(),
  priority: z.enum([P0, P1, P2, P3]).default(P2).optional(),
  // ...
});
```

### Example: Weak Validation

```typescript
// Weak: Only inline Convex validators
export const updateAgent = mutation({
  args: {
    agentId: convexVal.id("agents"),
    status: convexVal.union(
      convexVal.literal("idle"),
      convexVal.literal("active"),
      convexVal.literal("blocked")
    ),
  },
  handler: async (ctx, args) => {
    // No explicit validation error response
    if (!agent) throw new Error("Agent not found");
  }
});
```

### Recommendation
- Create validator schema for every mutation (even simple ones)
- Centralize validation in a middleware layer
- Generate OpenAPI schema from Zod validators
- Include validation error details in response

---

## 6. Pagination, Filtering & Sorting

### Current State: Problematic ⚠️

**Pattern:** Hard-coded `take()` with no cursor support
```typescript
export const getAllTasks = query({
  args: { businessId: convexVal.id("businesses") },
  handler: async (ctx, { businessId }) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .order("desc")
      .take(500);  // ❌ Hardcoded limit
  },
});

export const getAllAgents = query({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db.query("agents").take(200);  // ❌ OOM risk
    return agents;
  },
});
```

### Issues

| Issue | Severity | Risk |
|-------|----------|------|
| **No Cursor Pagination** | HIGH | Can't safely paginate large datasets; no deterministic ordering |
| **Hardcoded Limits** | HIGH | OOM risk, inconsistent limits across endpoints (200 vs 500) |
| **No Filtering API** | MEDIUM | Must load all records in memory, then filter |
| **No Sorting API** | MEDIUM | Fixed sort order; clients can't customize |
| **No Count/Total** | MEDIUM | Clients can't estimate pagination depth |

### Recommended Pagination Pattern

```typescript
// lib/pagination.ts
export interface PaginationArgs {
  limit?: number;
  cursor?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
  count: number;
  limit: number;
}

// Usage in queries
export const listTasks = query({
  args: {
    businessId: convexVal.id("businesses"),
    limit: convexVal.optional(convexVal.number()),
    cursor: convexVal.optional(convexVal.string()),
  },
  handler: async (ctx, { businessId, limit = 20, cursor }) => {
    const maxLimit = 100;
    const actualLimit = Math.min(limit, maxLimit);

    let query = ctx.db
      .query("tasks")
      .withIndex("by_business_created_at", (q) => q.eq("businessId", businessId));

    // Decode cursor to find starting point
    let startPosition = 0;
    if (cursor) {
      startPosition = parseInt(atob(cursor), 10);
    }

    // Fetch one extra to determine hasMore
    const items = await query
      .order("desc")
      .skip(startPosition)
      .take(actualLimit + 1);

    const hasMore = items.length > actualLimit;
    const result = items.slice(0, actualLimit);

    return {
      items: result,
      nextCursor: hasMore ? btoa((startPosition + actualLimit).toString()) : undefined,
      hasMore,
      count: result.length,
      limit: actualLimit,
    };
  },
});
```

### Recommendation
- **Priority 1:** Implement cursor-based pagination for all list queries
- **Priority 2:** Add `limit` as configurable parameter (with max bounds)
- **Priority 3:** Add filter/sort query parameters (requires new handler pattern)
- **Priority 4:** Add total count in metadata (separate query if needed)

---

## 7. Authentication & Authorization

### Current State: Missing ⚠️

**Observations:**
- No authentication middleware found in Convex functions
- Business scoping enforced via `businessId` parameter
- No role-based access control (RBAC) validation
- API key rotation exists in schema but not enforced in handlers

### Issues

| Issue | Severity | Location |
|-------|----------|----------|
| **No Auth Middleware** | HIGH | All queries/mutations assume trusted caller |
| **Business ID Not Validated** | MEDIUM | Client passes `businessId` - no enforcement it belongs to them |
| **No RBAC** | MEDIUM | Agent roles exist but not checked in mutations |
| **No Scope Enforcement** | HIGH | Agent can access any business's tasks |

### Example Vulnerability

```typescript
// ❌ Dangerous: Client chooses businessId
export const getTasks = query({
  args: { businessId: convexVal.id("businesses") },
  handler: async (ctx, { businessId }) => {
    // No check: does caller own this business?
    return await ctx.db
      .query("tasks")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .collect();
  }
});

// ✅ Recommended: Get caller's context
export const getTasks = query({
  args: { limit: convexVal.optional(convexVal.number()) },
  handler: async (ctx, { limit = 20 }) => {
    const userId = await ctx.auth.getUserId();
    if (!userId) throw new ApiError(ApiErrorCode.FORBIDDEN, "Unauthorized");

    const userBusinesses = await ctx.db
      .query("userBusinessAccess")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const businessIds = userBusinesses.map(ub => ub.businessId);

    return await Promise.all(
      businessIds.map(bid =>
        ctx.db
          .query("tasks")
          .withIndex("by_business", (q) => q.eq("businessId", bid))
          .take(limit)
      )
    );
  }
});
```

### Recommendation
- **Priority 1:** Add authentication context to all handlers
- **Priority 2:** Validate business ownership for all business-scoped operations
- **Priority 3:** Implement permission checks (who can create/update tasks)
- **Priority 4:** Document multi-tenant isolation guarantees

---

## 8. Performance & Efficiency

### Current State: At Risk ⚠️

**Observations:**
- Good: Comprehensive indexing strategy in schema
- Concern: Some queries may perform N+1 lookups
- Concern: Hard-coded `take()` limits can cause memory issues

### Identified Issues

```typescript
// Issue 1: N+1 Lookup Pattern
export const getGoalById = query(async (ctx, args: { id: Id<'goals'> }) => {
  const goal = await ctx.db.get(args.id);

  // ❌ N+1: Loads all related tasks serially
  const relatedTasks = await Promise.all(
    goal.relatedTaskIds.map(taskId => ctx.db.get(taskId))
  );

  return { ...goal, tasks: relatedTasks.filter(t => t !== null) };
});

// Issue 2: Unbound Collection Fetches
export const getByProgress = query(async (ctx) => {
  const goals = await ctx.db
    .query("goals")
    .filter(q => q.eq(q.field("status"), "active"))
    .collect();  // ❌ Could be huge

  const goalsWithProgress = await Promise.all(
    goals.map(async (goal) => ({
      ...goal,
      progress: await calculateProgress(ctx, goal._id),
    }))
  );

  return { accelerating: [...], onTrack: [...], atRisk: [...], blocked: [...] };
});

// Issue 3: Missing Indexes for Common Queries
export const getTasksByAgent = query({
  args: { businessId, agentId, limit = 50 },
  handler: async (ctx, { businessId, agentId, limit }) => {
    const tasks = await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("businessId"), businessId))
      .filter((q) => q.eq(q.field("assigneeIds"), [agentId]))  // ❌ Full scan
      .take(limit);
    return tasks;
  }
});
```

### Caching Opportunities

```typescript
// ❌ Currently: Recalculated on every query
export const getAgentLeaderboard = query({
  args: { businessId },
  handler: async (ctx, { businessId }) => {
    const metrics = await ctx.db
      .query("agentMetrics")
      .withIndex("by_agent", (q) => q.eq("agentId", agentId))
      .collect();  // Recalculated every time
    // Compute leaderboard...
  }
});

// ✅ Recommended: Materialized view with cron job
// agentMetricsCache table updated daily
// Queries can include: timeOfLastUpdate, cacheStale boolean
```

### Recommendation
- **Priority 1:** Add bound/limit to all `.collect()` calls; use pagination
- **Priority 2:** Cache expensive calculations (agentLeaderboard, metrics)
- **Priority 3:** Profile N+1 queries; batch loads where possible
- **Priority 4:** Add performance metrics to audit logging

---

## 9. Error Handling & Reliability

### Current State: Fragile ⚠️

**Pattern:** Raw error strings with inconsistent semantics

```typescript
// ❌ Pattern repeated 60+ times
throw new Error("Agent not found");
throw new Error("Task is already highest priority");
throw new Error("Invalid slug format");
throw new Error("Grace period must be between 0 and 300 seconds");
throw new Error("Agent does not belong to this business");
```

### Problems

| Issue | Count | Severity |
|-------|-------|----------|
| **No Machine-Readable Codes** | All errors | HIGH |
| **Duplicate Messages** | 20+ "not found" variants | MEDIUM |
| **No Context** | All errors | HIGH |
| **Inconsistent Format** | Varies | MEDIUM |

### Recommended Error Handling Layer

```typescript
// convex/utils/apiErrors.ts
export enum ErrorCode {
  // 4xx equivalents
  VALIDATION_FAILED = "validation_failed",
  NOT_FOUND = "not_found",
  ALREADY_EXISTS = "already_exists",
  INVALID_TRANSITION = "invalid_transition",
  LIMIT_EXCEEDED = "limit_exceeded",
  FORBIDDEN = "forbidden",

  // 5xx equivalents
  INTERNAL_ERROR = "internal_error",
}

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    public statusCode: number,
    message: string,
    public details?: Record<string, any>,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Usage
export const updateAgent = mutation({
  args: { agentId: convexVal.id("agents"), status: convexVal.string() },
  handler: async (ctx, { agentId, status }) => {
    const agent = await ctx.db.get(agentId);

    if (!agent) {
      throw new ApiError(
        ErrorCode.NOT_FOUND,
        404,
        "Agent not found",
        { agentId },
        false
      );
    }

    if (agent.status === status) {
      throw new ApiError(
        ErrorCode.INVALID_TRANSITION,
        422,
        `Agent already in status: ${status}`,
        { currentStatus: agent.status, requestedStatus: status },
        false
      );
    }

    await ctx.db.patch(agentId, { status, lastHeartbeat: Date.now() });
    return { success: true };
  }
});
```

### Recommendation
- Implement centralized error handler
- Map all errors to standard codes
- Include context fields (IDs, old/new values)
- Add `retryable` flag for transient errors
- Log all errors with request ID and caller context

---

## 10. Findings Table: Comprehensive Issue Map

| Endpoint/Module | Issue | Severity | Best Practice Violated | Recommendation |
|---|---|---|---|---|
| **tasks.create** | Returns object inconsistently | MEDIUM | Response Envelope Standard | Standardize to always return full resource |
| **tasks.list** | Hardcoded limit (500) | HIGH | Pagination Standard | Implement cursor pagination with configurable limit |
| **tasks.updateTask** | Generic error "Task not found" | HIGH | Error Code Standardization | Use ApiError with code NOT_FOUND |
| **agents.getAllAgents** | No limit (take 200) | HIGH | Pagination Standard | Add cursor pagination with max limit |
| **agents.getByName** | Case-insensitive search may hide duplicates | MEDIUM | Uniqueness Constraint | Add unique index on name+business |
| **agents.updateStatus** | No validation of old status | MEDIUM | State Transition Validation | Check allowed transitions |
| **businesses.create** | Validates slug format inline | MEDIUM | Centralized Validation | Use Zod schema for slug |
| **epics.createEpic** | Returns only ID | MEDIUM | Consistency | Return full epic object |
| **epics.getEpicWithDetails** | Recalculates progress on every call | MEDIUM | Caching | Materialize progress calculation |
| **goals.getByProgress** | Recalculates all goals every query | HIGH | Caching / Pagination | Limit to business scope and paginate |
| **messages.create** | No validation of mention IDs | MEDIUM | Input Validation | Validate agent IDs exist before insert |
| **All queries** | No authentication context | HIGH | Multi-Tenant Isolation | Add auth middleware |
| **All mutations** | Inconsistent business scoping validation | MEDIUM | Enforced Isolation | Centralize businessId validation |
| **All mutations** | Generic errors not machine-readable | HIGH | Error Standardization | Implement error codes and envelope |
| **All endpoints** | No request ID tracking | MEDIUM | Observability | Add requestId to all operations |
| **Database queries** | Array membership filtering (N+1) | MEDIUM | Query Optimization | Use denormalized flags or separate index |
| **Auto-assign backlog** | Inline error handling with no codes | MEDIUM | Error Standardization | Use ApiError consistently |

---

## 11. Architectural Weaknesses

### 1. **Lack of API Versioning** 🔴
**Risk Level:** CRITICAL

Currently, breaking changes (like adding required fields to requests) will break all clients with no migration path.

**Solution:**
```typescript
// Proposed: Add version parameter to all mutations
export const createTask_v1 = mutation({ /* current implementation */ });
export const createTask_v2 = mutation({
  args: {
    // v2: new required fields
    businessId,
    title,
    description,
    dueDate: convexVal.optional(...),
    // NEW
    estimateType: convexVal.enum(['points', 'hours']),
  }
});
```

### 2. **Multi-Tenant Isolation Not Enforced at API Boundary** 🔴
**Risk Level:** CRITICAL

A compromised client token could access any business's data.

**Solution:**
```typescript
// Add user-business context layer
interface RequestContext {
  userId: string;
  businessIds: string[];  // Businesses this user has access to
}

// Validate in every handler
export const getTasks = query({
  args: { businessId: convexVal.id("businesses") },
  handler: async (ctx, { businessId }) => {
    const userContext = await getUserContext(ctx);
    if (!userContext.businessIds.includes(businessId)) {
      throw new ApiError(ErrorCode.FORBIDDEN, 403, "Access denied");
    }
    // Safe to proceed
  }
});
```

### 3. **No Response Standardization** 🔴
**Risk Level:** HIGH

Clients must handle multiple response shapes (objects, arrays, IDs, wrapped objects).

**Solution:**
```typescript
// Implement response wrapper middleware
function wrapResponse<T>(data: T, metadata?: any) {
  return {
    data,
    meta: {
      timestamp: Date.now(),
      requestId: generateId(),
      ...metadata
    }
  };
}
```

### 4. **Missing Pagination Standards** 🔴
**Risk Level:** HIGH

Large datasets will cause OOM; no way to iterate results safely.

**Solution:** Implement cursor-based pagination (documented above in Section 6).

### 5. **Error Handling Not Standardized** 🟡
**Risk Level:** HIGH

Clients must parse error messages; no way to distinguish error types programmatically.

**Solution:** Implement ApiError class with codes (documented above in Section 9).

---

## 12. Refactoring Roadmap

### Phase 1: Immediate (Week 1-2)
- ✅ Implement standardized error codes
- ✅ Create ApiError class and centralized error handler
- ✅ Add request ID tracking to all operations

### Phase 2: Short-term (Week 3-4)
- ✅ Implement cursor-based pagination for all list queries
- ✅ Standardize mutation returns (always full resource)
- ✅ Add response envelope wrapper

### Phase 3: Medium-term (Week 5-6)
- ✅ Implement authentication context layer
- ✅ Add business scoping validation to all handlers
- ✅ Create API versioning strategy

### Phase 4: Long-term (Week 7+)
- ✅ Profile and cache expensive calculations
- ✅ Optimize N+1 queries
- ✅ Generate OpenAPI schema from validators
- ✅ Add rate limiting and throttling

---

## 13. Before/After Examples

### Example 1: Task Creation

**BEFORE:**
```typescript
const taskId = await createTask({
  businessId: "biz_123",
  title: "Fix login bug",
  description: "Users can't reset password",
  epicId: "epic_456"
});

// Returns: "t_789" (just string ID)
// Error: throws with message "Task already exists" (unparseable)
```

**AFTER:**
```typescript
const response = await createTask({
  businessId: "biz_123",
  title: "Fix login bug",
  description: "Users can't reset password",
  epicId: "epic_456",
  idempotencyKey: "req_xyz_001"  // NEW: replay protection
});

// Returns:
{
  data: {
    _id: "t_789",
    businessId: "biz_123",
    title: "Fix login bug",
    status: "backlog",
    createdAt: 1708788000000,
    // ... full task object
  },
  meta: {
    timestamp: 1708788000000,
    requestId: "req_xyz_001"
  }
}

// Error: structured
{
  error: {
    code: "already_exists",
    statusCode: 409,
    message: "Task with title 'Fix login bug' already exists in this epic",
    details: {
      taskId: "t_existing",
      existingTitle: "Fix login bug"
    },
    retryable: false
  }
}
```

### Example 2: Pagination

**BEFORE:**
```typescript
const tasks = await getTasks({
  businessId: "biz_123"
});

// Returns: Array of 500 tasks (hardcoded limit)
// Problem: Can't get tasks 501-1000
// Problem: Expensive to load all into memory
```

**AFTER:**
```typescript
const response = await getTasks({
  businessId: "biz_123",
  limit: 20,
  cursor: undefined  // First page
});

// Returns:
{
  data: [
    { _id: "t_001", title: "Task 1", ... },
    { _id: "t_002", title: "Task 2", ... },
    // ... 20 items
  ],
  pagination: {
    cursor: "eyJ0aW1lc3RhbXAiOiAxNzA4Nzg4MDAwLCAib2Zmc2V0IjogMjB9",
    hasMore: true,
    count: 20,
    limit: 20
  },
  meta: {
    timestamp: 1708788000000,
    requestId: "req_page_001"
  }
}

// Next page:
const nextResponse = await getTasks({
  businessId: "biz_123",
  limit: 20,
  cursor: "eyJ0aW1lc3RhbXAiOiAxNzA4Nzg4MDAwLCAib2Zmc2V0IjogMjB9"
});
```

### Example 3: Error Handling

**BEFORE:**
```typescript
try {
  await updateAgentStatus({
    agentId: "agent_123",
    status: "active"
  });
} catch (error) {
  // Must parse error.message as string
  if (error.message.includes("not found")) {
    // Handle 404?
  } else if (error.message.includes("already")) {
    // Handle conflict?
  } else {
    // Generic error
  }
}
```

**AFTER:**
```typescript
try {
  await updateAgentStatus({
    agentId: "agent_123",
    status: "active"
  });
} catch (error) {
  // Machine-readable error code
  if (error.code === "NOT_FOUND") {
    console.log(`Agent ${error.details.agentId} not found`);
  } else if (error.code === "INVALID_TRANSITION") {
    console.log(`Cannot transition from ${error.details.from} to ${error.details.to}`);
  } else if (error.retryable) {
    // Retry logic
  }
  // Include request ID for support
  console.log(`Request ID: ${error.requestId}`);
}
```

---

## 14. Security Recommendations

| Issue | Severity | Fix |
|-------|----------|-----|
| **No input sanitization on descriptions/content** | MEDIUM | Add XSS prevention (sanitize HTML) |
| **Mentions array not validated** | MEDIUM | Validate agent IDs exist before insert |
| **No rate limiting** | MEDIUM | Add rate limit headers + checks |
| **No CORS headers** | LOW | Configure CORS for frontend domain |
| **API key in schema but not enforced** | HIGH | Implement key auth middleware |
| **businessId from client** | HIGH | Get from auth context, not args |

---

## 15. Documentation Gaps

- ❌ No API reference (OpenAPI/Swagger)
- ❌ No error code documentation
- ❌ No pagination guide
- ❌ No authentication requirements
- ❌ No multi-tenant isolation guarantees documented
- ❌ No rate limiting policy
- ❌ No versioning strategy

---

## 16. Recommendations Priority Matrix

### 🔴 Critical (Do immediately)
- [ ] Standardize error codes and error responses
- [ ] Add authentication context to all handlers
- [ ] Validate business ownership for all operations
- [ ] Add request ID tracking

### 🟠 High (Do this sprint)
- [ ] Implement cursor-based pagination
- [ ] Standardize response envelope
- [ ] Add input validation layer

### 🟡 Medium (Do next sprint)
- [ ] Add API versioning strategy
- [ ] Cache expensive calculations
- [ ] Optimize N+1 queries
- [ ] Generate OpenAPI schema

### 🟢 Low (Backlog)
- [ ] Add rate limiting
- [ ] Implement response filtering/projection
- [ ] Add GraphQL alternative (optional)

---

## 17. Conclusion

**Current State:** This is a well-architected multi-tenant backend with comprehensive data modeling and strong type safety. However, it lacks critical patterns required for production REST API consumption:

1. **Error handling** is not standardized
2. **Response shapes** are inconsistent
3. **Pagination** is missing
4. **Authentication** is not enforced at API boundary
5. **Versioning** has no strategy

**If this API is for internal use only** (frontend + agents), current state is acceptable.

**If this API is for third-party consumption or public release,** the critical issues (1-4) must be addressed before launch to prevent breaking changes.

**Recommended Action:** Implement phases 1-2 (error handling + pagination + response envelope) before any public API announcements. This will provide a stable foundation for future evolution.

**Estimated Effort:**
- Phase 1: 40 hours
- Phase 2: 30 hours
- Phase 3: 50 hours
- Phase 4: 60+ hours

---

**Report Generated:** February 24, 2026
**Auditor:** API Architecture Review
**Next Review:** Recommended after Phase 2 completion
