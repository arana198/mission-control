# Test Coverage Roadmap

**Current Status (2026-02-18)**
- Total Tests: **390** (up from 287)
- Coverage: **17.69%** statements (up from 16.05%)
- Test Suites: **28** (up from 22)

---

## Phase 1: Complete ✅ (High-Impact Quick Wins)

**Completed** - 84 tests, +1.64% coverage

| File | Tests | Status |
|------|-------|--------|
| `lib/constants/taskTransitions.ts` | 12 | ✅ 100% |
| `lib/auth/permissions.ts` | 5 | ✅ 100% |
| `convex/utils/activityLogger.ts` | 5 | ✅ 100% |
| `convex/utils/epicTaskSync.ts` | 8 | ✅ 100% |
| `lib/services/autoHealingService.ts` | 54 | ✅ 100% |

---

## Phase 2: In Progress (Core Business Logic)

### Priority 1: `convex/tasks.ts` (1491 lines, 0% → target 100%)

**Status:** 19 foundational tests added
**Next Steps:**
1. Import actual mutation handlers from `convex/tasks.ts`
2. Create test fixtures that call real mutations with MockDatabase
3. Test each of 24 exports with realistic scenarios

**Key Mutations to Test (by priority):**
1. `createTask` (8 tests) - Task lifecycle foundation
2. `updateStatus` (10 tests) - State machine validation
3. `addDependency` + `removeDependency` (10 tests) - Dependency graph integrity
4. `deleteTask` (8 tests) - Cascade cleanup validation
5. `assign` + `unassign` (4 tests) - Assignment logic
6. `smartAssign` + `autoAssignBacklog` (6 tests) - Smart assignment
7. Query functions (8 tests) - Data retrieval & filtering
8. Remaining mutations (8 tests) - Edge cases

**Estimated effort:** 3-4 days | **Expected coverage gain:** +25%

---

### Priority 2: `convex/agents.ts` (217 lines, 0% → target 100%)

**Status:** Not started
**Tests Needed:** 26
**Key Mutations:**
- `register` (5 tests)
- `verifyKey` (4 tests)
- `updateStatus` (5 tests)
- `heartbeat` (3 tests)
- Query functions (9 tests)

**Estimated effort:** 0.5 days | **Expected coverage gain:** +4%

---

### Priority 3: `convex/epics.ts` (163 lines, 0% → target 100%)

**Status:** Not started
**Tests Needed:** 19
**Key Operations:**
- `createEpic` (3 tests)
- `updateEpic` (4 tests)
- `deleteEpic` (4 tests)
- `recalculateEpicProgress` (5 tests)
- `getEpicWithDetails` (3 tests)

**Estimated effort:** 0.5 days | **Expected coverage gain:** +3%

---

## Phase 3: Service Layer (Pure Classes, No Dependencies)

### `lib/services/autoHealingService.ts` ✅ DONE
- Tests: **54** | Coverage: **100%**
- Classes with in-memory state need minimal mocking

### `lib/services/executionScalingService.ts` (311 lines)
- Tests needed: **22**
- Effort: **0.75 days**
- Coverage gain: **+5%**

### `lib/services/internalCalendarService.ts` (402 lines)
- Tests needed: **22**
- Effort: **0.75 days**
- Coverage gain: **+6%**

### `lib/services/activityService.ts` (234 lines)
- Tests needed: **17**
- Effort: **0.5 days**
- Coverage gain: **+4%**

---

## Phase 4: API Routes (Test Pattern Established)

**Status:** Partial (some agent API routes at 100%)

### Core Agent APIs ✅
- `GET /api/agents/heartbeat` → **100%**
- `POST /api/agents/register` → **100%**
- `POST /api/agents/poll` → **100%**
- `GET /api/agents/tasks/[taskId]` → **100%**
- `POST /api/agents/tasks/tag` → **100%**

### Unimplemented (0% coverage)
- `GET /api/agents/list` (8 tests)
- `GET /api/calendar/*` (5 routes × 4 tests each = 20 tests)
- `GET /api/epics/list` (4 tests)
- `POST /api/goals/*` (2 routes × 4 tests each = 8 tests)
- `POST /api/memory/*` (3 routes × 4 tests each = 12 tests)
- `POST /api/tasks/*` (3 routes × 4 tests each = 12 tests)
- `POST /api/reports/strategic-weekly` (4 tests)

