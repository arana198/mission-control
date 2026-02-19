# Mission Control: Comprehensive Coding Standards & Patterns Analysis

## Table of Contents
1. [Type Safety & Validation](#type-safety--validation)
2. [Architecture Patterns](#architecture-patterns)
3. [Naming Conventions](#naming-conventions)
4. [Error Handling](#error-handling)
5. [Testing Patterns](#testing-patterns)
6. [Frontend Patterns](#frontend-patterns)
7. [Backend Patterns](#backend-patterns)
8. [Constants & Configuration](#constants--configuration)
9. [Code Organization](#code-organization)
10. [Anti-Patterns & What to Avoid](#anti-patterns--what-to-avoid)

---

## Type Safety & Validation

### Core Principle
**Type safety is mandatory - validated at every boundary using Zod.**

### Pattern: Validator Pattern
Every input to the system is validated using Zod schemas at the boundary:

```typescript
// lib/validators/taskValidators.ts - Example
export const CreateTaskSchema = z.object({
  title: z.string()
    .min(VALIDATION.TASK_TITLE_MIN)
    .max(VALIDATION.TASK_TITLE_MAX)
    .trim(),
  priority: z.enum([TASK_PRIORITY.P0, TASK_PRIORITY.P1, TASK_PRIORITY.P2, TASK_PRIORITY.P3])
    .default(TASK_PRIORITY.P2)
    .optional(),
  // ... other fields
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
```

**Standards:**
- ✓ One validator file per domain (taskValidators, agentValidators, etc.)
- ✓ Schema names follow pattern: `{Action}{Resource}Schema` (CreateTaskSchema, UpdateTaskSchema)
- ✓ Always infer types using `z.infer<typeof Schema>`
- ✓ Custom validators for cross-field validation using `.refine()`:
  ```typescript
  .refine((data) => data.taskId !== data.blockedByTaskId, {
    message: "A task cannot block itself",
    path: ["blockedByTaskId"],
  })
  ```
- ✓ Validation errors are custom classes with structured field information
- ✓ Validators are used at API boundaries, Convex mutations, and form submissions

### Pattern: Type Inference from Constants
Never hardcode string literals - infer types from constants:

```typescript
// ✓ CORRECT: In constants/business.ts
export const TASK_STATUS = {
  BACKLOG: "backlog",
  READY: "ready",
  IN_PROGRESS: "in_progress",
  // ...
} as const;
export type TaskStatus = typeof TASK_STATUS[keyof typeof TASK_STATUS];

// ✓ Use in validators
status: z.enum([
  TASK_STATUS.BACKLOG,
  TASK_STATUS.READY,
  // ...
])

// ✗ WRONG: Never hardcode
status: z.enum(["backlog", "ready", "in_progress"])
```

**Benefits:**
- Single source of truth for enum values
- Type safety: if you add a status, TypeScript catches all missing cases
- No magic strings in code

### Pattern: Shared Type Files
Frontend and backend share types via `src/types/`:

```typescript
// src/types/task.ts - Shared between frontend and Convex
export interface Task {
  _id: string;
  title: string;
  status: string;
  priority: "P0" | "P1" | "P2" | "P3";
  // ...
}
```

**Standards:**
- ✓ Shared types in `src/types/` for components and Convex queries
- ✓ Backend-only types in Convex
- ✓ Frontend-only types in `src/types/` with clear naming
- ✓ All types use explicit field definitions (no `any`)

---

## Architecture Patterns

### Multi-Tenant Architecture

**Core Pattern: Business Scoping**
Every business-scoped resource MUST have `businessId`:

```typescript
// In schema.ts
tasks: defineTable({
  businessId: convexVal.id("businesses"),  // REQUIRED
  title: convexVal.string(),
  // ...
}).index("by_business", ["businessId"])

// In mutations
export const createTask = mutation({
  args: {
    businessId: convexVal.id("businesses"),  // REQUIRED
    title: convexVal.string(),
    // ...
  },
  handler: async (ctx, { businessId, title, ... }) => {
    // Always scope queries to businessId
    const task = await ctx.db.insert("tasks", {
      businessId,  // Always include
      title,
      // ...
    });
  }
});
```

**Query Pattern - Scoped to Business:**
```typescript
// ✓ CORRECT: Always filter by businessId
const tasks = await ctx.db
  .query("tasks")
  .withIndex("by_business", (q) => q.eq("businessId", businessId))
  .collect();

// ✗ WRONG: Never fetch all tasks
const tasks = await ctx.db.query("tasks").collect();
```

**Standards:**
- ✓ Every table either has `businessId` (business-scoped) or is global (agents, businesses)
- ✓ All queries filter by `businessId` (except admin/global queries)
- ✓ Routes with `[businessSlug]` receive `businessId` from context
- ✓ API endpoints receive `businessId` as required parameter

### Schema-First Design

**Pattern: Define Schema, Then Validators, Then Functions**

1. **Schema Definition (convex/schema.ts)**
   ```typescript
   tasks: defineTable({
     businessId: convexVal.id("businesses"),
     title: convexVal.string(),
     status: convexVal.union(...),
     // ...
   }).index("by_business", ["businessId"])
   ```

2. **Validators (lib/validators/taskValidators.ts)**
   ```typescript
   export const CreateTaskSchema = z.object({
     businessId: convexId(),
     title: z.string().min(3).max(200),
     status: z.enum([...]),
     // ...
   });
   ```

3. **Mutations (convex/tasks.ts)**
   ```typescript
   export const createTask = mutation({
     args: { /* Convex args */ },
     handler: async (ctx, args) => {
       // Validate at boundary
       const validated = validateTaskInput(CreateTaskSchema, args);
       // Insert with validated data
       await ctx.db.insert("tasks", validated);
     }
   });
   ```

---

## Naming Conventions

### File Naming

| Pattern | Example | Usage |
|---------|---------|-------|
| `PascalCase.tsx` | `BusinessSelector.tsx` | React components |
| `PascalCase.ts` | `ActivityService.ts` | Service/class files |
| `camelCase.ts` | `taskUtils.ts` | Utility functions |
| `SCREAMING_SNAKE.ts` | `VALIDATION.ts` | Constants-only files |
| `[param].tsx` | `[businessSlug].tsx` | Dynamic route segments |
| `route.ts` | `route.ts` | Next.js API routes |

### Function Naming

**Convex Functions:**
```typescript
// Query: get{Resource} or list{Resource}
export const getTask = query({...})
export const listTasks = query({...})

// Mutation: create/update/delete{Resource}
export const createTask = mutation({...})
export const updateTask = mutation({...})
export const deleteTask = mutation({...})

// Internal: {verb}{Resource} (can be called by mutations only)
export const syncEpicTaskLink = internalAction({...})
```

**React Components:**
```typescript
// Function components: PascalCase
export function BusinessSelector() {...}
export function TaskCard({task}) {...}

// Hooks: use{Feature}
export function useBusiness() {...}
export function useTaskFilters() {...}

// Handlers: handle{Action}
const handleSelectBusiness = (business) => {...}
const handleCreateTask = async () => {...}
```

**Utility Functions:**
```typescript
// Predicates: is{Condition}
function isTransitionAllowed(from, to) {...}
function isBusinessScoped(resource) {...}

// Validators: validate{Input}
function validateTaskInput(schema, data) {...}

// Getters: get{Resource}
function getTaskById(id) {...}
function getBusinessSlug(pathname) {...}

// Formatters: format{Type}
function formatTaskStatus(status) {...}
```

### Variable Naming

```typescript
// ✓ Business-scoped resources
businessId        // Convex ID
currentBusiness   // Current business object
businessSlug      // URL-safe identifier

// ✓ Task-related
taskId            // ID of task
taskIds           // Array of IDs
currentTask       // Task being viewed
selectedTasks     // Set of tasks (array/set)

// ✓ Booleans: is/has prefix
isLoading         // Boolean flag
hasError          // Has error state
isOpen            // Dialog/menu open
isGlobalPath      // Is global tab

// ✓ Collections: plural or descriptive
tasks             // Array of tasks
taskMap           // Map/object of tasks keyed by ID
businessesBySlug  // Map indexed by slug

// ✓ Temporary/loop variables
i, j              // Loop counters (only in simple loops)
el, element       // DOM elements

// ✗ AVOID: Ambiguous names
data              // Use specific: tasks, taskData, payload
item              // Use specific: task, business, agent
obj               // Use specific: task, config, metadata
x, y, z           // Use specific: businessId, status, priority
temp, tmp         // Use specific or descriptive name
```

---

## Error Handling

### Pattern: Hierarchical Error Classes

```typescript
// lib/utils/apiResponse.ts
export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 400,
    public details?: unknown
  ) {
    super(message);
    this.name = "AppError";
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(ERROR_CODES.VALIDATION_ERROR, message, 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(ERROR_CODES.UNAUTHORIZED, message, 401);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(ERROR_CODES.NOT_FOUND, `${resource} not found`, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code: string = ERROR_CODES.CONFLICT) {
    super(code, message, 409);
  }
}
```

**Standards:**
- ✓ Never throw generic `Error` - use specific subclasses
- ✓ Always include error code, message, and HTTP status
- ✓ Include details for debugging (validation errors, field info)
- ✓ Error codes defined in constants: `ERROR_CODES.VALIDATION_ERROR`

### Pattern: Error Response Format

```typescript
// Success
{
  success: true,
  data: {...},
  timestamp: 1708345829
}

// Error
{
  success: false,
  error: {
    code: "VALIDATION_ERROR",
    message: "Invalid input",
    details: [
      { field: "title", message: "must be at least 3 characters" },
      { field: "priority", message: "invalid enum value" }
    ]
  },
  timestamp: 1708345829
}
```

**Standards:**
- ✓ All API responses follow this format
- ✓ Success responses: `{ success: true, data, timestamp }`
- ✓ Error responses: `{ success: false, error: { code, message, details }, timestamp }`
- ✓ HTTP status codes match error type (400, 401, 404, 409, 500)

### Pattern: Error Handling in API Routes

```typescript
// API Route Pattern
import { handleApiError, jsonResponse } from "@/lib/utils/apiResponse";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");

    // Validate
    if (!businessId) {
      throw new ValidationError("businessId is required");
    }

    // Process
    const tasks = await convex.query(api.tasks.getFiltered, { businessId });

    // Return success
    return jsonResponse(successResponse(tasks), 200);
  } catch (error) {
    const [errorData, statusCode] = handleApiError(error);
    return jsonResponse(errorData, statusCode);
  }
}
```

---

## Testing Patterns

### Pattern: Test-First Development
**Mandatory before implementing features:**

1. **Write test first (RED phase)**
2. **Implement feature (GREEN phase)**
3. **Refactor if needed (YELLOW phase)**
4. **Run full suite before commit**

### Test File Organization

```typescript
// Format: {module}.test.ts or __tests__/{module}.test.ts

// Location patterns:
convex/tasks/__tests__/mutations.test.ts
lib/validators/__tests__/taskValidators.test.ts
src/app/api/agents/__tests__/query-tasks.test.ts
```

### Unit Test Pattern

```typescript
describe("createTask", () => {
  it("should create a task with required fields", async () => {
    // Arrange
    const input = {
      businessId: "b1",
      title: "Test Task",
      description: "Test",
      priority: "P1",
    };

    // Act
    const result = await createTask.handler(mockCtx, input);

    // Assert
    expect(result._id).toBeDefined();
    expect(result.title).toBe("Test Task");
  });

  it("should validate required fields", async () => {
    // Arrange - missing title
    const input = { businessId: "b1", title: "" };

    // Act & Assert
    expect(() => createTask.handler(mockCtx, input))
      .toThrow("Title is required");
  });
});
```

**Standards:**
- ✓ Use `describe()` for grouping related tests
- ✓ Each test focuses on one behavior
- ✓ Test names: "should {action} {when condition}"
- ✓ Use Arrange/Act/Assert pattern
- ✓ Test both happy path and error cases
- ✓ Mock external dependencies

### Integration Test Pattern

```typescript
describe("Task Creation Flow", () => {
  it("should create task and log activity", async () => {
    // Arrange
    const input = { businessId: "b1", title: "Test" };

    // Act
    const task = await ctx.db.insert("tasks", input);
    const activity = await ctx.db
      .query("activities")
      .withIndex("by_task", (q) => q.eq("taskId", task._id))
      .first();

    // Assert
    expect(task).toBeDefined();
    expect(activity.type).toBe(ACTIVITY_TYPE.TASK_CREATED);
  });
});
```

### E2E Test Pattern

```typescript
describe("Task Management", () => {
  test("should create a new task", async ({ page }) => {
    // Navigate
    await page.goto("/mission-control-hq/board");

    // Act
    await page.locator('button:has-text("New Task")').click();
    await page.locator('input[placeholder*="Title"]').fill("E2E Test Task");
    await page.locator('button:has-text("Create")').click();

    // Assert - modal closes or success message
    await page.waitForSelector('div[role="dialog"]', { state: 'hidden' });
  });
});
```

**Standards:**
- ✓ Tests navigate to URL and interact like a user
- ✓ Use Playwright locators: aria-label, text content, placeholders
- ✓ Wait for network idle before assertions
- ✓ Test critical user flows
- ✓ Handle optional UI elements gracefully

---

## Frontend Patterns

### Component Structure

```typescript
"use client";  // Always at top for client components

import { useState } from "react";  // React hooks
import { useRouter } from "next/navigation";  // Next.js hooks
import { useBusiness } from "@/hooks/useBusiness";  // Custom hooks
import { AlertCircle } from "lucide-react";  // Icons
import { cn } from "@/lib/utils";  // Utilities

/**
 * BusinessSelector Component
 *
 * Dropdown for switching between businesses in the sidebar.
 * Displays current business with emoji and name.
 * On selection, navigates to that business's current tab.
 */
function BusinessSelectorContent() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const { currentBusiness, businesses, setCurrentBusiness } = useBusiness();

  // Handler functions
  const handleSelectBusiness = (business: Business) => {
    setCurrentBusiness(business);
    router.push(`/${business.slug}/overview`);
    setIsOpen(false);
  };

  // JSX
  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)}>
        {currentBusiness?.emoji} {currentBusiness?.name}
      </button>
      {isOpen && (
        <div className="absolute ...">
          {/* Dropdown content */}
        </div>
      )}
    </div>
  );
}

// Export wrapped with Suspense for async operations
export function BusinessSelector() {
  return (
    <Suspense fallback={<SkeletonLoader />}>
      <BusinessSelectorContent />
    </Suspense>
  );
}
```

**Standards:**
- ✓ Always import types for props
- ✓ Separate content component from async wrapper (for Suspense)
- ✓ Order imports: React → Next.js → Custom hooks → Components → Icons → Utilities
- ✓ Handler functions near top, before JSX
- ✓ JSX returns at bottom
- ✓ Use `cn()` for conditional classes, not ternaries in className

### Hook Patterns

```typescript
// hooks/useBusiness.ts
export function useBusiness() {
  const context = useContext(BusinessContext);

  if (!context) {
    throw new Error("useBusiness must be used within BusinessProvider");
  }

  return context;
}
```

**Standards:**
- ✓ Hooks use `use{Feature}` naming
- ✓ Always check context exists and throw if not
- ✓ Return structured object with getter/setter pairs
- ✓ Document dependencies and when to use

### Form Pattern

```typescript
function TaskForm({ onSubmit }: { onSubmit: (data: CreateTaskInput) => Promise<void> }) {
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    try {
      // Validate on client
      const data = new FormData(e.currentTarget);
      const validated = CreateTaskSchema.parse({
        title: data.get("title"),
        // ...
      });

      await onSubmit(validated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.issues.forEach((issue) => {
          const path = issue.path.join(".");
          fieldErrors[path] = issue.message;
        });
        setErrors(fieldErrors);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        name="title"
        placeholder="Task title"
        disabled={isLoading}
        required
      />
      {errors.title && <span className="text-red-500">{errors.title}</span>}
      <button type="submit" disabled={isLoading}>
        {isLoading ? "Creating..." : "Create"}
      </button>
    </form>
  );
}
```

**Standards:**
- ✓ Validate on both client (UX) and server (security)
- ✓ Show field-level errors
- ✓ Disable inputs and button during submission
- ✓ Clear errors on successful submission
- ✓ Use Zod for validation on client side

---

## Backend Patterns

### Mutation Pattern

```typescript
export const createTask = mutation({
  args: {
    businessId: convexVal.id("businesses"),
    title: convexVal.string(),
    description: convexVal.string(),
    priority: convexVal.optional(convexVal.union(...)),
    // ...
  },
  handler: async (
    ctx,
    {
      businessId,
      title,
      description,
      priority = "P2",
      // ...
    }
  ) => {
    // 1. Validate business exists
    const business = await ctx.db.get(businessId);
    if (!business) {
      throw new Error("Business not found");
    }

    // 2. Apply business logic
    const inferred Tags = inferTagsFromContent(title, description);

    // 3. Insert data
    const taskId = await ctx.db.insert("tasks", {
      businessId,
      title,
      description,
      priority,
      tags: inferredTags,
      status: "backlog",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // 4. Log activity
    await ctx.db.insert("activities", {
      businessId,
      taskId,
      type: "task_created",
      actor: "user",
      changes: { created: { title, description } },
      timestamp: Date.now(),
    });

    // 5. Return created resource
    return await ctx.db.get(taskId);
  },
});
```

**Standards:**
- ✓ Validate business exists and is accessible
- ✓ Apply domain logic (tags, defaults, calculations)
- ✓ Always set `businessId` on insert
- ✓ Always set `createdAt`, `updatedAt` timestamps
- ✓ Log all mutations as activities
- ✓ Return the created/updated resource

### Query Pattern

```typescript
export const getTask = query({
  args: {
    taskId: convexVal.id("tasks"),
  },
  handler: async (ctx, { taskId }) => {
    // 1. Fetch
    const task = await ctx.db.get(taskId);

    // 2. Check exists
    if (!task) {
      return null;  // Or throw Error for 404
    }

    // 3. Enrich if needed
    const assignees = await Promise.all(
      task.assigneeIds.map((id) => ctx.db.get(id))
    );

    // 4. Return
    return { ...task, assignees };
  },
});
```

**Standards:**
- ✓ Always filter by businessId where applicable
- ✓ Check exists before returning
- ✓ Enrich with related data if commonly needed
- ✓ Don't over-fetch (use separate queries if optional)

### Activity Logging Pattern

```typescript
// convex/utils/activityLogger.ts
export async function logActivity(
  ctx: any,
  {
    businessId,
    taskId,
    type,
    changes,
    actor,
  }: ActivityLogInput
) {
  const actorName = resolveActorName(actor);

  await ctx.db.insert("activities", {
    businessId,
    taskId,
    type,
    changes,
    actor,
    actorName,
    timestamp: Date.now(),
    ticketNumber: await fetchTicketNumber(taskId),  // Denormalized for quick lookup
  });
}
```

**Standards:**
- ✓ Always log mutations
- ✓ Include businessId for scoping
- ✓ Include human-readable actor name
- ✓ Denormalize frequently-accessed fields (ticketNumber, taskTitle)
- ✓ Use activity type constants: `ACTIVITY_TYPE.TASK_CREATED`

---

## Constants & Configuration

### Constants Pattern

**Location:** `lib/constants/business.ts`

```typescript
// ✓ Domain enums
export const TASK_STATUS = {
  BACKLOG: "backlog",
  READY: "ready",
  IN_PROGRESS: "in_progress",
  REVIEW: "review",
  BLOCKED: "blocked",
  DONE: "done",
} as const;

export type TaskStatus = typeof TASK_STATUS[keyof typeof TASK_STATUS];

// ✓ Display colors
export const STATUS_COLORS: Record<TaskStatus, string> = {
  backlog: "bg-gray-500",
  ready: "bg-blue-500",
  in_progress: "bg-amber-500",
  // ...
};

// ✓ Validation rules
export const VALIDATION = {
  TASK_TITLE_MIN: 3,
  TASK_TITLE_MAX: 200,
  TASK_DESC_MIN: 10,
  TASK_DESC_MAX: 5000,
  COMMENT_MAX: 10000,
} as const;

// ✓ Timeouts
export const TIMEOUTS = {
  TASK_EXECUTION: 300000,  // 5 minutes
  HEARTBEAT_INTERVAL: 30000,  // 30 seconds
  ACTIVITY_POLL: 5000,  // 5 seconds
} as const;

// ✓ Error codes
export const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  CIRCULAR_DEPENDENCY: "CIRCULAR_DEPENDENCY",
} as const;
```

**Standards:**
- ✓ All enums use `as const` for type inference
- ✓ Export type from enum: `type TaskStatus = typeof TASK_STATUS[keyof typeof TASK_STATUS]`
- ✓ Never hardcode magic strings - reference constants
- ✓ Group related constants together
- ✓ Use SCREAMING_SNAKE_CASE for const keys
- ✓ Include comments for non-obvious values

---

## Code Organization

### Directory Structure

```
mission-control/
├── convex/
│   ├── schema.ts              # Data model (single source of truth)
│   ├── tasks.ts               # Task mutations/queries
│   ├── agents.ts              # Agent mutations/queries
│   ├── epics.ts               # Epic mutations/queries
│   ├── notifications.ts       # Notification system
│   ├── migrations.ts          # Data migrations
│   ├── utils/
│   │   ├── activityLogger.ts  # Activity logging
│   │   ├── graphValidation.ts # Dependency validation
│   │   └── epicTaskSync.ts    # Epic-task syncing
│   └── __tests__/             # Backend tests
│
├── lib/
│   ├── constants/
│   │   ├── business.ts        # Domain enums
│   │   └── taskTransitions.ts # State machine
│   ├── validators/
│   │   ├── taskValidators.ts  # Task validation schemas
│   │   ├── agentValidators.ts # Agent validation schemas
│   │   └── __tests__/
│   ├── utils/
│   │   ├── apiResponse.ts     # API response utilities
│   │   ├── logger.ts          # Logging
│   │   └── __tests__/
│   ├── auth/
│   │   ├── permissions.ts     # Authorization logic
│   │   └── __tests__/
│   ├── api-docs-generator.ts  # API documentation registry
│   └── __tests__/
│
├── src/
│   ├── types/
│   │   ├── task.ts            # Shared task types
│   │   ├── agent.ts           # Shared agent types
│   │   └── activity.ts        # Shared activity types
│   │
│   ├── app/
│   │   ├── api/               # Next.js API routes
│   │   │   ├── agents/
│   │   │   │   └── route.ts   # Agent API endpoints
│   │   │   └── __tests__/
│   │   │
│   │   └── (app)/             # Authenticated routes
│   │       ├── layout.tsx      # Main layout (sidebar, header)
│   │       ├── [businessSlug]/ # Business-scoped routes
│   │       │   ├── board/
│   │       │   ├── overview/
│   │       │   └── epics/
│   │       └── global/         # Global routes
│   │           ├── agents/
│   │           ├── activity/
│   │           └── api-docs/
│   │
│   ├── components/
│   │   ├── BusinessSelector.tsx    # Business dropdown
│   │   ├── ActivityFeed.tsx        # Activity list
│   │   ├── dashboard/
│   │   │   ├── DashboardHeader.tsx
│   │   │   ├── DashboardTab.tsx
│   │   │   └── InitializationCard.tsx
│   │   └── __tests__/
│   │
│   ├── hooks/
│   │   ├── useBusiness.ts      # Business context hook
│   │   └── __tests__/
│   │
│   └── styles/
│       └── globals.css         # Global Tailwind styles
│
├── e2e/                        # End-to-end tests
│   ├── task-management.spec.ts
│   ├── epic-management.spec.ts
│   ├── business-selector.spec.ts
│   └── accessibility.spec.ts
│
├── __tests__/                  # Root-level integration tests
├── .eslintrc.json             # Linting rules
├── tsconfig.json              # TypeScript config
├── jest.config.js             # Test config
├── playwright.config.ts       # E2E config
├── .claude/CLAUDE.md          # Project constitution
└── CODING_STANDARDS.md        # This file
```

**Standards:**
- ✓ Group by domain, not by type (tasks/, agents/, not mutations/, queries/)
- ✓ Tests live adjacent to code (`__tests__/` folders)
- ✓ Shared code in `lib/`, not in feature folders
- ✓ One mutation/query file per domain
- ✓ Utilities grouped by functionality (utils/, validators/, auth/)

---

## Anti-Patterns & What to Avoid

### ✗ Anti-Pattern 1: Magic Strings

```typescript
// ✗ WRONG: Magic strings scattered everywhere
if (status === "backlog") { ... }
if (status === "in_progress") { ... }

// ✓ CORRECT: Use constants
if (status === TASK_STATUS.BACKLOG) { ... }
if (status === TASK_STATUS.IN_PROGRESS) { ... }
```

### ✗ Anti-Pattern 2: Missing Business Scoping

```typescript
// ✗ WRONG: No businessId filter
const tasks = await ctx.db.query("tasks").collect();

// ✓ CORRECT: Always scope
const tasks = await ctx.db
  .query("tasks")
  .withIndex("by_business", (q) => q.eq("businessId", businessId))
  .collect();
```

### ✗ Anti-Pattern 3: Unvalidated Input

```typescript
// ✗ WRONG: No validation at boundary
export const createTask = mutation({
  args: {
    title: convexVal.string(),  // Any string accepted
    // ...
  },
  handler: async (ctx, { title }) => {
    // No length check, trim, validation
  }
});

// ✓ CORRECT: Validate with schema
export const createTask = mutation({
  args: { businessId, ...args },
  handler: async (ctx, args) => {
    const validated = validateTaskInput(CreateTaskSchema, args);
    // Now we know title is 3-200 chars, trimmed, etc.
  }
});
```

### ✗ Anti-Pattern 4: Generic Error Messages

```typescript
// ✗ WRONG: Unhelpful error
throw new Error("Something went wrong");

// ✓ CORRECT: Specific, actionable errors
throw new ValidationError(
  "Invalid task title",
  [{ field: "title", message: "must be 3-200 characters" }]
);
throw new NotFoundError("Task");
throw new ConflictError("Circular dependency detected");
```

### ✗ Anti-Pattern 5: No Activity Logging

```typescript
// ✗ WRONG: Silent mutations with no audit trail
export const updateTask = mutation({
  args: { taskId, title, status },
  handler: async (ctx, { taskId, title, status }) => {
    await ctx.db.patch(taskId, { title, status });
  }
});

// ✓ CORRECT: Log all changes
export const updateTask = mutation({
  args: { taskId, title, status, actor },
  handler: async (ctx, args) => {
    const oldTask = await ctx.db.get(args.taskId);
    const changes = {};
    if (args.title && args.title !== oldTask.title) changes.title = args.title;
    if (args.status && args.status !== oldTask.status) changes.status = args.status;

    await ctx.db.patch(args.taskId, changes);
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

### ✗ Anti-Pattern 6: Not Testing Error Cases

```typescript
// ✗ WRONG: Only tests happy path
test("should create task", async () => {
  const result = await createTask(...);
  expect(result.id).toBeDefined();
});

// ✓ CORRECT: Test happy path AND error cases
describe("createTask", () => {
  it("should create task with valid input", async () => {
    const result = await createTask({...validInput});
    expect(result.id).toBeDefined();
  });

  it("should throw when title is too short", async () => {
    expect(() => createTask({...validInput, title: "a"}))
      .toThrow("must be at least 3 characters");
  });

  it("should throw when businessId doesn't exist", async () => {
    expect(() => createTask({...validInput, businessId: "invalid"}))
      .toThrow("Business not found");
  });
});
```

### ✗ Anti-Pattern 7: Over-Complicating Components

```typescript
// ✗ WRONG: 300-line component doing everything
function TaskBoard() {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  // ... 50 more lines of state and handlers
  return (
    <div>
      {/* 200 lines of JSX */}
    </div>
  );
}

// ✓ CORRECT: Composed small components
function TaskBoard() {
  const { tasks, isLoading } = useTasks();
  const [selectedTask, setSelectedTask] = useState(null);

  return (
    <div>
      <TaskFilters />
      <TaskColumns tasks={tasks} onSelect={setSelectedTask} />
      {selectedTask && <TaskDetail task={selectedTask} />}
    </div>
  );
}
```

### ✗ Anti-Pattern 8: Speculative Abstraction

```typescript
// ✗ WRONG: Creating utility for one use case
function formatTaskForDisplay(task) { ... }
function formatAgentForDisplay(agent) { ... }
function formatEpicForDisplay(epic) { ... }

// ✓ CORRECT: Only abstract when there's duplication
// If you're doing the same thing 3+ times, extract

// ✓ Also OK: Keep simple logic inline
<div>{task.title}</div>  // vs extracting formatTaskTitle()
```

### ✗ Anti-Pattern 9: Type Unsafe Queries

```typescript
// ✗ WRONG: No type info
const task = await ctx.db.get(id);
console.log(task.anything);  // No TS error

// ✓ CORRECT: Type your queries
const task = await ctx.db.get<Task>(id);
// Now TS knows task.title, task.status, etc.
```

### ✗ Anti-Pattern 10: Inconsistent Response Format

```typescript
// ✗ WRONG: Inconsistent API responses
export async function GET() {
  return new Response(JSON.stringify({ task }));  // No structure
}

export async function POST() {
  return Response.json(task);  // Different format
}

// ✓ CORRECT: Always use standard format
export async function GET() {
  return jsonResponse(successResponse(task), 200);
}

export async function POST() {
  return jsonResponse(successResponse(createdTask), 201);
}
```

---

## Summary of Key Principles

| Principle | Implementation |
|-----------|-----------------|
| **Type Safety** | Zod schemas at all boundaries, inferred types from constants |
| **Validation** | Mandatory at API routes, mutations, form submissions |
| **Business Scoping** | Every query filters by businessId |
| **Error Handling** | Specific error classes with codes, structured responses |
| **Logging** | All mutations logged as activities with full audit trail |
| **Testing** | TDD: test first, happy path + error cases, E2E for UI |
| **Constants** | Single source of truth, never magic strings |
| **Components** | Small, focused, composed from primitives |
| **Naming** | Clear intent, domain-specific, consistent patterns |
| **Code Organization** | Domain-driven, tests adjacent, shared in lib/ |

---

## Enforcement Mechanisms

### Pre-Commit: Definition of Done
```bash
npm test           # All tests pass
npm run lint       # No linting errors
npm run build      # TypeScript strict mode
npm run e2e        # E2E tests pass (UI rendering verified)
```

### CI/CD: Automated Validation
- ✓ Unit tests must pass
- ✓ Build must succeed (catches TS + import errors)
- ✓ E2E tests for UI changes (catches rendering errors)
- ✓ No hardcoded secrets (credentials, API keys)

### Code Review: Standards Checklist
- ✓ All inputs validated with Zod
- ✓ Business ID scoping on queries
- ✓ Error cases tested
- ✓ Activity logged for mutations
- ✓ No magic strings (use constants)
- ✓ No generic error messages
- ✓ Types inferred from constants
- ✓ Components under 200 lines
- ✓ Tests written (TDD)
- ✓ E2E tests for UI changes

