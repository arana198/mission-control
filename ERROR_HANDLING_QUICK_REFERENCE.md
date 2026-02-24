# Error Handling - Quick Reference

**Save this page for quick lookup**

---

## Import Statement

```typescript
import { ApiError, ErrorCode, wrapConvexHandler } from "../lib/errors";
import { generateRequestId } from "../lib/utils/requestId";
```

---

## Error Code Cheat Sheet

| Code | Status | When to Use | Example |
|------|--------|------------|---------|
| `VALIDATION_ERROR` | 422 | Invalid input | `Email must be valid` |
| `NOT_FOUND` | 404 | Resource missing | `User not found` |
| `CONFLICT` | 409 | Duplicate/state issue | `User already exists` |
| `FORBIDDEN` | 403 | Permission denied | `Access denied` |
| `LIMIT_EXCEEDED` | 429 | Quota hit | `Max 5 businesses` |
| `INTERNAL_ERROR` | 500 | Unexpected error | Database crash |
| `SERVICE_UNAVAILABLE` | 503 | Temporary issue | *Retryable* |

---

## Common Patterns

### Pattern: Not Found
```typescript
const user = await ctx.db.get(userId);
if (!user) throw ApiError.notFound("User", { userId });
```

### Pattern: Validation Error
```typescript
if (!email.includes("@")) {
  throw ApiError.validationError("Invalid email format", {
    field: "email",
    value: email
  });
}
```

### Pattern: Duplicate/Conflict
```typescript
const existing = await findByEmail(email);
if (existing) {
  throw ApiError.conflict("User already exists", { email });
}
```

### Pattern: Permission Check (Multi-tenant)
```typescript
if (task.businessId !== businessId) {
  throw ApiError.forbidden("Access denied", { taskId, businessId });
}
```

### Pattern: Wrapping Handler
```typescript
export const myMutation = mutation({
  args: { ... },
  handler: wrapConvexHandler(async (ctx, args) => {
    // Your logic here
  })
});
```

---

## Error Response Format

```typescript
{
  error: {
    code: "NOT_FOUND",           // Machine-readable
    statusCode: 404,             // HTTP equivalent
    message: "User not found",   // Human-readable
    requestId: "req_..._...",    // For tracing
    retryable: false,            // Can retry?
    details: { userId: "123" }   // Context
  }
}
```

---

## Client Handling

```typescript
try {
  await mutation({ ... });
} catch (error: any) {
  const code = error?.code;

  if (code === "NOT_FOUND") {
    // Handle 404
  } else if (code === "VALIDATION_ERROR") {
    // Handle invalid input
  } else if (error?.retryable) {
    // Retry logic
  } else {
    // Log with requestId for support
    console.error("Error:", error.message, error.requestId);
  }
}
```

---

## Factory Methods

```typescript
ApiError.notFound(resource, details)
ApiError.validationError(message, details)
ApiError.conflict(message, details)
ApiError.forbidden(message, details)
ApiError.limitExceeded(message, details)
ApiError.internal(message, details)
ApiError.unavailable(message, details)
```

---

## Testing

```typescript
import { ApiError, ErrorCode } from "../lib/errors";

it("should throw NOT_FOUND", async () => {
  const error = await expect(
    mutation.handler(mockCtx, { id: "missing" })
  ).rejects.toThrow(ApiError);

  expect(error.code).toBe(ErrorCode.NOT_FOUND);
  expect(error.requestId).toBeDefined();
});
```

---

## Before → After

```
BEFORE                          AFTER
throw new Error("...")     →    throw ApiError.notFound(...)
catch (e) parse message    →    catch (e) e.code
No tracing                 →    Automatic request ID
Inconsistent status codes  →    Standardized mapping
```

---

## Migration Checklist

- [ ] Import ApiError and wrapConvexHandler
- [ ] Wrap handler with wrapConvexHandler
- [ ] Replace `throw new Error()` with `throw ApiError.*`
- [ ] Add context to details object
- [ ] Run tests: `npm test`
- [ ] Commit with Phase 1 reference

---

## Request ID Utilities

```typescript
import {
  generateRequestId,
  getRequestIdAge,
  isValidRequestId
} from "../lib/utils/requestId";

const id = generateRequestId();      // "req_1708788000123_a7k3x9m2"
const ageMs = getRequestIdAge(id);   // 123 ms old
const valid = isValidRequestId(id);  // true
```

---

## Full Documentation

📖 Complete guide: `docs/ERROR_HANDLING.md`
📝 Migration steps: `PHASE_1_MIGRATION_CHECKLIST.md`
📌 Examples: `convex/examples/errorHandlingPattern.ts`
📊 Summary: `PHASE_1_IMPLEMENTATION_SUMMARY.md`

---

## FAQ

**Q: Should I use factory methods or constructor?**
A: Use factory methods for common cases, constructor for custom messages.

**Q: What if I don't know the error type?**
A: Use `ApiError.internal()` and let wrapConvexHandler catch it.

**Q: How do I add debugging context?**
A: Pass `details` object: `{ fieldName: value, ... }`

**Q: Are old clients affected?**
A: No - 100% backward compatible. Old clients still work.

**Q: Should every mutation use wrapConvexHandler?**
A: Yes - provides safety net for unexpected errors.

**Q: How do clients retry?**
A: Check `error.retryable` - if true, can safely retry.

---

**Print this or save as bookmark** ⭐
