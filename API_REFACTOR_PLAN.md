# Agent API RESTful Refactor Plan

## Overview
Migrate from action-based URLs to proper RESTful architecture following REST best practices and HTTP standards.

## Current → New Mapping

### Agent Management

| Current | New | Method | Purpose |
|---------|-----|--------|---------|
| `POST /api/agents/register` | `POST /api/agents` | POST | Register/create agent |
| `GET /api/agents/list` | `GET /api/agents` | GET | List all agents |
| `PUT /api/agents/{agentId}` | `PATCH /api/agents/{agentId}` | PATCH | Update agent details |
| N/A | `GET /api/agents/{agentId}` | GET | Get agent details |
| N/A | `DELETE /api/agents/{agentId}` | DELETE | Deactivate agent |

### Agent Lifecycle

| Current | New | Method |
|---------|-----|--------|
| `POST /api/agents/heartbeat` | `POST /api/agents/{agentId}/heartbeat` | POST |
| `POST /api/agents/poll` | `POST /api/agents/{agentId}/poll` | POST |

### Agent Task Queue

| Current | New | Method | Purpose |
|---------|-----|--------|---------|
| `GET /api/agents/tasks` | `GET /api/agents/{agentId}/tasks` | GET | List agent's tasks |
| `GET /api/agents/tasks/{taskId}` | `GET /api/agents/{agentId}/tasks/{taskId}` | GET | Get task details |
| `PUT /api/agents/tasks/{taskId}/update` | `PATCH /api/agents/{agentId}/tasks/{taskId}` | PATCH | Update task metadata |
| `PUT /api/agents/tasks/{taskId}/status` | `PATCH /api/agents/{agentId}/tasks/{taskId}/status` | PATCH | Update status only |

### Task Actions

| Current | New | Method | Purpose |
|---------|-----|--------|---------|
| `PUT /api/agents/tasks/{taskId}/assign` | `POST /api/agents/{agentId}/tasks/{taskId}/assign` | POST | Assign/claim task |
| `POST /api/agents/tasks/complete` | `POST /api/agents/{agentId}/tasks/{taskId}/complete` | POST | Mark task complete |
| `POST /api/agents/tasks/{taskId}/comment` | `POST /api/agents/{agentId}/tasks/{taskId}/comments` | POST | Add comment |
| `POST /api/agents/tasks/{taskId}/tag` | `PATCH /api/agents/{agentId}/tasks/{taskId}/tags` | PATCH | Update tags |

## Key Design Principles

1. **Resource Hierarchy**: `/agents/{agentId}/tasks/{taskId}` shows ownership
2. **HTTP Verbs**:
   - GET = retrieve
   - POST = create/action
   - PATCH = partial update
   - PUT = full replacement (avoid)
   - DELETE = remove
3. **Status Codes**:
   - 200 = OK (GET, PATCH, DELETE)
   - 201 = Created (POST creating resource)
   - 202 = Accepted (async action)
   - 400 = Bad Request
   - 401 = Unauthorized
   - 403 = Forbidden
   - 404 = Not Found
   - 409 = Conflict
   - 422 = Unprocessable Entity
   - 500 = Server Error

## Implementation Phases

### Phase 1: Create New Endpoints (Keep Old Ones)
**Duration**: 2-3 hours
- Create new directory structure: `/api/agents/{agentId}/...`
- Implement new endpoint files
- Mirror business logic from old endpoints
- Add deprecation warnings to old endpoints
- Files: 10+ new route files

### Phase 2: Update API Tests
**Duration**: 1-2 hours
- Update 13 test files to use new endpoint URLs
- Verify all tests pass
- Add tests for new endpoint paths
- Files: `src/app/api/agents/__tests__/*.test.ts`

### Phase 3: Update Test Request Bodies
**Duration**: 30-60 minutes
- Remove agentId from body (now in URL path)
- Update poll request structure
- Update task operation bodies
- Files: All test files

### Phase 4: Add Backward Compatibility Redirects
**Duration**: 30 minutes
- Old endpoints return 301 with Location header
- Log deprecation warnings
- Guide developers to new endpoints
- Optional: Keep for 1-2 weeks then remove

### Phase 5: Update API Documentation
**Duration**: 1 hour
- Create `/api-docs/agents.md` or update existing
- Document new endpoint structure
- Show request/response examples
- Include migration guide

### Phase 6: Verify & Clean Up
**Duration**: 1 hour
- Build and test full app
- Verify all tests pass (1320+)
- Remove old endpoints (if no external clients)
- Final documentation

## Files to Create

