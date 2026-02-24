# Phase 1 Error Standardization - Migration Checklist

**Timeline**: Week 1-2 (40 hours estimated)
**Priority**: CRITICAL - Blocking Phase 2
**Status**: ✅ Infrastructure Complete | ⏳ Migration In Progress

---

## Completed Infrastructure ✅

- [x] ApiError class with standardized error codes
- [x] ErrorCode enum mapped to HTTP status codes
- [x] Convex error handler wrapper (`wrapConvexHandler`)
- [x] Request ID generation and validation
- [x] Comprehensive unit tests (36 passing tests)
- [x] Documentation and migration guide
- [x] Example patterns in `convex/examples/errorHandlingPattern.ts`

---

## Priority 1: Critical Mutations (Week 1)

Update these high-impact mutations first:

### agents.ts (5 functions)
- [ ] `updateStatus` - Use `ApiError.notFound()` for agent check
- [ ] `heartbeat` - Same pattern
- [ ] `rotateApiKey` - Add validation error for grace period
- [ ] `getByName` - Handle case-insensitive lookup errors
- [ ] `getWithCurrentTask` - Multi-tenant safety check

**Location**: `convex/agents.ts`
**Affected**: Agent status management, API key rotation

### businesses.ts (4 functions)
- [ ] `create` - Update validation errors, duplicate check, limit check
- [ ] `update` - Permission checks
- [ ] `delete` - Safety checks
- [ ] `setDefault` - State validation

**Location**: `convex/businesses.ts`
**Affected**: Business CRUD, multi-tenant isolation

### tasks.ts (6 functions)
- [ ] `create` - Validation and epic check
- [ ] `update` / `updateTask` - State transitions
- [ ] `updateStatus` - Validate state machine
- [ ] `updatePriority` - Boundary checks
- [ ] `assignToAgent` - Permission and assignment logic
- [ ] `unblock` - State validation

**Location**: `convex/tasks.ts`
**Affected**: Task management, workflow state

### epics.ts (4 functions)
- [ ] `createEpic` - Validation
- [ ] `updateEpic` - Multi-tenant safety
- [ ] `deleteEpic` - Cascade safety
- [ ] `getEpicWithDetails` - 404 handling

**Location**: `convex/epics.ts`
**Affected**: Epic management, hierarchical safety

---

## Priority 2: Supporting Systems (Week 1-2)

### messages.ts (3 functions)
- [ ] `create` - Validate mentions, task ownership
- [ ] `update` - Permission checks
- [ ] `delete` - Ownership verification

### goals.ts (4 functions)
- [ ] `create` - Business scoping
- [ ] `update` - State validation
- [ ] `delete` - Cascade safety
- [ ] `getGoalById` - Fetch error handling

### notifications.ts (3 functions)
- [ ] `create` - Recipient validation
- [ ] `markRead` - Permission check
- [ ] `delete` - Ownership verification

### Other Modules (20+ functions)
- [ ] `alertRules.ts` - Business scoping
- [ ] `documents.ts` - Ownership checks
- [ ] `decisions.ts` - State validation
- [ ] `activities.ts` - Context validation
- [ ] All remaining modules

---

## Process for Each Migration

### Template

```typescript
// BEFORE
export const functionName = mutation({
  args: { ... },
  handler: async (ctx, args) => {
    const resource = await ctx.db.get(id);
    if (!resource) throw new Error("Resource not found");
    // ...
  }
});

// AFTER
import { wrapConvexHandler, ApiError } from "../lib/errors";

export const functionName = mutation({
  args: { ... },
  handler: wrapConvexHandler(async (ctx, args) => {
    const resource = await ctx.db.get(id);
    if (!resource) throw ApiError.notFound("Resource", { id });
    // ...
  })
});
```

### Steps

1. **Add import**:
   ```typescript
   import { wrapConvexHandler, ApiError } from "../lib/errors";
   ```

2. **Wrap handler**:
   ```typescript
   handler: wrapConvexHandler(async (ctx, args) => {
     // existing logic
   })
   ```

3. **Replace error patterns**:
   - `throw new Error("X not found")` → `throw ApiError.notFound("X", { ... })`
   - `throw new Error("Invalid X")` → `throw ApiError.validationError("Invalid X", { field, value })`
   - `throw new Error("X already exists")` → `throw ApiError.conflict("X already exists", { ... })`
   - `throw new Error("Access denied")` → `throw ApiError.forbidden("Access denied", { ... })`

