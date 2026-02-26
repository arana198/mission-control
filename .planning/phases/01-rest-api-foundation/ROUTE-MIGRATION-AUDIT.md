# Phase 1: Wave 3 — Route Migration Audit

**Status:** Audit Complete | 34 Routes Categorized
**Last Updated:** 2026-02-26

## Summary

All 34 existing API routes have been identified, categorized, and organized into 3 migration batches:
- **Batch 1 (Agent Routes):** 13 routes — HIGHEST PRIORITY
- **Batch 2 (Task/Epic/Business Routes):** 10 routes
- **Batch 3 (Remaining Routes):** 11 routes

---

## Batch 1: Agent Routes (13 routes) — HIGHEST PRIORITY

These are the most critical routes used by agents themselves. Must be migrated first to unblock agent functionality.

| # | Current Path | Target Path | Method | Type | Handler | Status |
|---|---|---|---|---|---|---|
| 1 | `/api/agents` | `/api/v1/workspaces/{wsId}/agents` | GET | LIST | `getAgents()` | ⏳ PENDING |
| 2 | `/api/agents` | `/api/v1/workspaces/{wsId}/agents` | POST | CREATE | `createAgent()` | ⏳ PENDING |
| 3 | `/api/agents/[agentId]` | `/api/v1/workspaces/{wsId}/agents/{agentId}` | GET | READ | `getAgent()` | ⏳ PENDING |
| 4 | `/api/agents/[agentId]` | `/api/v1/workspaces/{wsId}/agents/{agentId}` | PUT | UPDATE | `updateAgent()` | ⏳ PENDING |
| 5 | `/api/agents/[agentId]` | `/api/v1/workspaces/{wsId}/agents/{agentId}` | DELETE | DELETE | `deleteAgent()` | ⏳ PENDING |
| 6 | `/api/agents/[agentId]/heartbeat` | `/api/v1/workspaces/{wsId}/agents/{agentId}/heartbeat` | POST | ACTION | `heartbeat()` | ⏳ PENDING |
| 7 | `/api/agents/[agentId]/poll` | `/api/v1/workspaces/{wsId}/agents/{agentId}/poll` | GET | ACTION | `pollWork()` | ⏳ PENDING |
| 8 | `/api/agents/[agentId]/rotate-key` | `/api/v1/workspaces/{wsId}/agents/{agentId}/rotate-key` | POST | ACTION | `rotateKey()` | ⏳ PENDING |
| 9 | `/api/agents/[agentId]/tasks` | `/api/v1/workspaces/{wsId}/agents/{agentId}/tasks` | GET | LIST | `getAgentTasks()` | ⏳ PENDING |
| 10 | `/api/agents/[agentId]/tasks/[taskId]` | `/api/v1/workspaces/{wsId}/agents/{agentId}/tasks/{taskId}` | GET | READ | `getTask()` | ⏳ PENDING |
| 11 | `/api/agents/[agentId]/tasks/[taskId]` | `/api/v1/workspaces/{wsId}/agents/{agentId}/tasks/{taskId}` | PUT | UPDATE | `updateTask()` | ⏳ PENDING |
| 12 | `/api/agents/[agentId]/tasks/[taskId]/comments` | `/api/v1/workspaces/{wsId}/agents/{agentId}/tasks/{taskId}/comments` | POST | CREATE | `addComment()` | ⏳ PENDING |
| 13 | `/api/agents/[agentId]/tasks/[taskId]/comments` | `/api/v1/workspaces/{wsId}/agents/{agentId}/tasks/{taskId}/comments` | GET | LIST | `getComments()` | ⏳ PENDING |

**Batch 1 Features:**
- RFC 9457 error responses with unique request IDs
- Bearer token authentication (required)
- Cursor pagination on list endpoints (agents, tasks, comments)
- Workspace ID extraction from URL path
- Zod schemas for OpenAPI documentation

**Estimated Effort:** 1-2 days
**Dependency Blocker:** None (foundation complete)

---

## Batch 2: Task/Epic/Business Routes (10 routes)

Internal task management and business logic routes. Lower priority than agent routes.