```
src/app/api/agents/
├── route.ts                          (GET/POST /api/agents)
├── [agentId]/
│   ├── route.ts                      (GET/PATCH /api/agents/{agentId})
│   ├── heartbeat/
│   │   └── route.ts                  (POST heartbeat)
│   ├── poll/
│   │   └── route.ts                  (POST poll)
│   └── tasks/
│       ├── route.ts                  (GET /api/agents/{agentId}/tasks)
│       └── [taskId]/
│           ├── route.ts              (GET/PATCH)
│           ├── assign/
│           │   └── route.ts          (POST assign)
│           ├── complete/
│           │   └── route.ts          (POST complete)
│           ├── status/
│           │   └── route.ts          (PATCH status)
│           ├── comments/
│           │   └── route.ts          (GET/POST comments)
│           └── tags/
│               └── route.ts          (PATCH tags)
```

## Files to Update

**Tests (13 files):**
- `register.test.ts` → Test POST /api/agents
- `list.test.ts` → Test GET /api/agents
- `heartbeat.test.ts` → Test POST /api/agents/{id}/heartbeat
- `poll.test.ts` → Test POST /api/agents/{id}/poll
- `query-tasks.test.ts` → Test GET /api/agents/{id}/tasks
- `assign.test.ts` → Test POST /api/agents/{id}/tasks/{id}/assign
- `complete.test.ts` → Test POST /api/agents/{id}/tasks/{id}/complete
- `comment.test.ts` → Test POST /api/agents/{id}/tasks/{id}/comments
- `tag.test.ts` → Test PATCH /api/agents/{id}/tasks/{id}/tags
- `task-details.test.ts` → Test GET /api/agents/{id}/tasks/{id}
- `status.test.ts` → Test PATCH /api/agents/{id}/tasks/{id}/status
- `update.test.ts` → Test PATCH /api/agents/{id}
- `poll-businessid.test.ts` → Test POST /api/agents/{id}/poll with businessId

**Components (5 files):** (No changes needed - these use Convex api.agents.*, not HTTP)
- BusinessDashboard.tsx (uses api.agents.getAllAgents)
- GlobalDashboard.tsx (uses api.agents.getAllAgents)
- CommandPalette.tsx (uses api.agents.getAllAgents)
- BottleneckVisualizer.tsx (uses api.agents.getAllAgents)
- AgentCards.tsx (uses api.agents.getAllAgents)

## Request/Response Format Changes

### Before: POST /api/agents/register
```json
{
  "name": "agent-1",
  "role": "specialist",
  "level": "specialist",
  "sessionKey": "agent:session:key",
  "capabilities": ["coding", "planning"],
  "model": "claude-3-5-sonnet",
  "personality": "helpful",
  "workspacePath": "/workspace/agent-1"
}
```

### After: POST /api/agents
```json
{
  "name": "agent-1",
  "role": "specialist",
  "level": "specialist",
  "sessionKey": "agent:session:key",
  "capabilities": ["coding", "planning"],
  "model": "claude-3-5-sonnet",
  "personality": "helpful",
  "workspacePath": "/workspace/agent-1"
}
```
*(Same body, agentId moved from header to URL path in responses)*

### Before: POST /api/agents/poll
```json
{
  "agentId": "agent_123",
  "agentKey": "key_xyz",
  "businessId": "biz_456"
}
```

### After: POST /api/agents/agent_123/poll
```json
{
  "agentKey": "key_xyz",
  "businessId": "biz_456"
}
```
*(agentId moved to URL path)*

### Before: GET /api/agents/tasks?businessId=biz_456
Headers:
```
agentId: agent_123
agentKey: key_xyz
```

### After: GET /api/agents/agent_123/tasks?businessId=biz_456
Headers:
```
agentId: agent_123
agentKey: key_xyz
```
*(businessId remains as query param for filtering)*

## Migration Testing Checklist

- [ ] All 13 test files pass with new endpoints
- [ ] New endpoints return correct status codes
- [ ] Authentication/verification works
- [ ] businessId scoping still works
- [ ] Task state transitions work correctly
- [ ] Agent polling returns correct data
- [ ] Heartbeat updates agent state
- [ ] Comments and tags still work
- [ ] Full build succeeds (npm run build)
- [ ] All 1320+ tests pass

## Rollback Plan

If issues arise:
1. Keep old endpoints active
2. Add deprecation warnings
3. No client impact (old URLs still work)
4. Remove new endpoints if needed
5. Try again with fixes

## Benefits

✅ RESTful compliance
✅ Clear resource hierarchy
✅ Standard HTTP semantics
✅ Easier for external tools/clients
✅ Better OpenAPI/Swagger documentation
✅ More maintainable long-term
✅ Follows industry standards

## Effort Estimate

| Phase | Time | Status |
|-------|------|--------|
| Create new endpoints | 2-3h | TODO |
| Update tests | 1-2h | TODO |
| Update test bodies | 30-60m | TODO |
| Backward compat redirects | 30m | TODO |
| Documentation | 1h | TODO |
| Verify & cleanup | 1h | TODO |
| **Total** | **~6-8h** | TODO |