4. **Add context to errors**:
   ```typescript
   // Old
   throw new Error("Task not found");

   // New - include debugging context
   throw ApiError.notFound("Task", { taskId, businessId });
   ```

5. **Run tests**:
   ```bash
   npm test -- convex/__tests__/module.test.ts
   ```

6. **Commit**:
   ```bash
   git commit -m "fix(error-handling): standardize errors in module.ts

   - Replace generic Error throws with ApiError codes
   - Wrap handler with wrapConvexHandler
   - Include request IDs and contextual details

   Implements Phase 1 error standardization."
   ```

---

## Testing Checklist

For each migrated module:

- [ ] Unit tests pass: `npm test -- convex/__tests__/module.test.ts`
- [ ] TypeScript compiles: `npm run build`
- [ ] Convex function types update: `convex dev` (one terminal)
- [ ] Manual test in UI (if applicable)

### End-to-End Test
```bash
npm run validate
# Runs: lint + build + test
# Should all pass
```

---

## Verification Steps

After completing Priority 1 migrations:

1. **Check error code coverage**:
   ```bash
   grep -r "throw new Error" convex/*.ts | wc -l
   # Should be << 100 (down from ~60+ currently)
   ```

2. **Verify wrapper usage**:
   ```bash
   grep -r "wrapConvexHandler" convex/*.ts | wc -l
   # Should be >= 19 (all Priority 1 functions)
   ```

3. **Test error handling**:
   ```typescript
   // In test:
   expect(error.code).toBe(ErrorCode.NOT_FOUND);
   expect(error.requestId).toBeDefined();
   ```

---

## Documentation Updates

- [x] Error handling guide created: `docs/ERROR_HANDLING.md`
- [x] Examples provided: `convex/examples/errorHandlingPattern.ts`
- [ ] Update `convex/README.md` with error handling section
- [ ] Add error code reference to team wiki
- [ ] Update API documentation when available (Phase 2+)

---

## Deployment Checklist

**Before shipping Phase 1:**

- [ ] All Priority 1 functions migrated (19 functions)
- [ ] All tests passing
- [ ] `npm run validate` passes completely
- [ ] Manual smoke test on local env
- [ ] Code review approved
- [ ] Update `CHANGELOG.md` with Phase 1 changes

---

## Rollback Plan

If issues arise:

1. **Immediate rollback**:
   ```bash
   git revert <commit-hash>
   npm run convex:dev
   ```

2. **Partial rollback**:
   - Revert only affected module
   - Leave infrastructure (lib/errors) in place
   - Can re-attempt specific module

3. **Monitoring**:
   - Watch error logs for new error code patterns
   - Look for increased error rates (shouldn't happen)
   - Verify request IDs appearing in logs

---

## Effort Estimates

| Task | Estimate | Status |
|------|----------|--------|
| Infrastructure | 8 hours | ✅ DONE |
| Priority 1 (19 functions) | 20 hours | ⏳ IN PROGRESS |
| Priority 2 (20+ functions) | 15 hours | 📅 NEXT |
| Testing & Validation | 5 hours | 📅 NEXT |
| Documentation updates | 3 hours | ⏳ IN PROGRESS |
| **Total Phase 1** | **40 hours** | **~50% Complete** |

---

## Success Criteria

Phase 1 is complete when:

- ✅ All error codes standardized and documented
- ✅ Request IDs generated for all operations
- ✅ wrapConvexHandler used in 100+ mutations/queries
- ✅ Zero generic `throw new Error()` in new code
- ✅ All tests passing
- ✅ Developers can reference error codes in code
- ✅ Clients can parse machine-readable errors
- ✅ Support can trace errors using request IDs

---

## Next Steps

**Upon Phase 1 Completion:**

1. Begin Phase 2: Response envelope standardization
2. Plan pagination architecture (Phase 2 parallel work)
3. Prepare authentication context layer (Phase 3)

**Right Now:**

1. Pick first module from Priority 1 list
2. Create feature branch: `feat/error-handling-phase1-agents`
3. Follow template and checklist above
4. Open PR with tests
5. Request review

---

## Questions & Support

- **Error codes unclear?** → See `lib/errors/ApiError.ts` enum
- **Pattern examples?** → Check `convex/examples/errorHandlingPattern.ts`
- **Testing help?** → See test files: `lib/errors/__tests__/`
- **Questions?** → Reference `docs/ERROR_HANDLING.md`

---

**Owner**: Architecture Team
**Last Updated**: Feb 24, 2026
**Next Review**: After Priority 1 complete
