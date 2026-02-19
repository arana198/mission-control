# Mission Control: Coding Standards Quick Reference

## Type Safety Checklist

### ✓ Mandatory at Every Boundary
- [ ] API route: validate with Zod schema
- [ ] Convex mutation: validate with Zod schema
- [ ] React form: validate before submit
- [ ] Query filters: use businessId always
- [ ] Error responses: use structured format

### ✓ Never Do This
- [ ] ✗ Hardcoded magic strings: use `TASK_STATUS.BACKLOG` not `"backlog"`
- [ ] ✗ Unvalidated input: always use validators
- [ ] ✗ Missing businessId: every query must filter by it
- [ ] ✗ Generic errors: use specific error classes
- [ ] ✗ `any` types: infer from schemas and constants

---

## File Structure Template

### Convex Mutation (convex/tasks.ts)
```typescript
import { mutation } from "./_generated/server";
import { CreateTaskSchema, validateTaskInput } from "@/lib/validators/taskValidators";
import { logActivity } from "./utils/activityLogger";

export const createTask = mutation({
  args: {
    businessId: convexVal.id("businesses"),     // ✓ Required
    title: convexVal.string(),
    // ...
  },
  handler: async (ctx, args) => {
    // 1. Validate
    const validated = validateTaskInput(CreateTaskSchema, args);

    // 2. Business logic
    const inferred Tags = inferTags(validated.title);

    // 3. Insert with businessId
    const id = await ctx.db.insert("tasks", {
      ...validated,
      tags: inferredTags,
      createdAt: Date.now(),
    });

    // 4. Log activity
    await logActivity(ctx, {
      businessId: validated.businessId,
      taskId: id,
      type: ACTIVITY_TYPE.TASK_CREATED,
      actor: "user",
    });

    // 5. Return
    return await ctx.db.get(id);
  },
});
```

### API Route (src/app/api/agents/tasks/route.ts)
```typescript
import { GET } from "next/server";
import { handleApiError, jsonResponse, successResponse } from "@/lib/utils/apiResponse";

export async function GET(request: Request): Promise<Response> {
  try {
    // 1. Parse and validate
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    if (!businessId) throw new ValidationError("businessId required");

    // 2. Authenticate
    const agent = await verifyAgent(agentId, agentKey);
    if (!agent) throw new UnauthorizedError();

    // 3. Query
    const tasks = await convex.query(api.tasks.getFiltered, { businessId });

    // 4. Return success
    return jsonResponse(successResponse(tasks), 200);
  } catch (error) {
    const [errorData, status] = handleApiError(error);
    return jsonResponse(errorData, status);
  }
}
```

### React Component (src/components/TaskCard.tsx)
```typescript
"use client";

import { Task } from "@/src/types/task";
import { PRIORITY_COLORS, STATUS_COLORS } from "@/lib/constants/business";
import { cn } from "@/lib/utils";

interface TaskCardProps {
  task: Task;
  onSelect?: (task: Task) => void;
}

export function TaskCard({ task, onSelect }: TaskCardProps) {
  return (
    <button
      onClick={() => onSelect?.(task)}
      className={cn(
        "p-3 rounded-lg border",
        PRIORITY_COLORS[task.priority],
        STATUS_COLORS[task.status]
      )}
    >
      <h3 className="font-medium">{task.title}</h3>
      <p className="text-sm text-muted-foreground">{task.description}</p>
    </button>
  );
}
```

### Test (convex/tasks/__tests__/mutations.test.ts)
```typescript
describe("createTask", () => {
  it("should create task with valid input", async () => {
    // Arrange
    const input = {
      businessId: "b1",
      title: "Test Task",
      description: "Test",
    };

    // Act
    const task = await createTask.handler(mockCtx, input);

    // Assert
    expect(task._id).toBeDefined();
    expect(task.title).toBe("Test Task");
  });

  it("should require businessId", async () => {
    expect(() => createTask.handler(mockCtx, { title: "Test" }))
      .toThrow("Business not found");
  });
});
```

---

## Naming Quick Reference

