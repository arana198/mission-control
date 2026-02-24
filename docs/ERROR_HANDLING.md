# Error Handling Guide - Phase 1 Implementation

## Overview

This document describes the standardized error handling system implemented in Phase 1 of the API audit.

## Error Codes

All errors are mapped to standardized codes that correspond to HTTP status codes:

| Code | Status | Use Case | Retryable |
|------|--------|----------|-----------|
| `VALIDATION_ERROR` | 422 | Input validation failures | ❌ No |
| `NOT_FOUND` | 404 | Resource doesn't exist | ❌ No |
| `CONFLICT` | 409 | Duplicate/state mismatch | ❌ No |
| `FORBIDDEN` | 403 | Permission/isolation violation | ❌ No |
| `LIMIT_EXCEEDED` | 429 | Quota exceeded | ✅ Yes |
| `INTERNAL_ERROR` | 500 | Unexpected server error | ❌ No |
| `SERVICE_UNAVAILABLE` | 503 | Temporary failure | ✅ Yes |

## Using ApiError

### Basic Usage

```typescript
import { ApiError, ErrorCode } from "../lib/errors";

// Using factory methods (recommended)
throw ApiError.notFound("User", { userId: "123" });
throw ApiError.validationError("Email must be valid", { field: "email" });
throw ApiError.conflict("User already exists", { email });
throw ApiError.forbidden("Access denied", { businessId });

// Using constructor directly
throw new ApiError(
  ErrorCode.LIMIT_EXCEEDED,
  "Maximum 5 businesses allowed",
  { limit: 5, current: 4 }
);
```

### Error Response Format

```json
{
  "code": "NOT_FOUND",
  "statusCode": 404,
  "message": "User not found",
  "requestId": "req_1708788000123_a7k3x9m2",
  "retryable": false,
  "details": {
    "userId": "123"
  }
}
```

## Wrapping Convex Handlers

Use `wrapConvexHandler` to automatically catch and format errors:

```typescript
import { mutation } from "./_generated/server";
import { wrapConvexHandler, ApiError } from "../lib/errors";

export const createTask = mutation({
  args: { businessId, title, ... },
  handler: wrapConvexHandler(async (ctx, args) => {
    // Your logic here
    // Throw ApiError for semantic errors
    // Non-ApiErrors automatically convert to INTERNAL_ERROR
  })
});
```

### What wrapConvexHandler Does

1. **ApiError Pass-through**: ApiErrors are re-thrown unchanged
2. **Error Conversion**: Non-ApiErrors become `INTERNAL_ERROR` (500)
3. **Stack Trace Safety**: Hides stack traces in production, shows in development
4. **Type Preservation**: Maintains full type safety

## Migration Path

### Phase 1a: Immediate (This Sprint)
Update 15-20 critical mutations to use new error handling:
- `agents.ts` - updateStatus, heartbeat
- `businesses.ts` - create, update, delete
- `epics.ts` - createEpic, updateEpic
- `tasks.ts` - create, update, updateStatus

### Phase 1b: Short-term (Next Sprint)
Update remaining mutations (200+):
- `messages.ts`
- `goals.ts`
- `notifications.ts`
- All other modules

### Example Migration

**Before:**
```typescript
export const updateAgent = mutation({
  args: { agentId: convexVal.id("agents"), status: convexVal.string() },
  handler: async (ctx, { agentId, status }) => {
    const agent = await ctx.db.get(agentId);
    if (!agent) throw new Error("Agent not found");

    await ctx.db.patch(agentId, { status });
    return { success: true };
  }
});
```

**After:**
```typescript
import { wrapConvexHandler, ApiError } from "../lib/errors";

export const updateAgent = mutation({
  args: { agentId: convexVal.id("agents"), status: convexVal.string() },
  handler: wrapConvexHandler(async (ctx, { agentId, status }) => {
    const agent = await ctx.db.get(agentId);
    if (!agent) throw ApiError.notFound("Agent", { agentId });

    await ctx.db.patch(agentId, { status });
    return { success: true };
  })
});
```

## Request ID Tracking

Every error includes a unique `requestId` for tracing:

```typescript
import { generateRequestId, getRequestIdAge } from "../lib/utils/requestId";

// Generate a request ID
const requestId = generateRequestId();
// Result: "req_1708788000123_a7k3x9m2"

// Check age of request ID
const ageMs = getRequestIdAge(requestId);
console.log(`Request is ${ageMs}ms old`);

// Validate format
if (!isValidRequestId(requestId)) {
  console.error("Invalid request ID format");
}
```

## Error Handling Patterns

### Pattern 1: Check and Throw
```typescript
const epic = await ctx.db.get(epicId);
if (!epic) throw ApiError.notFound("Epic", { epicId });
```

### Pattern 2: Validation Before Operation
```typescript
const slugRegex = /^[a-z0-9-]+$/;
if (!slugRegex.test(slug)) {
  throw ApiError.validationError("Invalid slug format", {
    field: "slug",
    value: slug,
    pattern: "[a-z0-9-]+",
  });
}
```