| # | Current Path | Target Path | Method | Type | Handler | Status |
|---|---|---|---|---|---|---|
| 1 | `/api/tasks/[taskId]` | `/api/v1/workspaces/{wsId}/tasks/{taskId}` | GET | READ | `getTask()` | ⏳ PENDING |
| 2 | `/api/tasks/[taskId]` | `/api/v1/workspaces/{wsId}/tasks/{taskId}` | PUT | UPDATE | `updateTask()` | ⏳ PENDING |
| 3 | `/api/tasks/[taskId]/calendar-events` | `/api/v1/workspaces/{wsId}/tasks/{taskId}/events` | GET | LIST | `getCalendarEvents()` | ⏳ PENDING |
| 4 | `/api/tasks/execute` | `/api/v1/workspaces/{wsId}/tasks/execute` | POST | ACTION | `executeTask()` | ⏳ PENDING |
| 5 | `/api/tasks/generate-daily` | `/api/v1/workspaces/{wsId}/tasks/generate` | POST | ACTION | `generateDailyTasks()` | ⏳ PENDING |
| 6 | `/api/epics` | `/api/v1/workspaces/{wsId}/epics` | GET | LIST | `getEpics()` | ⏳ PENDING |
| 7 | `/api/epics` | `/api/v1/workspaces/{wsId}/epics` | POST | CREATE | `createEpic()` | ⏳ PENDING |
| 8 | `/api/businesses` | `/api/v1/workspaces/{wsId}/businesses` | GET | LIST | `getBusinesses()` | ⏳ PENDING |
| 9 | `/api/businesses` | `/api/v1/workspaces/{wsId}/businesses` | POST | CREATE | `createBusiness()` | ⏳ PENDING |
| 10 | `/api/calendar/events` | `/api/v1/workspaces/{wsId}/calendar/events` | GET/POST | LIST/CREATE | `calendarEvents()` | ⏳ PENDING |

**Batch 2 Features:**
- Same standardization as Batch 1
- Task execution with async callbacks
- Calendar integration
- Business object management

**Estimated Effort:** 1-1.5 days
**Dependency Blocker:** None

---

## Batch 3: Remaining Routes (11 routes)

Infrastructure, monitoring, and specialized routes. Can be done in parallel with Batch 2.

| # | Current Path | Target Path | Method | Type | Auth Required | Status |
|---|---|---|---|---|---|---|
| 1 | `/api/health` | `/api/health` | GET | HEALTH | ✗ NO | ⏳ PENDING |
| 2 | `/api/gateway/[gatewayId]` | `/api/v1/gateways/{gatewayId}` | GET/POST/PUT | GATEWAY | ✓ YES | ⏳ PENDING |
| 3 | `/api/memory` | `/api/v1/workspaces/{wsId}/memory` | GET | LIST | ✓ YES | ⏳ PENDING |
| 4 | `/api/memory/context` | `/api/v1/workspaces/{wsId}/memory/context` | GET/POST | ACTION | ✓ YES | ⏳ PENDING |
| 5 | `/api/memory/files` | `/api/v1/workspaces/{wsId}/memory/files` | GET/POST | CRUD | ✓ YES | ⏳ PENDING |
| 6 | `/api/state-engine/alerts` | `/api/v1/workspaces/{wsId}/state-engine/alerts` | GET | LIST | ✓ YES | ⏳ PENDING |
| 7 | `/api/state-engine/decisions` | `/api/v1/workspaces/{wsId}/state-engine/decisions` | GET | LIST | ✓ YES | ⏳ PENDING |
| 8 | `/api/state-engine/metrics` | `/api/v1/workspaces/{wsId}/state-engine/metrics` | GET | LIST | ✓ YES | ⏳ PENDING |
| 9 | `/api/reports` | `/api/v1/workspaces/{wsId}/reports` | GET | LIST | ✓ YES | ⏳ PENDING |
| 10 | `/api/calendar/slots` | `/api/v1/workspaces/{wsId}/calendar/slots` | GET | LIST | ✓ YES | ⏳ PENDING |
| 11 | `/api/calendar/events/[eventId]` | `/api/v1/workspaces/{wsId}/calendar/events/{eventId}` | GET/PUT | READ/UPDATE | ✓ YES | ⏳ PENDING |