| What | Pattern | Example |
|------|---------|---------|
| React component | PascalCase | `TaskCard.tsx` |
| Utility function | camelCase | `taskUtils.ts` |
| Constant file | lowercase | `constants.ts` |
| Convex query | get/list | `getTask`, `listTasks` |
| Convex mutation | create/update/delete | `createTask`, `updateTask` |
| React hook | use{Feature} | `useTasks`, `useBusiness` |
| Handler function | handle{Action} | `handleSelectBusiness` |
| Predicate | is{Condition} | `isTransitionAllowed` |
| Type from const | Extract from const | `type TaskStatus = typeof TASK_STATUS[...]` |

---

## Error Handling Quick Reference

### Standard Error Classes
```typescript
throw new ValidationError("Invalid input", { field: "title" });
throw new NotFoundError("Task");
throw new UnauthorizedError("Invalid credentials");
throw new ConflictError("Circular dependency detected");
```

### Standard Response Format
```typescript
// Success
{ success: true, data: {...}, timestamp: 1234567890 }

// Error
{
  success: false,
  error: {
    code: "VALIDATION_ERROR",
    message: "Invalid input",
    details: [{ field: "title", message: "too short" }]
  },
  timestamp: 1234567890
}
```

---

## Testing Checklist

### Before Committing
- [ ] `npm test` passes (all unit/integration tests)
- [ ] `npm run lint` passes
- [ ] `npm run build` passes (TypeScript validation)
- [ ] `npm run e2e` passes (UI rendering verified)
- [ ] Manual testing on both servers (convex:dev + dev)

### Test Coverage
- [ ] Happy path tested
- [ ] Error cases tested (invalid input, not found, etc.)
- [ ] Business logic tested (calculations, validations)
- [ ] Integration tests for mutations
- [ ] E2E tests for critical UI flows

### Test Patterns
```typescript
// Unit test
describe("function", () => {
  it("should handle valid input", () => { /* test */ });
  it("should throw on invalid input", () => { /* test */ });
});

// Mutation integration
it("should create task and log activity", async () => {
  const task = await createTask(...);
  const activity = await getActivity(task._id);
  expect(activity.type).toBe("task_created");
});

// E2E (Playwright)
test("should create task via UI", async ({ page }) => {
  await page.goto("/mission-control-hq/board");
  await page.locator('button:has-text("New Task")').click();
  await page.locator('input[placeholder*="Title"]').fill("Test");
  await page.locator('button:has-text("Create")').click();
  await page.waitForSelector('div[role="dialog"]', { state: 'hidden' });
});
```

---

## Constants: What Goes Where

### lib/constants/business.ts
- Domain enums: `TASK_STATUS`, `TASK_PRIORITY`, `AGENT_STATUS`
- Display mappings: `STATUS_COLORS`, `PRIORITY_COLORS`, `AGENT_COLORS`
- Validation rules: `VALIDATION.TASK_TITLE_MIN`, `COMMENT_MAX`
- Timeouts: `TIMEOUTS.TASK_EXECUTION`, `HEARTBEAT_INTERVAL`
- Error codes: `ERROR_CODES.VALIDATION_ERROR`

### lib/constants/taskTransitions.ts
- State machine: `ALLOWED_TRANSITIONS`
- Transition rules: which status can transition to which

### convex/schema.ts
- Table definitions
- Field types and constraints
- Indexes

---

## Business Scoping: Always Remember

```typescript
// ✓ Every insert must have businessId
await ctx.db.insert("tasks", {
  businessId,  // ← REQUIRED
  title,
  // ...
});

// ✓ Every query must filter by businessId
await ctx.db
  .query("tasks")
  .withIndex("by_business", (q) => q.eq("businessId", businessId))
  .collect();

// ✓ API routes must receive businessId
export async function GET(request: Request) {
  const businessId = url.searchParams.get("businessId");
  if (!businessId) throw new ValidationError("businessId required");
  // ...
}

// ✓ React components get businessId from context
const { currentBusiness } = useBusiness();
const businessId = currentBusiness._id;
```