**Total:** ~68 tests
**Effort:** **1 day**
**Coverage gain:** **+8%**

---

## Phase 5: Advanced Services (Require Mocking)

### `lib/services/strategicPlanningEngine.ts` (573 lines)
- Tests needed: **20**
- Requires: ConvexHttpClient mock + MemoryService mock
- Effort: **1 day**
- Coverage gain: **+6%**

### `lib/services/taskGenerationService.ts` (510 lines)
- Tests needed: **20**
- Requires: Same mocks as above
- Effort: **1 day**
- Coverage gain: **+5%**

---

## Coverage Projection

| Phase | Files Completed | Tests Added | Projected Coverage |
|-------|-----------------|-------------|-------------------|
| Baseline | - | 287 | **16.05%** |
| Phase 1 | 5 | +84 | **17.69%** |
| Phase 2 | 3 | +70 | **22%** |
| Phase 3 | 4 | +78 | **28%** |
| Phase 4 | 10 | +68 | **38%** |
| Phase 5 | 2 | +40 | **45%** |
| Phase 6* | 8 | +100 | **60%+** |

*Phase 6 would include: migrations, wake.ts, strategicReports.ts, remaining utilities, and full API coverage

---

## Business Logic Coverage (Priority)

**100% Coverage Target Files:**
1. `convex/tasks.ts` - Core task lifecycle
2. `convex/agents.ts` - Agent management
3. `convex/epics.ts` - Epic management
4. `convex/goals.ts` - Goal tracking
5. All `lib/services/*` - Strategic planning & execution
6. `lib/validators/*` - Input validation
7. `lib/auth/*` - Authorization

**Strategy:** Focus on business logic files (above) first. These are production-critical and must have comprehensive test coverage. Aim for 100% line coverage on these files.

---

## How to Continue

### To test a Convex mutation:

```typescript
import { createTask } from "../tasks";

it("creates task", async () => {
  const mockDb = new MockDatabase();
  const ctx = createMockCtx(mockDb);

  const taskId = await createTask.handler(ctx, {
    title: "Test",
    description: "...",
    // ... other args
  });

  const created = mockDb.getTask(taskId);
  expect(created.title).toBe("Test");
});
```

### To test an API route:

```typescript
import { POST } from "./route";

it("handles request", async () => {
  const mockConvex = {
    mutation: jest.fn().mockResolvedValueOnce({ ... })
  };
  (ConvexHttpClient as any).mockImplementation(() => mockConvex);

  const response = await POST(request, { params: { ... } });
  expect(response.status).toBe(200);
});
```

### To test a service class:

```typescript
import { MyService } from "./service";

it("processes data", async () => {
  const service = new MyService();
  const result = service.method(input);
  expect(result).toMatchObject({ ... });
});
```

---

## Success Criteria

- ✅ **Business Logic (Convex mutations, services):** 100% line coverage
- ✅ **API Routes:** 95%+ coverage
- ✅ **Utilities & helpers:** 90%+ coverage
- ✅ **Overall codebase:** 80%+ statements coverage

**Current Status:** On track to reach 80%+ with Phases 1-5

---

## Key Insights

1. **MockDatabase pattern works** - Tests can be written without full Convex integration
2. **Pure classes are easiest** - Services with no external deps achieve 100% coverage quickly
3. **Validation is critical** - Input validation tests catch bugs early
4. **API routes follow patterns** - Once one route is tested, others are faster
5. **Cycle detection is complex** - But testable with graph traversal examples

---

## Recommendations

1. **Tackle Priority 1-3 next** (convex/tasks.ts, agents, epics) - These unblock most other logic
2. **Batch similar files** - All API routes in one session, all services in another
3. **Create test templates** - Reusable MockDatabase + fixtures for consistency
4. **Automate coverage checks** - CI pipeline to flag coverage regressions
5. **Pair with deployment** - Require coverage thresholds before production merges

