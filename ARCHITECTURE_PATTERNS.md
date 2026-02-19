# Architecture Patterns & Design Decisions

## ADR-001: Multi-Tenant Architecture with Business Scoping

### Decision
Every data model is either **business-scoped** (has `businessId`) or **global** (shared across all businesses).

### Pattern
```typescript
// Business-scoped: epics, tasks, activities
epics: defineTable({
  businessId: convexVal.id("businesses"),  // ← REQUIRED
  // ...
})

// Global: agents, businesses, calendar events
agents: defineTable({
  // NO businessId - shared across all businesses
  // ...
})
```

### Query Pattern
```typescript
// Business-scoped: Must filter
await ctx.db
  .query("tasks")
  .withIndex("by_business", (q) => q.eq("businessId", businessId))
  .collect();

// Global: Query normally
await ctx.db.query("agents").collect();
```

### Benefits
- ✓ Isolation: queries naturally scoped to business
- ✓ Safety: impossible to leak data between businesses
- ✓ Performance: indexes on businessId for fast queries
- ✓ Clarity: each table clearly global or scoped

---

## ADR-002: Type Safety at Boundaries with Zod

### Decision
Every input (API, mutation, form) is validated with Zod schemas that generate types.

### Pattern
```typescript
// Define once, use everywhere
const CreateTaskSchema = z.object({
  businessId: convexId(),
  title: z.string().min(3).max(200),
  priority: z.enum([...]).default("P2").optional(),
});

type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

// Use in API route
const validated = CreateTaskSchema.parse(req.body);

// Use in Convex mutation (for client-side pre-validation)
const validated = validateTaskInput(CreateTaskSchema, input);

// Use in React form
const form = useForm<CreateTaskInput>({ schema: CreateTaskSchema });
```

### Benefits
- ✓ Single schema, no duplicate validators
- ✓ Type-safe: TypeScript knows all fields after parsing
- ✓ Consistent: same validation everywhere
- ✓ Clear errors: structured error messages

---

## ADR-003: Constants as Single Source of Truth

### Decision
All enums, magic numbers, and configuration live in `lib/constants/business.ts`. Never hardcode strings.

### Pattern
```typescript
// ✗ BAD: Magic strings
if (status === "backlog") { ... }
if (priority === "P0") { ... }
colors[status] = "bg-gray-500";

// ✓ GOOD: Constants
if (status === TASK_STATUS.BACKLOG) { ... }
if (priority === TASK_PRIORITY.P0) { ... }
colors[status] = STATUS_COLORS[status];  // Type-safe lookup
```

### Benefits
- ✓ No typos: refactoring catches all references
- ✓ Type-safe: `TaskStatus` type inferred from constant
- ✓ Single change: update constant once
- ✓ Autocomplete: IDE knows all valid values

---

## ADR-004: Activity Logging for Audit Trail

### Decision
Every mutation creates an activity record. This provides:
- Audit trail (who did what when)
- User notifications (mention mentions, assignments)
- Real-time feeds (activity feed UI)

### Pattern
```typescript
export const updateTask = mutation({
  args: { taskId, title, status, actor },
  handler: async (ctx, args) => {
    const oldTask = await ctx.db.get(args.taskId);

    // Apply changes
    const changes = { title: args.title, status: args.status };
    await ctx.db.patch(args.taskId, changes);

    // Log activity
    await logActivity(ctx, {
      businessId: oldTask.businessId,
      taskId: args.taskId,
      type: ACTIVITY_TYPE.TASK_UPDATED,
      changes,
      actor: args.actor,
    });
  }
});
```

### Benefits
- ✓ Full audit trail (who, what, when)
- ✓ Notifications (trigger on activity type)
- ✓ Real-time feeds (query activities table)
- ✓ Debugging (trace data changes)

---

## ADR-005: Validation -> Mutation -> Activity Pattern

### Decision
Every data change follows this sequence:

1. **Validate** input (Zod schema)
2. **Apply business logic** (calculations, defaults)
3. **Mutate database** (insert/update/delete)
4. **Log activity** (audit trail)
5. **Return result**

### Pattern
```typescript
export const createTask = mutation({
  args: { businessId, title, description, priority = "P2", ... },
  handler: async (ctx, args) => {
    // 1. Validate (could also be done by client)
    if (!args.businessId) throw new Error("businessId required");
    if (args.title.length < 3) throw new Error("title too short");

    // 2. Apply business logic
    const inferred Tags = inferTagsFromContent(args.title, args.description);
    const status = "backlog";
    const createdAt = Date.now();

    // 3. Mutate
    const taskId = await ctx.db.insert("tasks", {
      businessId: args.businessId,
      title: args.title,
      description: args.description,
      priority: args.priority,
      tags: inferredTags,
      status,
      createdAt,
      updatedAt: createdAt,
    });

    // 4. Log activity
    await logActivity(ctx, {
      businessId: args.businessId,
      taskId,
      type: ACTIVITY_TYPE.TASK_CREATED,
      actor: args.createdBy,
    });

    // 5. Return
    return await ctx.db.get(taskId);
  }
});
```