### Pattern 3: Multi-Tenant Safety
```typescript
if (task.businessId !== businessId) {
  throw ApiError.forbidden("Task does not belong to business", {
    taskId,
    businessId,
    actualBusinessId: task.businessId,
  });
}
```

### Pattern 4: State Transition Validation
```typescript
if (task.status === "done") {
  throw new ApiError(
    ErrorCode.CONFLICT,
    "Cannot transition: task already completed",
    { currentStatus: task.status, requestedStatus }
  );
}
```

### Pattern 5: Bulk Operations
```typescript
const results = [];
for (const id of ids) {
  try {
    // Process item
    results.push({ id, success: true });
  } catch (error) {
    if (error instanceof ApiError) {
      results.push({
        id,
        success: false,
        error: error.toJSON(),
      });
    } else {
      throw error; // Let wrapConvexHandler catch it
    }
  }
}
return { processed: ids.length, results };
```

## Client Handling

### JavaScript/TypeScript Client

```typescript
import { useCallback } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';

function MyComponent() {
  const createTask = useMutation(api.tasks.create);

  const handleCreate = useCallback(async () => {
    try {
      const result = await createTask({
        businessId: "123",
        title: "New task",
        description: "Description",
      });
      console.log("Task created:", result);
    } catch (error: any) {
      // Extract error code
      const errorCode = error?.code;

      if (errorCode === "VALIDATION_ERROR") {
        console.error("Invalid input:", error.details);
        // Show validation error UI
      } else if (errorCode === "NOT_FOUND") {
        console.error("Business not found");
        // Show 404 UI
      } else if (errorCode === "CONFLICT") {
        console.error("Duplicate resource:", error.details);
        // Show conflict UI
      } else if (error.retryable) {
        console.log("Retryable error, will retry:", error.message);
        // Implement retry logic
      } else {
        console.error("Error:", error.message, error.requestId);
        // Log requestId for support
      }
    }
  }, [createTask]);

  return <button onClick={handleCreate}>Create Task</button>;
}
```

### Error Recovery Pattern

```typescript
async function retryWithBackoff(
  operation: () => Promise<any>,
  maxRetries: number = 3,
  delay: number = 100
) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      if (!error.retryable || attempt === maxRetries - 1) {
        throw error;
      }

      // Wait before retry with exponential backoff
      const waitTime = delay * Math.pow(2, attempt);
      console.log(`Retrying after ${waitTime}ms... (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// Usage
const result = await retryWithBackoff(() =>
  createTask({ businessId: "123", title: "New task", description: "" })
);
```

## Testing Error Handling

### Test Example

```typescript
import { ApiError, ErrorCode } from "../lib/errors";

describe("updateAgent", () => {
  it("should throw NOT_FOUND for missing agent", async () => {
    const mutation = updateAgent.handler;

    const error = await expect(
      mutation(mockCtx, { agentId: "missing", status: "active" })
    ).rejects.toThrow(ApiError);

    expect(error.code).toBe(ErrorCode.NOT_FOUND);
    expect(error.statusCode).toBe(404);
    expect(error.details?.agentId).toBe("missing");
  });

  it("should include requestId in error", async () => {
    const error = new ApiError(ErrorCode.NOT_FOUND, "Not found");
    expect(error.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
  });
});
```

## Logging Errors

Include request IDs in logs for traceability:

```typescript
// In mutation
try {
  // Operation
} catch (error) {
  if (error instanceof ApiError) {
    console.error("API Error", {
      code: error.code,
      statusCode: error.statusCode,
      message: error.message,
      requestId: error.requestId,
      details: error.details,
    });
  }
}
```

## Backward Compatibility

**Important:** The new error handling is backward compatible:

1. Clients already handling `throw new Error()` will still work (wrapConvexHandler converts to INTERNAL_ERROR)
2. New clients can parse structured error responses
3. Both patterns coexist during migration

## Monitoring & Observability

Track errors using request IDs:

```typescript
// Dashboard query: Errors per code
SELECT code, COUNT(*) as count FROM errors GROUP BY code

// Tracing: Follow single request
SELECT * FROM logs WHERE requestId = "req_1708788000123_a7k3x9m2"

// Retryable errors: These should be automatically retried
SELECT * FROM errors WHERE retryable = true AND statusCode IN (429, 503)
```

## Reference

- **Error Codes**: `lib/errors/ApiError.ts`
- **Utilities**: `lib/utils/requestId.ts`
- **Handler Wrapper**: `lib/errors/convexErrorHandler.ts`
- **Examples**: `convex/examples/errorHandlingPattern.ts`
- **Tests**: `lib/errors/__tests__/`, `lib/utils/__tests__/`

---

**Status**: Phase 1 Complete ✅
**Next**: Phase 2 - Implement cursor-based pagination (Week 3-4)