---

## Validation Pattern

```typescript
// 1. Define schema (lib/validators/taskValidators.ts)
export const CreateTaskSchema = z.object({
  businessId: convexId(),
  title: z.string().min(3).max(200),
  priority: z.enum([...]).default("P2").optional(),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

// 2. Use in validator (provides type safety)
function validateTaskInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError("Invalid", result.error.issues);
  }
  return result.data;
}

// 3. Validate at boundary (API route, mutation, form)
const validated = validateTaskInput(CreateTaskSchema, input);
// Now TypeScript knows validated has all required fields
```

---

## Activity Logging: Always Log

```typescript
// Every mutation should log activity
await logActivity(ctx, {
  businessId: task.businessId,
  taskId: task._id,
  type: ACTIVITY_TYPE.TASK_CREATED,    // ← Use constant
  actor: "user",                         // ← User or agent ID
  changes: { created: { title, status } },
  timestamp: Date.now(),
});
```

---

## Component Guidelines

### Do ✓
- Split large components (>200 lines) into smaller ones
- Use `use client` only for client components
- Wrap async components with Suspense
- Import in order: React → Next.js → Custom hooks → Components → Icons → Utils
- Use `cn()` for conditional classes
- Handle loading states (Suspense, isLoading flags)
- Show meaningful empty states
- Include JSDoc comments for complex components

### Don't ✗
- Use `any` type
- Inline style objects (use className with Tailwind)
- Fetch data in useEffect without cleanup
- Store user data in localStorage (use context)
- Hardcode colors (use constants)
- Create components with 20+ props (refactor)

---

## Git Commit Standards

### Commit Message Format
```
[Type]: Brief description (under 70 chars)

Detailed explanation of changes.
- Bullet point for complex changes
- Another detail

Closes #123

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Types
- `Fix:` - Bug fix
- `Feat:` - New feature
- `Refactor:` - Code restructuring (no behavior change)
- `Test:` - Test addition/updates
- `Docs:` - Documentation

### Before Committing
```bash
npm test && npm run lint && npm run build && npm run e2e
```

---

## Definition of Done

Before pushing:

1. ✓ Unit tests written (red → green → refactor)
2. ✓ Integration tests written (Convex mutations)
3. ✓ E2E tests written (UI changes)
4. ✓ `npm test` passes
5. ✓ `npm run lint` passes
6. ✓ `npm run build` passes
7. ✓ `npm run e2e` passes
8. ✓ Manual testing on both servers
9. ✓ Code review checklist passed
10. ✓ Commit message follows format

---

## Useful Commands

```bash
# Development
npm run convex:dev          # Start backend (Terminal 1)
npm run dev                 # Start frontend (Terminal 2)

# Testing
npm test                    # Run unit/integration tests
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report
npm run e2e                 # Run E2E tests
npm run e2e:ui              # E2E with interactive UI
npm run e2e:debug           # E2E with debugger

# Validation
npm run lint                # Check linting
npm run build               # TypeScript compilation
npm run validate            # lint + build + test (comprehensive)

# Database
npm run seed:all            # Seed demo data
```

---

## Common Mistakes to Avoid

| Mistake | Fix |
|---------|-----|
| ✗ `any` type | ✓ Infer from constant/schema: `typeof TASK_STATUS[...]` |
| ✗ `"backlog"` string | ✓ Use `TASK_STATUS.BACKLOG` |
| ✗ Query without businessId | ✓ Always `.withIndex("by_business", (q) => q.eq("businessId", id))` |
| ✗ `throw Error(msg)` | ✓ Use `throw new ValidationError(...)` |
| ✗ Mutation without activity log | ✓ Always call `logActivity()` |
| ✗ No validation | ✓ Always validate at boundary with Zod |
| ✗ Generic error | ✓ Specific: `NotFoundError`, `ConflictError` |
| ✗ 400-line component | ✓ Split into <200 line components |
| ✗ No tests | ✓ Test-first: write test before code |
| ✗ No E2E for UI | ✓ All UI changes need Playwright tests |