### Benefits
- ✓ Clear sequence (always same order)
- ✓ No missed logging (always included)
- ✓ Type-safe (validated input)
- ✓ Observable (full activity trail)

---

## ADR-006: Error Handling with Specific Error Classes

### Decision
Use specific, type-safe error classes instead of throwing generic `Error`.

### Pattern
```typescript
// Define once
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(ERROR_CODES.VALIDATION_ERROR, message, 400, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(ERROR_CODES.NOT_FOUND, `${resource} not found`, 404);
  }
}

// Use consistently
export const getTask = query({
  args: { taskId },
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw new NotFoundError("Task");  // ← Type-safe error
    return task;
  }
});

// Handle consistently
export async function GET(request: Request) {
  try {
    // ...
  } catch (error) {
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}
```

### Benefits
- ✓ Type-safe: `throw new NotFoundError()` vs generic Error
- ✓ Consistent HTTP status (automatically included)
- ✓ Structured responses (error code + message + details)
- ✓ Easy to handle (catch specific types)

---

## ADR-007: Component Composition Over Props Drilling

### Decision
Large components split into smaller ones. Data passed down, handlers passed up (or via context).

### Pattern

**❌ Anti-pattern: Prop drilling**
```typescript
function TaskBoard({ tasks, onSelect, onUpdate, onDelete, ... }) {
  return (
    <div>
      <TaskColumns>
        {tasks.map(task => (
          <TaskCard
            task={task}
            onSelect={onSelect}
            onUpdate={onUpdate}
            onDelete={onDelete}
            {...10 more props}
          />
        ))}
      </TaskColumns>
    </div>
  );
}
```

**✓ Better: Composed components**
```typescript
function TaskBoard() {
  const { tasks } = useTasks();           // ← Custom hook provides data
  const [selected, setSelected] = useState(null);

  return (
    <div>
      <TaskFilters />                     // ← Stateless, uses context
      <TaskColumns tasks={tasks} onSelect={setSelected} />
      {selected && <TaskDetail task={selected} />}
    </div>
  );
}

// Internal components are focused
function TaskCard({ task, onSelect }) {
  return (
    <button onClick={() => onSelect(task)}>
      {task.title}
    </button>
  );
}
```

### Benefits
- ✓ Reusable: components work independently
- ✓ Testable: small components easier to test
- ✓ Readable: each component ~50 lines
- ✓ Maintainable: change one component, not 10

---

## ADR-008: Suspense for Async UI States

### Decision
Use Suspense to handle loading states gracefully.

### Pattern
```typescript
// Wrapper component handles async
export function BusinessSelector() {
  return (
    <Suspense fallback={<SkeletonLoader />}>
      <BusinessSelectorContent />  {/* Can be async */}
    </Suspense>
  );
}

// Content component is clean
function BusinessSelectorContent() {
  const context = useBusiness();  // ← Already loaded
  if (!context) throw new Error("Must be within BusinessProvider");

  return (
    <div>
      {/* Component logic, no if isLoading */}
    </div>
  );
}
```

### Benefits
- ✓ Clean: no loading state logic in component
- ✓ Accessible: fallback shown while loading
- ✓ Composable: Suspense boundaries can nest
- ✓ Error handling: can use Error Boundary with Suspense

---

## ADR-009: Next.js App Router with Dynamic Routes

### Decision
Use Next.js App Router with dynamic segments for business routing.

### Pattern
```typescript
// File structure
app/
  (app)/
    [businessSlug]/         // ← Dynamic business segment
      board/
        page.tsx
    global/                 // ← Global routes
      agents/
        page.tsx

// Access in component
export default function BoardPage({ params }: { params: { businessSlug: string } }) {
  const slug = params.businessSlug;
  const { currentBusiness } = useBusiness();

  return <div>Board for {currentBusiness.name}</div>;
}
```

### Benefits
- ✓ Type-safe: params automatically typed
- ✓ Automatic routing: no config needed
- ✓ SEO: clean URLs
- ✓ Scalable: handles all businesses with one layout

---

## ADR-010: Schema-Driven Development

### Decision
Define schema first, then validators, then functions.

### Flow
```
1. Define Schema (convex/schema.ts)
   - What data exists?
   - What fields required/optional?
   - What indexes needed?

2. Define Validators (lib/validators/)
   - What constraints on each field?
   - What validation rules?
   - What error messages?

3. Define Functions (convex/tasks.ts or src/app/api/)
   - How to read/write this data?
   - What business logic?
   - What activity to log?

4. Define UI (src/components/)
   - How to display this data?
   - How to let users create/edit?
   - What forms/validations?
```

### Benefits
- ✓ Clear requirements: schema is spec
- ✓ Type-safe: types derived from schema
- ✓ Comprehensive: schema → validators → functions
- ✓ Maintainable: schema is single source of truth