**Special Routes (Outside Migration Scope):**

| Path | Purpose | Status |
|---|---|---|
| `/api/docs` | Swagger UI (kept as-is, public) | ✅ DONE |
| `/api/openapi.json` | OpenAPI spec (kept as-is, public) | ✅ DONE |
| `/api/openapi` | OpenAPI alternate endpoint | ⏳ REVIEW |
| `/api/admin/agents/setup-workspace` | Admin setup (special handling needed) | ⏳ ASSESS |
| `/api/admin/migrations/agent-workspace-paths` | Data migration (one-time use) | ⏳ ASSESS |
| `/api/agents/workspace/structure` | Workspace structure query | ⏳ ASSESS |
| `/api/agents/[agentId]/wiki/pages` | Wiki pages (may need special path) | ⏳ ASSESS |
| `/api/agents/[agentId]/wiki/pages/[pageId]` | Wiki page detail | ⏳ ASSESS |

**Estimated Effort:** 1.5-2 days
**Dependency Blocker:** None

---

## Route Migration Strategy

### Phase: Each route follows this pattern

1. **READ**: Understand current implementation and dependencies
2. **SCHEMA**: Add Zod schema for request/response (for OpenAPI)
3. **MIGRATE**:
   - Update path to `/api/v1/workspaces/{wsId}/...` format
   - Add workspace ID extraction
   - Use `routeHelpers` for standardized response formatting
   - Update error handling to RFC 9457 format
   - Add Bearer token validation
4. **TEST**: Update/add tests to validate new format
5. **COMMIT**: Atomic commit per route or small batch

### Backwards Compatibility

During migration, maintain `/api/` paths alongside `/api/v1/` paths:

```typescript
// Example: agents/route.ts
export async function GET(request: NextRequest) {
  const url = new URL(request.url);

  // Support both /api/v1/workspaces/{wsId}/agents and /api/agents
  let workspaceId = extractWorkspaceIdFromPath(url.pathname);

  if (!workspaceId) {
    // Fallback: use default or from query param (legacy)
    workspaceId = url.searchParams.get("workspaceId") || "default";
  }

  // ... handler logic
}
```

### OpenAPI Integration

As routes are migrated, add them to `frontend/src/app/api/openapi.json/route.ts`:

```typescript
// In generateOpenAPISpec()
addRoute(doc, {
  path: "/api/v1/workspaces/{workspaceId}/agents",
  method: "GET",
  summary: "List Agents",
  tags: ["Agents"],
  parameters: [pathParams.workspaceId, queryParams.limit, queryParams.cursor],
  responses: {
    "200": {
      description: "List of agents",
      content: {
        "application/json": {
          schema: paginatedResponseSchema({
            type: "object",
            properties: { /* agent fields */ }
          })
        }
      }
    },
    ...standardErrorResponses()
  }
});
```

---

## Progress Tracking

```
Wave 3 Progress: [░░░░░░░░░░░░░░░░░░░░] 0/34 routes migrated

Batch 1: [░░░░░░░░░░░░] 0/13 routes — NOT STARTED
Batch 2: [░░░░░░░░░░] 0/10 routes — NOT STARTED
Batch 3: [░░░░░░░░░░░] 0/11 routes — NOT STARTED
```

---

## Next Steps

1. ✅ **Step 1: Create route helpers** — COMPLETE (33 tests passing)
2. ⏳ **Step 2: Migrate Batch 1 (Agent Routes)**
   - Start with `/api/agents` GET/POST (most critical)
   - Then agent-specific routes (heartbeat, poll, rotate-key)
   - Then agent task routes (with pagination)
3. ⏳ **Step 3: Migrate Batch 2 (Task/Epic/Business)**
4. ⏳ **Step 4: Migrate Batch 3 (Remaining)**
5. ⏳ **Step 5: Update OpenAPI spec with all routes**
6. ⏳ **Step 6: Run E2E tests to validate backwards compatibility**
