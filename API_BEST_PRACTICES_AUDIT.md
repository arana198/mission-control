# API Best Practices Audit

**Date**: 2026-02-19
**Status**: Critical issues identified

---

## Issues Summary

### 🔴 CRITICAL

1. **Inconsistent HTTP Methods** (Violates REST principles)
   - `POST /api/calendar/find-slots` - Should be **GET** (query operation)
   - `POST /api/agents/tasks/{taskId}/update` - Should be **PATCH** (partial update)
   - `POST /api/agents/tasks/{taskId}/status` - Should be **PATCH** (partial update)
   - `POST /api/agents/tasks/{taskId}/assign` - Should be **PATCH** (resource modification)
   - `POST /api/agents/tasks/comment` - Should be **POST** to a collection: `/api/agents/tasks/{taskId}/comments`

2. **Response Status Codes Missing**
   - No `201 Created` for resource creation endpoints (e.g., `/api/calendar/create-event`)
   - No `204 No Content` for operations without response body
   - All responses default to `200 OK` even for creates/updates

3. **Response Format Inconsistency**
   - `/api/calendar/create-event` returns `{ error: "..." }` instead of standard error structure
   - Some endpoints wrap: `{ success, data: {...} }`
   - Some endpoints return: `successResponse({...})` with nested `data`
   - Inconsistent between endpoints

4. **Authentication Method Mixing**
   - Query params: `agentId`, `agentKey` in URL (not secure)
   - Authorization header: `Bearer {token}` (correct)
   - Body fields: `apiKey` in request body (less ideal)
   - **Should standardize to Authorization header**

---

### 🟡 IMPORTANT

5. **URL Design Violations**
   - `/api/calendar/create-event` - Redundant "create" in path (should be POST `/api/calendar/events`)
   - `/api/agents/tasks/complete` - Action verb in path (should be PATCH `/api/tasks/{taskId}` with action in body)
   - `/api/agents/tasks/tag` - Should be collection: POST `/api/tasks/{taskId}/tags` or PUT `/api/tasks/{taskId}/tags/{tagId}`
   - Too many single-action endpoints instead of resource-based design

6. **Error Response Inconsistency**
   - `/api/calendar/create-event` doesn't follow standard `{ success, error: { code, message, details } }`
   - Some endpoints return structured errors, others return plain strings
   - Status codes for errors vary (some use 400, others 401, etc.)

7. **Query Parameters for Required Fields**
   - `/api/agents/tasks` uses query params for required auth: `?agentId=...&agentKey=...`
   - Should use Authorization header instead
   - Makes URLs less cacheable and violates HTTP semantics

8. **Missing Response Headers**
   - Not all responses include `Content-Type: application/json`
   - Missing cache control headers (appropriate for different endpoints)
   - Missing security headers where needed

---

## Best Practices Violations

| Category | Violation | Correct |
|----------|-----------|---------|
| **HTTP Methods** | POST for queries | GET for queries |
| **HTTP Methods** | POST for partial updates | PATCH for partial updates |
| **HTTP Methods** | POST for resource modifications | PUT/PATCH for modifications |
| **Status Codes** | 200 for resource creation | 201 Created |
| **Status Codes** | 200 for operations with no body | 204 No Content |
| **URL Design** | Verbs in paths: `/create`, `/update`, `/assign` | Resources in paths: `/tasks/{id}`, `/events/{id}` |
| **URL Design** | Query params for auth | Authorization header |
| **Response Format** | Inconsistent error structure | Standard error structure |
| **Authentication** | Multiple auth methods | Single standardized method |

---

## Endpoints Requiring Fixes

### HTTP Method Changes
- [ ] `POST /api/calendar/find-slots` → `GET /api/calendar/slots`
- [ ] `POST /api/agents/tasks/{taskId}/update` → `PATCH /api/agents/tasks/{taskId}`
- [ ] `POST /api/agents/tasks/{taskId}/status` → `PATCH /api/agents/tasks/{taskId}/status`
- [ ] `POST /api/agents/tasks/{taskId}/assign` → `PATCH /api/agents/tasks/{taskId}/assignees`
- [ ] `POST /api/agents/tasks/comment` → `POST /api/agents/tasks/{taskId}/comments`

### URL Design Restructure
- [ ] `POST /api/calendar/create-event` → `POST /api/calendar/events` + Return 201
- [ ] `POST /api/agents/tasks/complete` → `PATCH /api/tasks/{taskId}` with `{ status: "done" }`
- [ ] `POST /api/agents/tasks/tag` → `POST /api/tasks/{taskId}/tags`

### Response Format Fixes
- [ ] Standardize all error responses to `{ success: false, error: { code, message, details } }`
- [ ] Return 201 for POST creating resources
- [ ] Return 204 for operations without response body

### Authentication Fixes
- [ ] Migrate from query params to Authorization header
- [ ] Standardize on Bearer token format
- [ ] Document authentication method in endpoint comments

---

## Implementation Priority

1. **Phase 1 (Critical)**: Fix response status codes (201, 204)
2. **Phase 2**: Standardize error response format across all endpoints
3. **Phase 3**: Fix HTTP methods (GET vs POST, PATCH vs POST)
4. **Phase 4**: Restructure URLs to be more RESTful
5. **Phase 5**: Migrate authentication to standard Authorization header

---

## Test Impact

All API tests will need updates:
- [ ] `/api/agents/__tests__/` - Update expected status codes
- [ ] `/api/calendar/__tests__/` - Update expected status codes
- [ ] `/api/tasks/__tests__/` - Update expected status codes
- [ ] `/api/agents/__tests__/` - Update authentication methods

---

## References

- [RFC 7231 HTTP Methods](https://tools.ietf.org/html/rfc7231#section-4.3)
- [REST API Status Codes](https://www.rfc-editor.org/rfc/rfc7231#section-6)
- [JSON:API Standard](https://jsonapi.org/)
- [Microsoft REST API Guidelines](https://github.com/microsoft/api-guidelines)