---

## ADR-011: Activity Logging Denormalization

### Decision
Denormalize frequently-used fields into activities table for performance.

### Pattern
```typescript
// activities table includes:
activities: defineTable({
  businessId: convexVal.id("businesses"),
  taskId: convexVal.id("tasks"),
  type: convexVal.string(),
  actor: convexVal.string(),

  // Denormalized for fast UI rendering
  taskTitle: convexVal.string(),        // ← Copy from task
  ticketNumber: convexVal.string(),     // ← Copy from task
  actorName: convexVal.string(),        // ← Copy from agent

  changes: convexVal.object(...),
  timestamp: convexVal.number(),
})
```

### Benefits
- ✓ Fast queries: no need to join task/agent tables
- ✓ Real-time: activity shown immediately
- ✓ Historical: preserved even if original deleted
- ✓ Simple: activity is self-contained

### Trade-off
- ⚠ Consistency: must update activity when task changes
- ⚠ Storage: duplicate data stored

---

## ADR-012: TDD - Test-First Development

### Decision
All code is test-driven: test → implementation → refactor.

### Flow
```
1. RED: Write test that fails
   - What should this function do?
   - What inputs? What outputs?
   - What errors?

2. GREEN: Write minimal code to pass
   - Just make the test pass
   - Don't over-engineer
   - Don't add extra features

3. YELLOW (Optional): Refactor
   - Clean up code
   - Remove duplication
   - Improve names

4. REPEAT: Next test
```

### Standards
- ✓ Every mutation has integration test
- ✓ Every validator has unit test
- ✓ Every UI change has E2E test
- ✓ Happy path + error cases both tested

### Benefits
- ✓ Confidence: tests verify behavior
- ✓ Safety: refactoring catches breakage
- ✓ Clarity: test shows intended behavior
- ✓ Documentation: test is spec

---

## ADR-013: Three-Layer Validation

### Decision
Validation at three layers: unit tests → build → E2E tests.

### Layers
```
1. Unit Tests + Integration Tests (npm test)
   - Logic validated
   - Mutations validated
   - Functions validated

2. Build Validation (npm run build)
   - TypeScript strict mode
   - Import/export checked
   - Type safety verified

3. E2E Tests (npm run e2e)
   - UI renders correctly
   - User flows work
   - Components compose properly
```

### Why Three?
```typescript
// Unit test passes ✓
export const updateTask = mutation({
  args: { taskId, title },
  handler: async (ctx, { taskId, title }) => {
    // Test: "should update task title" ✓
    return await ctx.db.patch(taskId, { title });
  }
});

// But component has import error ✗
import { DashboardHeader } from "./dashboard/DashboardHeader";  // Wrong path!

// Build catches it
npm run build
// error: Cannot find module './dashboard/DashboardHeader'

// And E2E catches rendering errors
test("should show header", async ({ page }) => {
  // Page fails to render because DashboardHeader missing
  await expect(page.locator('header')).toBeVisible();  // ✗ Fails
});
```

### Benefits
- ✓ Logic verified: unit + integration tests
- ✓ Type verified: build validation
- ✓ UI verified: E2E tests
- ✓ Complete confidence: all three must pass

---

## ADR-014: Migration-First Data Changes

### Decision
Any schema change must have a migration. Migrations must be deterministic.

### Pattern
```typescript
// convex/migrations.ts
export const migrate = internalAction({
  args: {},
  handler: async (ctx) => {
    // MIG-01: Add businessId to existing tasks
    // Applied: 2026-02-10, Context: Multi-tenant architecture

    const tasks = await ctx.db.query("tasks").collect();
    for (const task of tasks) {
      if (!task.businessId) {
        // Deterministic: always pick default business
        const defaultBusiness = await ctx.db
          .query("businesses")
          .withIndex("by_default", (q) => q.eq("isDefault", true))
          .first();

        await ctx.db.patch(task._id, {
          businessId: defaultBusiness._id,
        });
      }
    }
  }
});
```

### Standards
- ✓ Idempotent: safe to run multiple times
- ✓ Deterministic: same result always
- ✓ Documented: comment explains what/why
- ✓ Tested: migration has tests

### Benefits
- ✓ Data integrity: no data lost
- ✓ Backwards compatible: old data handled
- ✓ Auditability: track schema changes
- ✓ Rollback: old migrations preserved

---

## Summary: Design Philosophy

| Principle | Approach |
|-----------|----------|
| **Multi-Tenant** | Always scope by businessId, no exceptions |
| **Type-Safe** | Zod at boundaries, inferred types from constants |
| **Observable** | Activity logging for every mutation |
| **Testable** | TDD: test → code → refactor |
| **Maintainable** | Small components, clear naming, single responsibility |
| **Scalable** | Schema-first, migrations, denormalization where needed |
| **Reliable** | Three-layer validation: unit + build + E2E |
| **Debuggable** | Activity trail, structured errors, clear logging |

