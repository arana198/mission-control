# Mission Control — Architectural Refactoring Plan

**Date:** 2026-02-17
**Scope:** 25 identified issues, P0–P2 priority
**Horizon:** 4 weeks (Phases 0–3)
**Constraint:** All changes maintain 100% test pass rate and schema migration compliance per CLAUDE.md

---

## Table of Contents

1. [Issue Registry](#1-issue-registry)
2. [Phase 0 — Foundation Security (Week 1)](#2-phase-0--foundation-security-week-1)
3. [Phase 1 — Data Integrity and State (Week 2)](#3-phase-1--data-integrity-and-state-week-2)
4. [Phase 2 — Error Handling and UX (Week 3)](#4-phase-2--error-handling-and-ux-week-3)
5. [Phase 3 — Analytics and Observability (Week 4)](#5-phase-3--analytics-and-observability-week-4)
6. [Testing Strategy](#6-testing-strategy)
7. [Migration Strategy](#7-migration-strategy)
8. [Success Metrics](#8-success-metrics)
9. [Risk Register](#9-risk-register)

---

## 1. Issue Registry

| ID | Category | Priority | Status | Phase |
|----|----------|----------|--------|-------|
| VAL-01 | Validators | P0 | Open | 0 |
| SEC-01 | Security | P0 | Open | 0 |
| FE-01 | Frontend | P0 | Open | 0 |
| LOG-01 | Logging | P0 | Open | 0 |
| DM-01 | Data Model | P0 | Open | 0 |
| DM-02 | Data Model | P0 | Open | 0 |
| TM-01 | Task System | P0 | Open | 0 |
| AA-01 | Assignment | P0 | Open | 0 |
| TM-02 | Task System | P0 | Open | 1 |
| TM-03 | Task System | P0 | Open | 1 |
| DM-03 | Data Model | P1 | Open | 1 |
| DM-04 | Data Model | P1 | Open | 1 |
| AA-02 | Assignment | P1 | Open | 1 |
| FE-02 | Frontend | P1 | Open | 1 |
| MIG-01 | Migrations | P1 | Open | 1 |
| FE-03 | Frontend | P1 | Open | 2 |
| GH-01 | GitHub | P1 | Open | 2 |
| GH-02 | GitHub | P1 | Open | 2 |
| GH-03 | GitHub | P1 | Open | 2 |
| CP-01 | Critical Path | P2 | Open | 3 |
| MSG-01 | Messaging | P2 | Open | 3 |
| IDX-01 | Indexes | P2 | Open | 3 |
| PERF-01 | Performance | P2 | Open | 3 |
| OBS-01 | Observability | P2 | Open | 3 |

---

## 2. Phase 0 — Foundation Security (Week 1)

**Objective:** Eliminate correctness and security defects that compromise data integrity or allow invalid data to enter the system. These issues represent active risk in production; no other phase begins until all Phase 0 items pass tests.

**Estimated Complexity:** High (8 issues, affects schema, backend logic, and frontend hook rules)

---

### VAL-01: Fix Zod validators — UUID format to Convex ID format

**File:** `/Users/arana/dev/ankit/mission-control/lib/validators/taskValidators.ts`

**Problem:** Convex generates IDs in the format `j97abc123def456` (alphanumeric strings), not RFC 4122 UUIDs. The schemas on lines 32, 43, 68, 100, 125–133, 191–193 use `z.string().uuid()`, which means every real Convex ID will fail validation. This silently breaks the `createTask` and `update` mutations in `convex/tasks.ts` (lines 46–61 and 403–413) wherever the validator is called.

**Root Cause:** The validator library was authored without reference to the actual ID format Convex produces.

**Files to Modify:**
- `/Users/arana/dev/ankit/mission-control/lib/validators/taskValidators.ts` — lines 32, 43, 68, 100, 125–133, 191–193

**Changes Required:**

Replace every occurrence of `z.string().uuid(...)` that validates a Convex entity ID with a regex validator matching the Convex ID pattern:

```typescript
// Before (line 32):
assigneeIds: z.array(z.string().uuid("Invalid agent ID format")).optional()

// After:
const convexId = () => z.string().regex(/^[a-z0-9]+$/, "Invalid Convex ID format");
assigneeIds: z.array(convexId()).optional()
```

The fix must be applied to:
- `assigneeIds` field in `CreateTaskSchema` (line 32)
- `epicId` field in `CreateTaskSchema` (line 43)
- `taskId` field in `UpdateTaskSchema` (line 68)
- `assigneeIds` field in `UpdateTaskSchema` (line 100)
- `taskId`, `assigneeIds`, `assignedBy` fields in `AssignTaskSchema` (lines 125–133)
- `taskId` field in `UpdateTaskStatusSchema` (line 141)
- `taskId` field in `CreateCommentSchema` (line 167)
- `taskId`, `blockedByTaskId`, `addedBy` fields in `AddDependencySchema` (lines 191–193)

**Note on `addedBy`:** The `addedBy` field accepts either a Convex agent ID or the string literal `"user"`. The correct validator is a union: `z.union([convexId(), z.literal("user")])`.

**Mutations Affected:**
- `convex/tasks.ts`: `createTask` (line 46), `update` (line 403)

**Tests to Update:**
- `/Users/arana/dev/ankit/mission-control/lib/validators/__tests__/taskValidators.test.ts`

Replace all UUID fixtures (`550e8400-e29b-41d4-a716-446655440000`) with valid Convex-format IDs (e.g., `j97abc123def456`). The test on line 119 `"should reject invalid assigneeIds (not UUIDs)"` must be renamed to `"should reject non-Convex IDs"` and its fixture changed to `"not-valid-!!!"`.

**Acceptance Criteria:**
- `npm test` passes with updated fixtures
- `createTask` and `update` mutations accept real Convex IDs without throwing validation errors
- Invalid strings (empty, UUID-format, special chars) are still rejected

---

### SEC-01: Add access control to mutations

**Files:**
- `/Users/arana/dev/ankit/mission-control/convex/tasks.ts` — `remove` mutation (lines 934–1033)
- `/Users/arana/dev/ankit/mission-control/convex/tasks.ts` — `updateStatus` mutation (lines 291–352)
- `/Users/arana/dev/ankit/mission-control/convex/epics.ts` — `remove` mutation (lines 110–131)
- `/Users/arana/dev/ankit/mission-control/convex/migrations.ts` — `deleteEpic` mutation (lines 245–302)

**Problem:** The `remove` mutation on line 947 checks `task.createdBy === deletedBy || deletedBy === "user"`. The literal string `"user"` is a client-supplied value. Any caller that passes `"user"` as `deletedBy` bypasses the creator check entirely and can delete any task. There is no server-side identity verification — the caller identity is fully self-reported.

The `updateStatus` mutation (line 305) accepts `updatedBy: v.optional(v.string())` with no validation. The GitHub integration in `convex/github.ts` (line 66) uses a settings mutation with no access restriction.

**Changes Required:**

For the current architecture (no auth layer), implement at minimum a server-enforced allowlist:

```typescript
// In convex/tasks.ts remove mutation, replace lines 944–949:
const ALLOWED_ADMIN_IDS = new Set(["user"]);

const canDelete =
  task.createdBy === deletedBy ||
  ALLOWED_ADMIN_IDS.has(deletedBy);

if (!canDelete) {
  throw new Error("Unauthorized: only task creator can delete this task");
}
```

For longer-term security, add a `lib/auth/permissions.ts` helper that centralizes the authorization logic:

```typescript
// lib/auth/permissions.ts
export const SYSTEM_ACTOR_IDS = new Set(["user", "system", "jarvis", "system:auto-claim"]);

export function isAuthorizedActor(actorId: string): boolean {
  return SYSTEM_ACTOR_IDS.has(actorId);
}

export function canDeleteTask(task: { createdBy: string }, deletedBy: string): boolean {
  return task.createdBy === deletedBy || SYSTEM_ACTOR_IDS.has(deletedBy);
}
```

**Mutations Affected:** `tasks.remove`, `tasks.updateStatus`, `epics.remove`, `migrations.deleteEpic`

**Frontend Components to Validate:**
- `/Users/arana/dev/ankit/mission-control/src/components/DraggableTaskBoard.tsx` — `TaskDetailModal` (line 285) uses the delete flow indirectly through `updateTask`

**Acceptance Criteria:**
- Calling `tasks.remove` with an arbitrary `deletedBy` string that is not the creator and not an allowed admin throws an `"Unauthorized"` error
- Unit tests cover the permission helper for all combinations

---

### FE-01: Fix hooks violations in DraggableTaskBoard

**File:** `/Users/arana/dev/ankit/mission-control/src/components/DraggableTaskBoard.tsx`

**Problem 1 — Conditional hook call (lines 304–307):**

```typescript
// Current code — ILLEGAL:
let updateTask: any;
try {
  updateTask = useMutation(api.tasks.update);
} catch (e) {}
```

React hooks must not be called inside `try/catch` blocks or conditionally. This violates the Rules of Hooks. If React renders `TaskDetailModal` multiple times (e.g., during Strict Mode double-invoke), this will produce inconsistent hook call counts, causing crashes.

**Problem 2 — Same pattern repeated (lines 646–650):**

```typescript
let createMessage: any, deleteMessage: any;
try {
  createMessage = useMutation(api.messages.create);
  deleteMessage = useMutation(api.messages.remove);
} catch (e) {}
```

**Problem 3 — `useCallback` missing import (line 879):**

`useCallback` is used on line 879 inside `TaskCommits` but is not imported from React at line 3. This will cause a `ReferenceError` at runtime.

**Changes Required:**

```typescript
// Line 3 — add useCallback to imports:
import { useState, useMemo, useRef, useEffect, useCallback } from "react";

// Lines 304–307 — unconditional hook call:
const updateTask = useMutation(api.tasks.update);

// Lines 646–650 — unconditional hook calls:
const createMessage = useMutation(api.messages.create);
const deleteMessage = useMutation(api.messages.remove);
```

Guard usage sites with null-checks on the mutation result where needed, not on the hook call itself.

**Frontend Components to Validate:**
- `DraggableTaskBoard.tsx` — full component, all modals
- `TaskComments` sub-component
- `TaskCommits` sub-component

**Tests Required:**
- Render test verifying `TaskDetailModal` does not throw on mount
- Render test verifying `TaskComments` renders without crashing
- Render test verifying hooks call count is consistent across re-renders

**Acceptance Criteria:**
- `npm run lint` passes with no React hooks rule violations
- `react-hooks/rules-of-hooks` ESLint rule reports zero errors
- `npm test` passes

---

### LOG-01: Fix agentId consistency in activity logging

**Files:**
- `/Users/arana/dev/ankit/mission-control/convex/tasks.ts` — lines 103, 341–343, 447–449, 619–622, 742–744, 892–898
- `/Users/arana/dev/ankit/mission-control/convex/agents.ts` — line 63–68
- `/Users/arana/dev/ankit/mission-control/convex/wake.ts` — line 37–39

**Problem:** Activity log entries inconsistently populate `agentId` and `agentName`. Examples:

- `tasks.ts` line 103: `agentId: createdBy, agentName: createdBy` — uses the raw ID string as the name
- `tasks.ts` line 341: `agentId: updatedBy || "system", agentName: updatedBy || "system"` — same problem
- `tasks.ts` line 447: `agentId: "user", agentName: "user"` — hard-coded non-descriptive name
- `wake.ts` line 37: `agentId: requestedBy, agentName: requestedBy` — requestedBy is a string like `"system:auto-claim"`, not a display name

This means the activity feed shows agent IDs where it should show names, and the `by_agent` index (schema line 228) returns no results when queried by name.

**Changes Required:**

Create a shared helper in `convex/utils/activityLogger.ts`:

```typescript
// convex/utils/activityLogger.ts
import { MutationCtx } from "../_generated/server";

export async function resolveActorName(
  ctx: MutationCtx,
  actorId: string
): Promise<string> {
  if (actorId === "user") return "You";
  if (actorId === "system" || actorId.startsWith("system:")) return "Mission Control";

  // Try to resolve as agent ID
  try {
    const agent = await ctx.db.get(actorId as any);
    if (agent && agent.name) return agent.name;
  } catch {
    // Not a valid Convex ID
  }

  return actorId; // Fallback
}
```

Then in each activity insert, replace `agentName: agentId` with a resolved name:

```typescript
// tasks.ts line 101–109 (createTask activity):
const actorName = await resolveActorName(ctx, createdBy);
await ctx.db.insert("activities", {
  type: "task_created",
  agentId: createdBy,
  agentName: actorName,  // Resolved name, not raw ID
  message: `Created task: ${title}`,
  taskId,
  taskTitle: title,
  createdAt: Date.now(),
});
```

Apply the same pattern to all 6 affected call sites in `tasks.ts`, 1 in `agents.ts`, and 1 in `wake.ts`.

**Queries Affected:** `activities.getByAgent`, `activities.getRecent`, `activities.getFeed`

**Frontend Components to Validate:**
- `/Users/arana/dev/ankit/mission-control/src/components/ActivityFeed.tsx`
- `/Users/arana/dev/ankit/mission-control/src/components/DashboardContent.tsx`

**Acceptance Criteria:**
- Activity feed shows human-readable names instead of raw IDs for all activity types
- `activities.getByAgent` returns correct results when queried with an agent's Convex ID

---

### DM-01: Add cleanup of parent subtaskIds on task deletion

**File:** `/Users/arana/dev/ankit/mission-control/convex/tasks.ts` — `remove` mutation (lines 934–1033)

**Problem:** When a subtask is deleted, the `remove` mutation (line 956) cleans up `blockedBy`/`blocks` cross-references but does NOT remove the deleted task's ID from its parent's `subtaskIds` array. The parent task retains a dangling reference, which causes `getWithSubtasks` (line 906) to call `ctx.db.get()` on a non-existent ID, silently returning null and producing corrupted subtask counts.

Additionally, `migrations.ts` `deleteTask` (line 426) does not clean up parent `subtaskIds` either.

**Changes Required:**

In `convex/tasks.ts` `remove` handler, after the dependency cleanup block (after line 975), add:

```typescript
// DM-01: Clean up parent's subtaskIds reference
if (task.parentId) {
  const parent = await ctx.db.get(task.parentId);
  if (parent && parent.subtaskIds) {
    await ctx.db.patch(task.parentId, {
      subtaskIds: parent.subtaskIds.filter((id) => id !== taskId),
      updatedAt: Date.now(),
    });
  }
}
```

Apply the same fix to `migrations.ts` `deleteTask` handler (after line 444).

**Queries Affected:** `tasks.getWithSubtasks` (line 906)

**Frontend Components to Validate:**
- Any component rendering subtask counts or subtask lists

**Tests Required:**
- Unit test: delete a subtask, assert parent's `subtaskIds` no longer contains deleted ID
- Unit test: delete a root task (no parent), assert no error thrown

**Acceptance Criteria:**
- After deleting a subtask, `getWithSubtasks` on the parent returns `subtaskCount` that excludes the deleted task
- No dangling IDs remain in any parent's `subtaskIds` array after deletion

---

### DM-02: Centralize epic-task bidirectional update logic

**Files:**
- `/Users/arana/dev/ankit/mission-control/convex/tasks.ts` — lines 89–98 (createTask), lines 440 (update)
- `/Users/arana/dev/ankit/mission-control/convex/migrations.ts` — lines 129–153 (assignEpic), lines 382–407 (updateTask), lines 208–219 (smartAssignEpics)
- `/Users/arana/dev/ankit/mission-control/convex/epics.ts` — lines 117–127 (remove)

**Problem:** The logic for maintaining the bidirectional link between a task's `epicId` and an epic's `taskIds` array is duplicated across at least 5 mutation handlers. Each copy has subtle differences:

- `tasks.ts` line 89–98: checks `!epic.taskIds?.includes(taskId)` before adding
- `migrations.ts` line 147: checks `!newEpic.taskIds.includes(taskId)` (no optional chaining)
- `migrations.ts` line 400: no deduplication check at all
- `migrations.ts` line 214: no deduplication check at all

This means some paths can create duplicate entries in `epic.taskIds`, and some paths don't remove from the old epic when reassigning.

**Changes Required:**

Create a shared internal helper in `convex/utils/epicTaskSync.ts`:

```typescript
// convex/utils/epicTaskSync.ts
import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Moves a task from one epic to another, maintaining bidirectional integrity.
 * Safe to call with null/undefined for either epic ID.
 */
export async function syncEpicTaskLink(
  ctx: MutationCtx,
  taskId: Id<"tasks">,
  oldEpicId: Id<"epics"> | undefined,
  newEpicId: Id<"epics"> | undefined
): Promise<void> {
  // Remove from old epic
  if (oldEpicId && oldEpicId !== newEpicId) {
    const oldEpic = await ctx.db.get(oldEpicId);
    if (oldEpic) {
      await ctx.db.patch(oldEpicId, {
        taskIds: (oldEpic.taskIds || []).filter((id) => id !== taskId),
        updatedAt: Date.now(),
      });
    }
  }

  // Add to new epic (deduplicated)
  if (newEpicId) {
    const newEpic = await ctx.db.get(newEpicId);
    if (newEpic && !newEpic.taskIds.includes(taskId)) {
      await ctx.db.patch(newEpicId, {
        taskIds: [...newEpic.taskIds, taskId],
        updatedAt: Date.now(),
      });
    }
  }
}
```

Replace all 5 inline implementations with a call to `syncEpicTaskLink`. This is a pure refactor with no behavioral change for the common case; it only fixes the edge cases (no dedup, no old-epic removal).

**Mutations Affected:** `tasks.createTask`, `tasks.update`, `migrations.assignEpic`, `migrations.updateTask`, `migrations.smartAssignEpics`

**Tests Required:**
- Unit test: create task with epic, assert epic's `taskIds` contains task ID exactly once
- Unit test: reassign task to different epic, assert old epic no longer contains task, new epic contains task
- Unit test: reassign task to same epic, assert no duplicate entries

**Acceptance Criteria:**
- No epic has duplicate task IDs in its `taskIds` array
- Reassigning a task between epics always produces consistent state in both epics

---

### TM-01: Add state transition guards to moveStatus and updateStatus

**File:** `/Users/arana/dev/ankit/mission-control/convex/tasks.ts`

**Problem:** The `moveStatus` mutation (lines 161–183) and `updateStatus` mutation (lines 291–352) accept any `toStatus` value with no validation of whether the transition is legal. This allows nonsensical transitions such as `done -> blocked`, `blocked -> review`, or `done -> backlog` without any business-logic review.

Additionally, neither mutation checks whether a task with active `blockedBy` entries is being moved to a non-blocked status.

**Allowed Transitions (business rules):**

```
backlog    -> ready, blocked
ready      -> in_progress, backlog, blocked
in_progress-> review, blocked, done, ready
review     -> done, in_progress, blocked
blocked    -> ready (when blockers cleared), backlog
done       -> (terminal — no transitions allowed)
```

**Changes Required:**

Add a `lib/constants/taskTransitions.ts` file:

```typescript
// lib/constants/taskTransitions.ts
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  backlog:     ["ready", "blocked"],
  ready:       ["in_progress", "backlog", "blocked"],
  in_progress: ["review", "blocked", "done", "ready"],
  review:      ["done", "in_progress", "blocked"],
  blocked:     ["ready", "backlog"],
  done:        [], // Terminal state
};

export function isTransitionAllowed(from: string, to: string): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
```

In `moveStatus` handler (after line 174), add:

```typescript
if (!isTransitionAllowed(task.status, toStatus)) {
  throw new Error(
    `Invalid transition: ${task.status} -> ${toStatus}. ` +
    `Allowed: ${ALLOWED_TRANSITIONS[task.status]?.join(", ") || "none"}`
  );
}
```

Apply the same guard to `updateStatus` handler (after line 307).

**Note:** The `update` mutation (line 380) also accepts `status` — apply the same guard there, reading the current task status from the database before patching.

**Mutations Affected:** `tasks.moveStatus`, `tasks.updateStatus`, `tasks.update`

**Frontend Components to Validate:**
- `/Users/arana/dev/ankit/mission-control/src/components/DraggableTaskBoard.tsx` — drag-and-drop calls `updateTask` which calls `tasks.update`
- `/Users/arana/dev/ankit/mission-control/src/components/KanbanColumn.tsx`

**Tests Required:**
- Unit test for `isTransitionAllowed` covering all valid transitions
- Unit test confirming `done -> blocked` throws
- Unit test confirming `blocked -> review` throws (must go through `ready` first)
- Integration test: drag task from `done` column throws correct error

**Acceptance Criteria:**
- Attempting an invalid transition throws a descriptive error
- All valid transitions succeed
- The Kanban board does not allow dragging tasks out of `done` (UI guard)

---

### AA-01: Extract roleKeywords to shared constant

**File:** `/Users/arana/dev/ankit/mission-control/convex/tasks.ts`

**Problem:** The `roleKeywords` mapping is defined identically in two places:
- Lines 650–661 inside `smartAssign` mutation handler
- Lines 763–774 inside the `findBestAgent` helper function

Any change to role keywords (e.g., adding "analytics" to "SEO Analyst") must be made in two places. This will diverge under maintenance.

**Changes Required:**

Extract to a shared constant file. Since this is used in Convex backend only, place it in `convex/utils/roleKeywords.ts`:

```typescript
// convex/utils/roleKeywords.ts
export const ROLE_KEYWORDS: Record<string, string[]> = {
  "Product Analyst": [
    "research", "analysis", "competitor", "user persona",
    "persona", "market", "requirements"
  ],
  "Customer Researcher": [
    "customer", "research", "reviews", "feedback",
    "survey", "interview", "user research"
  ],
  "SEO Analyst": [
    "seo", "keyword", "search", "ranking",
    "optimization", "analytics", "google"
  ],
  "Content Writer": [
    "content", "writing", "copy", "blog",
    "article", "seo copy", "documentation"
  ],
  "Social Media Manager": [
    "social", "twitter", "linkedin", "tiktok",
    "content calendar", "post", "engagement"
  ],
  "Designer": [
    "design", "ui", "ux", "mockup",
    "wireframe", "visual", "graphic", "icon", "screenshot"
  ],
  "Email Marketing": [
    "email", "sequence", "drip", "campaign",
    "newsletter", "onboarding"
  ],
  "Developer": [
    "code", "backend", "frontend", "api",
    "database", "implementation", "integration", "build"
  ],
  "Documentation": [
    "docs", "documentation", "readme", "guide", "help", "wiki"
  ],
  "Squad Lead": [],
};
```

Replace the inline definitions in `tasks.ts` lines 650–661 and 763–774 with `import { ROLE_KEYWORDS } from "./utils/roleKeywords"` and usage of the imported constant.

**Acceptance Criteria:**
- Exactly one definition of `roleKeywords` exists in the codebase
- Both `smartAssign` and `autoAssignBacklog` use the imported constant
- Adding a keyword to the constant propagates to both assignment paths

---

## 3. Phase 1 — Data Integrity and State (Week 2)

**Objective:** Enforce correct task lifecycle state management, prevent unbounded query growth, and eliminate stale data accumulation. Phase 1 is safe to begin only after all Phase 0 tests pass.

**Estimated Complexity:** High (7 issues, requires schema consideration for DM-03 pagination and DM-04 TTL)

---

### TM-02: Auto-set blocked status when dependency is added

**File:** `/Users/arana/dev/ankit/mission-control/convex/tasks.ts` — `addDependency` mutation (lines 1041–1095)

**Problem:** When `addDependency` is called, the mutation adds the blocker ID to `task.blockedBy` but does NOT update `task.status` to `"blocked"`. A task with active blockers will remain in `in_progress` or `ready`, which is logically inconsistent and misleads agents looking at the board.

**Changes Required:**

In the `addDependency` handler, after both `ctx.db.patch` calls (after line 1078), add:

```typescript
// TM-02: Auto-set blocked status when dependency is added
// Only block if the blocker is not already done
if (blocker.status !== "done" && task.status !== "done" && task.status !== "blocked") {
  await ctx.db.patch(taskId, {
    status: "blocked",
    updatedAt: Date.now(),
  });

  // Log the automatic status change
  await ctx.db.insert("activities", {
    type: "task_blocked",
    agentId: addedBy,
    agentName: addedBy,
    message: `Task "${task.title}" automatically blocked by "${blocker.title}"`,
    taskId,
    taskTitle: task.title,
    oldValue: task.status,
    newValue: "blocked",
    createdAt: Date.now(),
  });
}
```

**Mutations Affected:** `tasks.addDependency`

**Frontend Components to Validate:**
- `DraggableTaskBoard.tsx` — `TaskDetailModal` dependency UI (lines 320–338)
- `KanbanColumn.tsx` — task card should move to Blocked column

**Tests Required:**
- Integration test: add dependency to `in_progress` task, assert task status becomes `blocked`
- Integration test: add dependency where blocker is `done`, assert task status unchanged
- Integration test: add dependency to already `blocked` task, assert no duplicate status change activity

**Acceptance Criteria:**
- Task automatically moves to `blocked` column when a non-done dependency is added
- No status change if the blocker is already done
- Activity log records the automatic status transition

---

### TM-03: Auto-unblock when all blockers removed

**File:** `/Users/arana/dev/ankit/mission-control/convex/tasks.ts` — `removeDependency` mutation (lines 1102–1145)

**Problem:** When `removeDependency` is called, the mutation removes the blocker ID from `task.blockedBy` but does NOT update `task.status` back to `"ready"` even when all blockers are cleared. A task whose last blocker is removed remains stuck in `"blocked"` indefinitely unless an agent manually changes it.

**Changes Required:**

In `removeDependency` handler, after both `ctx.db.patch` calls (after line 1128), add:

```typescript
// TM-03: Auto-unblock when all blockers removed
const remainingBlockers = updatedBlockedBy;
const activeBlockers = await Promise.all(
  remainingBlockers.map((id) => ctx.db.get(id))
);
const hasActiveBlockers = activeBlockers.some(
  (b) => b && b.status !== "done"
);

if (!hasActiveBlockers && task.status === "blocked") {
  await ctx.db.patch(taskId, {
    status: "ready",
    updatedAt: Date.now(),
  });

  await ctx.db.insert("activities", {
    type: "task_updated",
    agentId: removedBy,
    agentName: removedBy,
    message: `Task "${task.title}" automatically unblocked — all dependencies cleared`,
    taskId,
    taskTitle: task.title,
    oldValue: "blocked",
    newValue: "ready",
    createdAt: Date.now(),
  });

  // Notify assignees that task is now unblocked
  for (const assigneeId of task.assigneeIds) {
    await ctx.db.insert("notifications", {
      recipientId: assigneeId,
      type: "dependency_unblocked",
      content: `Task "${task.title}" is now unblocked and ready to work on`,
      fromId: removedBy,
      fromName: removedBy,
      taskId,
      taskTitle: task.title,
      read: false,
      createdAt: Date.now(),
    });
  }
}
```

**Mutations Affected:** `tasks.removeDependency`

**Tests Required:**
- Integration test: remove last blocker from `blocked` task, assert status becomes `ready`
- Integration test: remove one of two blockers from `blocked` task, assert status stays `blocked`
- Integration test: remove blocker from `in_progress` task (not currently blocked), assert status unchanged

**Acceptance Criteria:**
- Task automatically transitions to `ready` when its last active blocker is removed or completed
- Assignees receive a `dependency_unblocked` notification
- Task remains `blocked` if any other active blockers remain

---

### DM-03: Implement pagination in getAll query

**File:** `/Users/arana/dev/ankit/mission-control/convex/tasks.ts` — `getAll` query (lines 134–138)

**Problem:** `getAll` uses `.take(100)`, which is a hard cap but not true pagination. As task count grows, callers cannot retrieve tasks beyond position 100. The query also lacks cursor-based pagination support. With typical real usage, this limit will be hit and tasks will silently disappear from the board.

**Changes Required:**

Replace the `getAll` query with a cursor-based paginated version:

```typescript
// tasks.ts — replace lines 134–138
export const getAll = query({
  args: {
    paginationOpts: v.optional(v.object({
      cursor: v.optional(v.string()),
      numItems: v.optional(v.number()),
    })),
  },
  handler: async (ctx, { paginationOpts }) => {
    const limit = Math.min(paginationOpts?.numItems ?? 100, 200);

    let q = ctx.db.query("tasks").withIndex("by_created_at").order("desc");

    const results = await q.take(limit);

    return {
      tasks: results,
      hasMore: results.length === limit,
      // Convex pagination: use last item's createdAt as next cursor
      nextCursor: results.length > 0 ? results[results.length - 1].createdAt : null,
    };
  },
});
```

**Frontend Components to Validate:**
- `/Users/arana/dev/ankit/mission-control/src/components/Dashboard.tsx`
- `/Users/arana/dev/ankit/mission-control/src/components/DashboardContent.tsx`
- `/Users/arana/dev/ankit/mission-control/src/components/useDashboardQueries.ts`
- `DraggableTaskBoard.tsx` — receives `tasks` prop from parent

**Migration Notes:** Callers using `api.tasks.getAll` must be updated to handle the new return shape `{ tasks, hasMore, nextCursor }` instead of a raw array.

**Tests Required:**
- Unit test: `getAll` returns max 200 items even when `numItems: 500` is passed
- Unit test: `getAll` returns `hasMore: true` when result count equals limit
- Integration test: verify frontend components handle the new shape without crash

**Acceptance Criteria:**
- `getAll` never returns more than 200 tasks in a single call
- Frontend displays correct task count
- Load-more capability is enabled for dashboards that need it

---

### DM-04: Add TTL-based cleanup for wakeRequests

**File:** `/Users/arana/dev/ankit/mission-control/convex/wake.ts`

**Problem:** `wakeRequests` records (schema lines 347–359) are inserted with `status: "pending"` but completed/failed records are never cleaned up. Over time, the `wakeRequests` table accumulates every historical wake request. The `getPending` query (line 53) scans by the `by_status` index, so old completed records do not affect query performance, but the table grows unboundedly and increases storage costs and migration complexity.

**Changes Required:**

Add a cleanup mutation:

```typescript
// wake.ts — add after line 78
export const cleanupStale = mutation({
  args: {
    olderThanMs: v.optional(v.number()),
  },
  handler: async (ctx, { olderThanMs = 7 * 24 * 60 * 60 * 1000 }) => {
    const cutoff = Date.now() - olderThanMs;

    // Delete completed/failed requests older than TTL
    const stale = await ctx.db
      .query("wakeRequests")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .filter((q) => q.lt(q.field("createdAt"), cutoff))
      .take(100); // Batch cap per MIG-01 pattern

    for (const req of stale) {
      await ctx.db.delete(req._id);
    }

    const staleFailed = await ctx.db
      .query("wakeRequests")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .filter((q) => q.lt(q.field("createdAt"), cutoff))
      .take(100);

    for (const req of staleFailed) {
      await ctx.db.delete(req._id);
    }

    return { deleted: stale.length + staleFailed.length };
  },
});
```

Wire this mutation into the disabled cron file (`convex/cron.ts.disabled`) to run daily. Additionally, set `expiresAt` on new `wakeRequests` records:

```typescript
// wake.ts requestWake — add to insert args:
expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 day TTL
```

**Queries Affected:** `wake.getPending`

**Tests Required:**
- Unit test: `cleanupStale` deletes completed requests older than 7 days
- Unit test: `cleanupStale` does not delete pending requests
- Unit test: `cleanupStale` caps deletes at 100 records per call

**Acceptance Criteria:**
- `wakeRequests` table size is bounded to at most ~7 days of records
- `getPending` remains fast (only reads `pending` status via index)

---

### AA-02: Add workload balancing to assignment algorithm

**File:** `/Users/arana/dev/ankit/mission-control/convex/tasks.ts` — `smartAssign` (lines 632–758) and `findBestAgent` (lines 762–796)

**Problem:** The current assignment algorithm selects the agent with the highest keyword match score, with no consideration of how many active tasks that agent already has. An agent with 20 in-progress tasks and a perfect keyword match will always win over an agent with 0 tasks and a slightly lower match. This creates workload concentration and leaves some agents idle while others are overloaded.

**Changes Required:**

Modify `findBestAgent` to incorporate a workload penalty. First, load the active task counts for all agents in a single query (avoid N+1):

```typescript
// convex/tasks.ts — replace findBestAgent function (lines 762–796)
async function findBestAgent(
  ctx: any,
  agents: any[],
  task: any
): Promise<any> {
  // Load all in-progress tasks once
  const inProgressTasks = await ctx.db
    .query("tasks")
    .withIndex("by_status", (q: any) => q.eq("status", "in_progress"))
    .collect();

  // Count tasks per agent
  const agentTaskCounts = new Map<string, number>();
  for (const agent of agents) {
    agentTaskCounts.set(agent._id, 0);
  }
  for (const t of inProgressTasks) {
    for (const assigneeId of t.assigneeIds) {
      agentTaskCounts.set(
        assigneeId,
        (agentTaskCounts.get(assigneeId) ?? 0) + 1
      );
    }
  }

  const searchText = `${task.title} ${task.description}`.toLowerCase();
  const matchedAgents: {
    agentId: any;
    name: string;
    score: number;
    workload: number;
  }[] = [];

  for (const agent of agents) {
    const keywords = ROLE_KEYWORDS[agent.role] || [];
    let keywordScore = 0;
    for (const keyword of keywords) {
      if (searchText.includes(keyword.toLowerCase())) keywordScore++;
    }

    if (keywordScore > 0) {
      matchedAgents.push({
        agentId: agent._id,
        name: agent.name,
        score: keywordScore,
        workload: agentTaskCounts.get(agent._id) ?? 0,
      });
    }
  }

  // Score = keyword_score - (workload_penalty_factor * active_tasks)
  // Workload penalty: each active task reduces score by 0.2
  const WORKLOAD_PENALTY = 0.2;
  matchedAgents.sort((a, b) => {
    const scoreA = a.score - a.workload * WORKLOAD_PENALTY;
    const scoreB = b.score - b.workload * WORKLOAD_PENALTY;
    return scoreB - scoreA;
  });

  return (
    matchedAgents[0] ||
    agents.find((a) => a.level === "lead") ||
    agents[0]
  );
}
```

**Mutations Affected:** `tasks.smartAssign`, `tasks.autoAssignBacklog`

**Tests Required:**
- Unit test: agent with 10 active tasks scores lower than equally matched agent with 2 tasks
- Unit test: agent with very high keyword match still wins over agent with 0 workload and 0 keyword match
- Unit test: no agents match keywords, falls back to squad lead regardless of workload

**Acceptance Criteria:**
- Assignment fairness metric: no single agent carries more than 3x the average workload
- Existing assignment behavior is preserved when all agents have equal workload

---

### FE-02: Subscribe TaskDetailModal to live task data

**File:** `/Users/arana/dev/ankit/mission-control/src/components/DraggableTaskBoard.tsx` — `TaskDetailModal` (lines 285–636)

**Problem:** `TaskDetailModal` receives `task` as a prop (line 285) — a snapshot passed from the parent at the moment of click. If another user or agent updates the task (status, assignees, dependencies) while the modal is open, the modal shows stale data. The `selectedTask` state in `DraggableTaskBoard` is never updated reactively.

**Changes Required:**

Inside `TaskDetailModal`, subscribe to the live task document:

```typescript
// Add at the top of TaskDetailModal function body, after line 301:
const liveTask = useQuery(api.tasks.getById, { id: task._id as any });
const currentTask = liveTask ?? task; // Fall back to prop if query loading
```

Then replace all `task.xxx` field reads in the modal body with `currentTask.xxx`. This ensures the modal reflects real-time state.

**Note:** The `getById` query (tasks.ts line 153) is already correctly defined. This change requires no backend modification.

**Frontend Components to Validate:**
- `DraggableTaskBoard.tsx` — `TaskDetailModal`

**Tests Required:**
- Render test: modal initially shows prop task data, then re-renders when `useQuery` resolves
- Render test: if task is deleted while modal is open, modal receives `null` from `liveTask` and falls back to prop

**Acceptance Criteria:**
- Opening a task modal and having another session update the task causes the modal to reflect the update within Convex's real-time latency (~100ms)

---

### MIG-01: Add batch caps to migrations

**File:** `/Users/arana/dev/ankit/mission-control/convex/migrations.ts`

**Problem:** `migrateTasksToEpic` (lines 36–112) and `smartAssignEpics` (lines 171–242) iterate over ALL tasks without any batch limit. `deleteEpic` (lines 245–302) also iterates over all task IDs without a cap. In a production system with 1,000+ tasks, these mutations will exceed Convex's execution time limit and fail mid-migration, potentially leaving the database in a partially migrated state.

**Changes Required:**

Add a `limit` argument to all unbounded migration mutations:

```typescript
// migrations.ts — migrateTasksToEpic, add args:
args: {
  epicId: v.optional(v.id("epics")),
  batchSize: v.optional(v.number()),
},
handler: async (ctx, { epicId, batchSize = 100 }) => {
  // ...
  // Replace: for (const task of orphanedTasks) {
  const batch = orphanedTasks.slice(0, batchSize);
  for (const task of batch) {
    // ...
  }

  return {
    updatedCount,
    remaining: orphanedTasks.length - batch.length,
    // Caller should repeat until remaining === 0
  };
}
```

Apply the same `batchSize` cap (default 100, max 500) to `smartAssignEpics` and `deleteEpic`.

**Tests Required:**
- Unit test: `migrateTasksToEpic` with 150 orphan tasks and `batchSize: 100` processes exactly 100 and reports `remaining: 50`
- Unit test: second call processes remaining 50

**Acceptance Criteria:**
- No migration mutation processes more than 500 records in a single call
- Callers can resume by calling again until `remaining === 0`

---

## 4. Phase 2 — Error Handling and UX (Week 3)

**Objective:** Replace all blocking UI patterns (`alert()`) with non-blocking toast notifications. Harden the GitHub integration against JSON parse errors and API rate limits. Estimated Complexity: Medium.

---

### FE-03: Replace alert() with toast notifications

**File:** `/Users/arana/dev/ankit/mission-control/src/components/DraggableTaskBoard.tsx`

**Problem:** The component uses `alert()` in 12 locations (lines 185, 193, 333, 334, 335, 352, 513, 562, 565, 586, 590, 687, 800, 803). The browser `alert()` function:
1. Blocks the UI thread entirely until dismissed
2. Cannot be styled
3. Cannot be dismissed programmatically
4. Fails completely in non-browser environments (SSR)
5. Is not accessible (no ARIA role management)

Specific occurrences:
- Line 185: `alert("Backend offline")`
- Line 193: `alert("Failed to move task")`
- Line 333: `alert("Cannot add dependency: This would create a circular reference")`
- Line 334: `alert("A task cannot block itself")`
- Line 335: `alert(...)`
- Line 352: `alert(...)`
- Line 513: `alert("Failed to update epic")`
- Line 562: `alert("Failed to remove assignee")`
- Line 586: `alert("Agent already assigned")`
- Line 590: `alert("Failed to add assignee")`
- Line 687: `alert("Failed to post comment")`
- Line 800: `alert("Failed to delete comment")`

**Changes Required:**

1. Install or use the existing toast library. Check if `sonner`, `react-hot-toast`, or a custom toast implementation already exists in the codebase.

2. Create a `useToast` hook in `src/hooks/useToast.ts`:

```typescript
// src/hooks/useToast.ts
import { useState, useCallback } from "react";

export type ToastVariant = "error" | "success" | "warning" | "info";

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, variant: ToastVariant = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return { toasts, toast };
}
```

3. Replace every `alert(...)` call with `toast(...)` using the appropriate variant:
   - `"Backend offline"` → `toast("Backend offline — changes may not save", "warning")`
   - `"Failed to move task"` → `toast("Failed to move task", "error")`
   - `"Cannot add dependency..."` → `toast("Cannot add: circular dependency detected", "warning")`

4. Add a `ToastContainer` component at the bottom of `DraggableTaskBoard` to render the toasts.

**Frontend Components to Validate:**
- `DraggableTaskBoard.tsx` — all user interaction paths
- `TaskDetailModal` — dependency management, assignee management, epic selection
- `TaskComments` — comment post and delete flows

**Tests Required:**
- Unit test: `handleDrop` shows toast on failure instead of calling `alert`
- Unit test: `addBlocker` with circular dependency shows warning toast
- Verify no `alert` calls remain in component file

**Acceptance Criteria:**
- Zero `alert()` calls anywhere in `DraggableTaskBoard.tsx`
- All error conditions surface a non-blocking toast notification
- Toasts auto-dismiss after 4 seconds
- `npm run lint` passes

---

### GH-01: Fix GitHub commit JSON parsing

**File:** `/Users/arana/dev/ankit/mission-control/convex/github.ts` — `fetchGitHubCommits` action (lines 111–151)

**Problem:** Lines 144–145 attempt to parse the `gh` CLI output by joining newline-separated JSON objects with commas and wrapping in `[]`:

```typescript
const commits = JSON.parse(`[${output.split("\n").filter((l: string) => l.trim()).join(",")}]`);
```

This is fragile. If any commit message contains a newline (which is normal for multi-line commit messages), `split("\n")` will split the JSON object across multiple elements, producing malformed JSON. The outer `try/catch` on line 147 swallows the parse error and returns `{ error: "Failed to fetch from GitHub API" }`, making debugging impossible.

**Changes Required:**

Replace the manual JSON construction with line-by-line JSON object parsing using `JSON.parse` per line:

```typescript
// github.ts — replace lines 144–148:
const output = result.stdout || "";
const commits: any[] = [];
const lines = output.split("\n").filter((l: string) => l.trim());

for (const line of lines) {
  try {
    const obj = JSON.parse(line);
    commits.push(obj);
  } catch (parseErr) {
    // Skip malformed lines — log for debugging but don't fail entire fetch
    console.error("Failed to parse commit line:", line.slice(0, 100));
  }
}

if (commits.length === 0 && lines.length > 0) {
  // All lines failed to parse — return specific error for debugging
  return { error: "GitHub API returned unexpected format", rawSample: lines[0]?.slice(0, 200) };
}

return { commits, source: "github" };
```

**Tests Required:**
- Unit test: `extractTicketIds` correctly parses multi-line commit messages (pure function, already testable without Convex)
- Unit test: JSON parsing logic handles newlines in commit messages

**Acceptance Criteria:**
- Commits with multi-line messages parse correctly
- Failed parse lines are logged but do not fail the entire request
- Specific error message returned when all lines fail to parse

---

### GH-02: Add commit result caching

**File:** `/Users/arana/dev/ankit/mission-control/convex/github.ts`

**Problem:** `getCommitsForTask` (line 171) runs `git log` or `gh api` on every call with no caching. Since commit history is queried each time a user opens a task modal (via the `useEffect` in `TaskCommits`, line 891), and git log on a large repository is expensive (1–3 seconds), this creates unnecessary latency.

**Changes Required:**

Add a simple in-memory cache to `fetchLocalCommitsInternal` using a module-level `Map`:

```typescript
// github.ts — add before fetchLocalCommitsInternal (line 29):
const commitCache = new Map<string, { commits: any[]; fetchedAt: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

async function fetchLocalCommitsInternal(
  repoPath: string,
  limit: number
): Promise<any[]> {
  const cacheKey = `${repoPath}:${limit}`;
  const cached = commitCache.get(cacheKey);

  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.commits;
  }

  // ... existing spawnSync logic ...

  const commits = /* parsed result */;
  commitCache.set(cacheKey, { commits, fetchedAt: Date.now() });
  return commits;
}
```

**Note:** This is a module-level cache. Since Convex actions run in a serverless context, the cache lifetime is bounded by the action process lifetime, not a long-running server. This is acceptable as a short-term optimization. A more durable solution would use the `settings` table as a cache store, but that requires schema changes outside the scope of this phase.

**Acceptance Criteria:**
- Second call to `getCommitsForTask` within 60 seconds skips the `git log` subprocess
- Cache is invalidated when TTL expires
- `npm test` passes (mock the subprocess in tests)

---

### GH-03: Add rate limiting and async spawn

**File:** `/Users/arana/dev/ankit/mission-control/convex/github.ts` — `fetchGitHubCommits` (line 111)

**Problem:** `fetchGitHubCommits` uses `spawnSync` (line 135), which is synchronous and blocks the event loop entirely until the `gh` CLI completes. In a Convex action, this is acceptable since actions run outside the reactive query engine, but it means if the `gh` CLI hangs (network timeout, auth failure), the action will hang indefinitely with no timeout enforcement.

Additionally, there is no rate limiting: if multiple clients request GitHub commits simultaneously, each spawns a separate `gh` CLI process.

**Changes Required:**

1. Replace `spawnSync` with `spawnAsync` using Node's `child_process.spawn` wrapped in a Promise with a timeout:

```typescript
// github.ts — add utility function:
async function spawnWithTimeout(
  cmd: string,
  args: string[],
  options: { cwd?: string; timeout?: number; encoding?: string }
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  const { timeout = 10000, ...spawnOptions } = options;

  return new Promise((resolve, reject) => {
    const proc = require("child_process").spawn(cmd, args, {
      ...spawnOptions,
      encoding: "utf-8",
    });

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (d: Buffer) => { stdout += d.toString(); });
    proc.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error(`Command timed out after ${timeout}ms: ${cmd} ${args.join(" ")}`));
    }, timeout);

    proc.on("close", (code: number | null) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code });
    });

    proc.on("error", (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
```

2. Add a simple concurrency guard using a module-level flag to prevent multiple simultaneous GitHub API calls:

```typescript
let githubFetchInFlight = false;

// In fetchGitHubCommits handler:
if (githubFetchInFlight) {
  return { error: "GitHub fetch already in progress — try again shortly" };
}
githubFetchInFlight = true;
try {
  // ... fetch logic ...
} finally {
  githubFetchInFlight = false;
}
```

**Acceptance Criteria:**
- GitHub fetch times out after 10 seconds with a descriptive error
- Concurrent GitHub fetch returns a graceful error instead of spawning a second process
- Existing tests pass

---

## 5. Phase 3 — Analytics and Observability (Week 4)

**Objective:** Expose the critical path algorithm to the frontend, refactor high-volume `@all` messaging to background processing, add missing database indexes, and build a performance monitoring view. Estimated Complexity: Medium.

---

### CP-01: Expose critical path to frontend

**File:** `/Users/arana/dev/ankit/mission-control/convex/utils/graphValidation.ts` — `getCriticalPath` (lines 160–194)

**Problem:** The `getCriticalPath` function exists and is tested but is only accessible as an internal TypeScript utility. No Convex query exposes it, so the frontend cannot display the critical path chain. The `BottleneckVisualizer.tsx` component exists but has no data source for critical path data.

**Changes Required:**

Add a new query to `convex/tasks.ts`:

```typescript
// convex/tasks.ts — add after removeDependency:
export const getCriticalPath = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const { getCriticalPath: computePath } = await import(
      "./utils/graphValidation"
    );
    const path = await computePath(ctx, taskId);

    // Enrich with task details
    const enriched = await Promise.all(
      path.map(async (id) => {
        const task = await ctx.db.get(id);
        return task ? {
          id: task._id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          assigneeIds: task.assigneeIds,
        } : null;
      })
    );

    return enriched.filter(Boolean);
  },
});
```

Also add an aggregate query for the "most-blocking" tasks:

```typescript
export const getBottlenecks = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 10 }) => {
    const tasks = await ctx.db.query("tasks")
      .withIndex("by_status", (q) => q.eq("status", "blocked"))
      .take(200);

    // Sort by number of dependent tasks (blockedBy array length)
    const withBlockCount = tasks.map((t) => ({
      ...t,
      blockCount: t.blocks?.length ?? 0,
    }));

    return withBlockCount
      .sort((a, b) => b.blockCount - a.blockCount)
      .slice(0, limit);
  },
});
```

**Frontend Components to Validate:**
- `/Users/arana/dev/ankit/mission-control/src/components/BottleneckVisualizer.tsx`

**Tests Required:**
- Unit test for `getCriticalPath` query with mock data (extend existing `graphValidation.test.ts`)
- Unit test for `getBottlenecks` query

**Acceptance Criteria:**
- `BottleneckVisualizer` renders a list of tasks sorted by blocking impact
- Clicking a task in the visualizer shows its full critical path

---

### MSG-01: Refactor @all messaging to background processing

**File:** `/Users/arana/dev/ankit/mission-control/convex/messages.ts` — `create` mutation (lines 66–111)

**Problem:** The `@all` mention handler (lines 66–99) runs a full table scan of all agents (`ctx.db.query("agents").collect()`) inside a mutation, then inserts one notification per agent in a loop. With 10 agents this works, but the pattern does not scale. More importantly, this all runs synchronously within the mutation, which increases mutation latency proportionally to agent count and blocks other reactive updates.

**Changes Required:**

Move the `@all` broadcast to an internal action dispatched as a background job:

```typescript
// convex/messages.ts — replace the mentionAll block (lines 66–111):
if (mentionAll) {
  // Schedule background notification fan-out instead of inline
  // This keeps mutation fast; agents are notified asynchronously
  await ctx.scheduler.runAfter(0, api.messages.broadcastMentionAll, {
    messageId,
    taskId,
    taskTitle: task.title,
    senderId,
    senderName,
    content,
  });
}
```

Add the background action:

```typescript
// convex/messages.ts — add new internal action:
export const broadcastMentionAll = internalAction({
  args: {
    messageId: v.id("messages"),
    taskId: v.id("tasks"),
    taskTitle: v.string(),
    senderId: v.string(),
    senderName: v.string(),
    content: v.string(),
  },
  handler: async (ctx, { messageId, taskId, taskTitle, senderId, senderName, content }) => {
    const agents = await ctx.runQuery(api.agents.getAll, {});

    for (const agent of agents) {
      if (agent._id === senderId || agent.name === senderName) continue;

      await ctx.runMutation(api.notifications.create, {
        recipientId: agent._id,
        type: "mention",
        content: `@all: ${senderName} posted in "${taskTitle}": ${content.substring(0, 100)}`,
        fromId: senderId,
        fromName: senderName,
        taskId,
        taskTitle,
        messageId,
      });
    }

    // Log the @all activity
    await ctx.runMutation(api.activities.create, {
      type: "mention",
      agentId: senderId,
      agentName: senderName,
      message: `${senderName} mentioned @all in "${taskTitle}"`,
      taskId,
      taskTitle,
    });
  },
});
```

**Mutations Affected:** `messages.create`

**Tests Required:**
- Unit test: `create` with `mentionAll: true` schedules background action, does NOT insert notifications inline
- Unit test: `broadcastMentionAll` inserts one notification per agent (excluding sender)

**Acceptance Criteria:**
- `messages.create` latency is unchanged when `mentionAll: true`
- All agents receive notifications within Convex scheduler latency (~1 second)
- No `agents.collect()` call inside a mutation path

---

### IDX-01: Add missing indexes for common query patterns

**File:** `/Users/arana/dev/ankit/mission-control/convex/schema.ts`

**Problem:** Several queries use `.filter()` on full table scans because indexed lookup is not available for their access pattern:

1. `epics.getWithDetails` (epics.ts line 24) uses `.filter(q.eq(q.field("epicId"), epicId))` on the tasks table — this scans all tasks. The `by_epic` index already exists on `tasks` (schema line 145) but the query uses filter instead of withIndex.

2. `messages.getWithMentions` (messages.ts line 215) scans 200 messages to find mentions — there is no index on `mentions`.

3. `threadSubscriptions` filter on `taskId` (tasks.ts line 1001) uses `.filter(q.eq(q.field("taskId"), taskId))` instead of `.withIndex("by_task", ...)` — the index exists but is not used.

**Changes Required:**

Fix the query patterns to use existing indexes:

```typescript
// epics.ts line 24 — replace filter with withIndex:
const tasks = await ctx.db
  .query("tasks")
  .withIndex("by_epic", (q) => q.eq("epicId", epicId))
  .collect();

// tasks.ts line 999–1002 — replace filter with withIndex:
const subscriptions = await ctx.db
  .query("threadSubscriptions")
  .withIndex("by_task", (q) => q.eq("taskId", taskId))
  .collect();
```

For `getWithMentions` — since Convex does not support array-contains indexes, the most efficient approach is to query by task then filter:

```typescript
// messages.ts line 215 — add limit and use index where possible:
export const getWithMentions = query({
  args: { agentId: v.id("agents"), limit: v.optional(v.number()) },
  handler: async (ctx, { agentId, limit }) => {
    // Scan most recent messages only (bounded)
    const recentMessages = await ctx.db
      .query("messages")
      .withIndex("by_created_at")
      .order("desc")
      .take(500);

    return recentMessages
      .filter((msg) => msg.mentions.includes(agentId))
      .slice(0, limit || 20);
  },
});
```

**Tests Required:**
- Verify `getWithDetails` for epics uses `by_epic` index (query explain check)
- Verify threadSubscriptions query in `remove` uses `by_task` index

**Acceptance Criteria:**
- No full table scan in `epics.getWithDetails`
- `getWithMentions` bounded to 500 recent messages scan

---

### OBS-01: Performance monitoring dashboard data

**File:** New file `/Users/arana/dev/ankit/mission-control/convex/analytics.ts`

**Problem:** There is no observability into system performance. Specifically:
- No query to measure average task completion time
- No query to track which agents are overloaded vs. underloaded
- No query to count blocked tasks by blocker age (how long has each task been blocked?)
- The `agentMetrics` table in the schema (lines 319–341) is defined but no mutations ever write to it

**Changes Required:**

Create `convex/analytics.ts` with computed analytics queries:

```typescript
// convex/analytics.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

// Average task completion time per agent
export const getAgentCompletionStats = query({
  handler: async (ctx) => {
    const completedTasks = await ctx.db
      .query("tasks")
      .withIndex("by_status", (q) => q.eq("status", "done"))
      .take(500);

    const statsByAgent: Record<string, {
      count: number;
      totalHours: number;
      tasks: string[];
    }> = {};

    for (const task of completedTasks) {
      if (!task.startedAt || !task.completedAt) continue;
      const durationHours = (task.completedAt - task.startedAt) / 3600000;

      for (const agentId of task.assigneeIds) {
        if (!statsByAgent[agentId]) {
          statsByAgent[agentId] = { count: 0, totalHours: 0, tasks: [] };
        }
        statsByAgent[agentId].count++;
        statsByAgent[agentId].totalHours += durationHours;
        statsByAgent[agentId].tasks.push(task._id);
      }
    }

    return Object.entries(statsByAgent).map(([agentId, stats]) => ({
      agentId,
      tasksCompleted: stats.count,
      avgHours: stats.count > 0 ? stats.totalHours / stats.count : 0,
    }));
  },
});

// Blocked task aging report
export const getBlockedTaskAging = query({
  handler: async (ctx) => {
    const blockedTasks = await ctx.db
      .query("tasks")
      .withIndex("by_status", (q) => q.eq("status", "blocked"))
      .take(200);

    const now = Date.now();
    return blockedTasks.map((task) => ({
      id: task._id,
      title: task.title,
      priority: task.priority,
      blockedByCount: task.blockedBy.length,
      ageHours: (now - task.updatedAt) / 3600000,
      assigneeIds: task.assigneeIds,
    })).sort((a, b) => b.ageHours - a.ageHours);
  },
});

// Agent workload distribution
export const getWorkloadDistribution = query({
  handler: async (ctx) => {
    const [agents, activeTasks] = await Promise.all([
      ctx.db.query("agents").collect(),
      ctx.db.query("tasks")
        .withIndex("by_status", (q) => q.eq("status", "in_progress"))
        .take(500),
    ]);

    const tasksByAgent = new Map<string, number>();
    for (const agent of agents) tasksByAgent.set(agent._id, 0);

    for (const task of activeTasks) {
      for (const id of task.assigneeIds) {
        tasksByAgent.set(id, (tasksByAgent.get(id) ?? 0) + 1);
      }
    }

    return agents.map((agent) => ({
      agentId: agent._id,
      name: agent.name,
      role: agent.role,
      activeTasks: tasksByAgent.get(agent._id) ?? 0,
      status: agent.status,
    }));
  },
});
```

**Frontend Components to Validate:**
- `/Users/arana/dev/ankit/mission-control/src/components/AnalyticsDashboard.tsx`
- `/Users/arana/dev/ankit/mission-control/src/components/AgentWorkload.tsx`

**Tests Required:**
- Unit test for `getAgentCompletionStats` with mock completed tasks
- Unit test for `getBlockedTaskAging` with tasks at various ages

**Acceptance Criteria:**
- `AnalyticsDashboard` displays completion time averages per agent
- Blocked tasks appear sorted by age (oldest first)
- Workload distribution is visible per agent

---

## 6. Testing Strategy

### 6.1 Per-Phase Test Requirements

Each phase must reach green before the next phase begins.

**Phase 0 tests (all required before merging):**

| Test | File | Type |
|------|------|------|
| VAL-01: Convex ID validation | `lib/validators/__tests__/taskValidators.test.ts` | Unit |
| SEC-01: Permission helper coverage | `lib/auth/__tests__/permissions.test.ts` | Unit |
| FE-01: Hooks render without crash | `src/components/__tests__/DraggableTaskBoard.test.tsx` | Render |
| LOG-01: Activity name resolution | `convex/utils/__tests__/activityLogger.test.ts` | Unit |
| DM-01: Subtask ID cleanup on delete | `convex/__tests__/tasks.test.ts` | Integration |
| DM-02: Epic sync helper | `convex/utils/__tests__/epicTaskSync.test.ts` | Unit |
| TM-01: State transition guard | `lib/constants/__tests__/taskTransitions.test.ts` | Unit |
| AA-01: Shared roleKeywords | `convex/utils/__tests__/roleKeywords.test.ts` | Unit |

**Phase 1 tests (all required before merging):**

| Test | File | Type |
|------|------|------|
| TM-02: Auto-block on dependency add | `convex/__tests__/tasks.test.ts` | Integration |
| TM-03: Auto-unblock on dependency remove | `convex/__tests__/tasks.test.ts` | Integration |
| DM-03: Pagination boundary | `convex/__tests__/tasks.test.ts` | Unit |
| DM-04: TTL cleanup | `convex/__tests__/wake.test.ts` | Integration |
| AA-02: Workload penalty scoring | `convex/__tests__/tasks.test.ts` | Unit |
| FE-02: Live task subscription | `src/components/__tests__/DraggableTaskBoard.test.tsx` | Render |
| MIG-01: Batch caps | `convex/__tests__/migrations.test.ts` | Integration |

**Phase 2 tests (all required before merging):**

| Test | File | Type |
|------|------|------|
| FE-03: Zero alert() calls | `src/components/__tests__/DraggableTaskBoard.test.tsx` | Lint + Render |
| GH-01: Multi-line commit parse | `convex/__tests__/github.test.ts` | Unit |
| GH-02: Cache behavior | `convex/__tests__/github.test.ts` | Unit |
| GH-03: Timeout enforcement | `convex/__tests__/github.test.ts` | Unit |

**Phase 3 tests (all required before merging):**

| Test | File | Type |
|------|------|------|
| CP-01: getCriticalPath query | `convex/__tests__/tasks.test.ts` | Unit |
| MSG-01: @all background dispatch | `convex/__tests__/messages.test.ts` | Integration |
| IDX-01: Index usage verification | Manual query explain | Manual |
| OBS-01: Analytics queries | `convex/__tests__/analytics.test.ts` | Unit |

### 6.2 Regression Testing

The existing 3 test files cover:
- `graphValidation.test.ts`: 22 tests for cycle detection, transitive deps, critical path
- `taskValidators.test.ts`: ~40 tests for all Zod schemas
- `apiResponse.test.ts`: utility response helpers

All 65+ existing tests must continue to pass after every phase. Run the full suite before and after each phase merge:

```bash
npm test -- --coverage
```

The coverage threshold (50% lines, branches, functions, statements) must be maintained or improved.

### 6.3 Manual Validation Checklist (per CLAUDE.md Section 3)

For each phase, manually validate by running both `npm run convex:dev` and `npm run dev`:

**Phase 0:**
- [ ] Create a task — verify it appears in the Kanban board
- [ ] Delete a subtask — verify parent's subtask count decreases
- [ ] Attempt invalid state transition via drag-and-drop — verify error
- [ ] Check activity feed — verify agent names (not IDs) appear
- [ ] Smart assign a task — verify no duplicate keyword definitions

**Phase 1:**
- [ ] Add dependency to in-progress task — verify task moves to Blocked column
- [ ] Remove last dependency from blocked task — verify task moves to Ready column
- [ ] Verify notifications appear for unblocked assignees
- [ ] Run wake cleanup — verify stale requests removed

**Phase 2:**
- [ ] Move task to invalid column (manually trigger) — verify toast appears, no `alert()`
- [ ] Open TaskDetailModal while another session updates the task — verify modal shows updated data
- [ ] Add commit with multi-line message — verify GitHub section parses correctly

**Phase 3:**
- [ ] Open AnalyticsDashboard — verify workload distribution renders
- [ ] Post @all comment — verify notification arrives asynchronously, comment post returns immediately
- [ ] View BottleneckVisualizer — verify blocked tasks sorted by impact

---

## 7. Migration Strategy

### 7.1 Schema Changes

Phase 0–2 require NO schema changes. All modifications are to query/mutation logic and frontend components.

Phase 3 (OBS-01) adds new mutations that write to the existing `agentMetrics` table (already defined in schema). No `defineTable` change needed, so no schema migration is required.

### 7.2 Data Migrations

**DM-01 and DM-02 introduce a correctness issue for existing data.** Existing tasks may have:
- Dangling IDs in parent `subtaskIds` arrays (if tasks were deleted without the fix)
- Duplicate IDs in epic `taskIds` arrays (if tasks were reassigned multiple times)

Run the following one-time data repair mutations after deploying Phase 0:

```typescript
// One-time repair: remove dangling subtaskIds
// convex/migrations.ts — add:
export const repairSubtaskIds = mutation({
  args: { batchSize: v.optional(v.number()) },
  handler: async (ctx, { batchSize = 50 }) => {
    const tasks = await ctx.db.query("tasks")
      .filter((q) => q.gt(q.field("subtaskIds").length, 0))
      .take(batchSize);

    let repaired = 0;
    for (const task of tasks) {
      const validIds = (await Promise.all(
        task.subtaskIds.map((id) => ctx.db.get(id))
      )).map((t, i) => t ? task.subtaskIds[i] : null)
        .filter(Boolean);

      if (validIds.length !== task.subtaskIds.length) {
        await ctx.db.patch(task._id, {
          subtaskIds: validIds as any,
          updatedAt: Date.now(),
        });
        repaired++;
      }
    }

    return { repaired, checked: tasks.length };
  },
});
```

```typescript
// One-time repair: deduplicate epic taskIds
// convex/migrations.ts — add:
export const repairEpicTaskIds = mutation({
  args: { batchSize: v.optional(v.number()) },
  handler: async (ctx, { batchSize = 50 }) => {
    const epics = await ctx.db.query("epics").take(batchSize);
    let repaired = 0;

    for (const epic of epics) {
      const deduplicated = [...new Set(epic.taskIds)];
      if (deduplicated.length !== epic.taskIds.length) {
        await ctx.db.patch(epic._id, {
          taskIds: deduplicated,
          updatedAt: Date.now(),
        });
        repaired++;
      }
    }

    return { repaired, checked: epics.length };
  },
});
```

### 7.3 Backward Compatibility

**DM-03 (getAll pagination):** The return type changes from `Task[]` to `{ tasks: Task[]; hasMore: boolean; nextCursor: number | null }`. All callers of `api.tasks.getAll` must be updated in the same PR. Since this is an internal application with no external API consumers, no backward compatibility period is needed.

**VAL-01 (validator format):** The existing test fixtures use UUID format. Updating the validators changes what is accepted, but does not break existing database records (Convex IDs were never validated against UUIDs in production — the validators only threw when called from the `createTask`/`update` mutations, and only when called with UUID-format IDs).

### 7.4 Rollback Procedure

Since there are no schema migrations in Phases 0–2:
1. Revert the Convex deployment to the previous version using `convex deploy --version <previous>`
2. Revert the Next.js frontend deployment
3. No data repair is needed (no destructive schema changes)

For Phase 3 if `agentMetrics` writes are added:
1. Roll back the Convex deployment
2. Any written `agentMetrics` records are inert (the table already exists in schema)
3. No data loss occurs

---

## 8. Success Metrics

### P0 Resolution Metrics (Phase 0)

| Metric | Target | Measurement |
|--------|--------|-------------|
| P0 issues resolved | 8/8 | Issue registry all closed |
| Validator rejection of Convex IDs | 0 false rejections | Run test suite |
| React hook rule violations | 0 | `npm run lint` with `react-hooks/rules-of-hooks` |
| Dangling subtaskIds after deletion | 0 | Run repair mutation, check `repaired` count |
| Duplicate epic taskIds | 0 | Run repair mutation, check `repaired` count |

### Data Integrity Metrics (Phase 1)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Tasks with active blockers not in `blocked` status | 0 | Query tasks where `blockedBy.length > 0 AND status != "blocked" AND status != "done"` |
| Tasks with no blockers stuck in `blocked` status | 0 | Query tasks where `blockedBy.length == 0 AND status == "blocked"` |
| stale wakeRequests (>7 days old) | 0 | Query `wakeRequests` by `createdAt < cutoff` |
| Max tasks per agent ratio to mean | < 3x | Compute from `getWorkloadDistribution` |

### Error Rate Metrics (Phase 2)

| Metric | Target | Measurement |
|--------|--------|-------------|
| `alert()` calls in codebase | 0 | `grep -r "alert(" src/` returns 0 results |
| GitHub commit parse failures on valid output | 0 | Unit tests |
| Unhandled error rate in task operations | Reduce by 80% | Browser error monitoring |

### Performance Metrics (Phase 3)

| Metric | Target | Measurement |
|--------|--------|-------------|
| N+1 queries eliminated | 5 | Code review of changed files |
| `@all` message mutation latency | No change | Convex dashboard |
| `getAll` tasks query response time | Under 200ms | Convex dashboard |
| Blocked task average age | Visible and tracked | `getBlockedTaskAging` output |

### Coverage Metric (All Phases)

| Metric | Target |
|--------|--------|
| `npm test` pass rate | 100% (no regression) |
| Line coverage | 50%+ maintained |
| New code line coverage | 80%+ for all new functions |

---

## 9. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| VAL-01 fix breaks existing tests | High | Medium | Update test fixtures in same PR as validator fix |
| TM-01 state guards break Kanban drag-drop | Medium | High | Add frontend guard to disallow dragging to `done` column before backend merge |
| DM-03 pagination breaks dashboard queries | Medium | High | Deploy backend change and frontend change atomically in same PR |
| MSG-01 background dispatch requires `ctx.scheduler` | Medium | Medium | Verify Convex plan supports scheduled functions before starting Phase 3 |
| GH-03 async spawn breaks existing tests that mock `spawnSync` | Medium | Low | Update test mocks to mock async version |
| FE-02 live query causes modal flicker on open | Low | Low | Add loading state guard: show modal only after `liveTask` resolves |
| MIG-01 batch caps leave migrations incomplete silently | Low | Medium | Return `remaining` count in response; document that caller must loop until `remaining === 0` |
| AA-02 workload penalty makes assignment non-deterministic for tests | Medium | Medium | Inject workload counts as test parameters; freeze task counts in test setup |

---

## Implementation Checklist

### Phase 0 — Week 1

- [ ] VAL-01: Replace `z.string().uuid()` with `convexId()` helper in 9 locations
- [ ] VAL-01: Update test fixtures from UUID to Convex ID format
- [ ] SEC-01: Create `lib/auth/permissions.ts` with `canDeleteTask`, `isAuthorizedActor`
- [ ] SEC-01: Apply permission check to `tasks.remove`, `epics.remove`, `migrations.deleteEpic`
- [ ] FE-01: Add `useCallback` to React imports in `DraggableTaskBoard.tsx` line 3
- [ ] FE-01: Move `useMutation` calls out of `try/catch` in `TaskDetailModal` (lines 304–307)
- [ ] FE-01: Move `useMutation` calls out of `try/catch` in `TaskComments` (lines 646–650)
- [ ] LOG-01: Create `convex/utils/activityLogger.ts` with `resolveActorName`
- [ ] LOG-01: Apply `resolveActorName` to all 8 activity insert call sites
- [ ] DM-01: Add parent subtaskId cleanup to `tasks.remove` (after line 975)
- [ ] DM-01: Add parent subtaskId cleanup to `migrations.deleteTask` (after line 444)
- [ ] DM-02: Create `convex/utils/epicTaskSync.ts` with `syncEpicTaskLink`
- [ ] DM-02: Replace 5 inline epic-task sync implementations
- [ ] TM-01: Create `lib/constants/taskTransitions.ts` with transition map
- [ ] TM-01: Add transition guard to `tasks.moveStatus` (after line 174)
- [ ] TM-01: Add transition guard to `tasks.updateStatus` (after line 307)
- [ ] TM-01: Add transition guard to `tasks.update` (before patch call)
- [ ] AA-01: Create `convex/utils/roleKeywords.ts`
- [ ] AA-01: Replace inline `roleKeywords` in `smartAssign` (lines 650–661)
- [ ] AA-01: Replace inline `roleKeywords` in `findBestAgent` (lines 763–774)
- [ ] Run `npm test` — must pass 100%
- [ ] Run `npm run lint` — must pass
- [ ] Manual validation: all 5 Phase 0 checklist items

### Phase 1 — Week 2

- [ ] TM-02: Add auto-block logic to `tasks.addDependency` (after line 1078)
- [ ] TM-03: Add auto-unblock logic to `tasks.removeDependency` (after line 1128)
- [ ] DM-03: Replace `tasks.getAll` with paginated version; update all callers
- [ ] DM-04: Add `wake.cleanupStale` mutation with batch cap
- [ ] DM-04: Add `expiresAt` to `wakeRequests` inserts in `requestWake`
- [ ] AA-02: Rewrite `findBestAgent` with workload penalty scoring
- [ ] AA-02: Import `ROLE_KEYWORDS` in updated `findBestAgent`
- [ ] FE-02: Add `useQuery(api.tasks.getById)` inside `TaskDetailModal`
- [ ] MIG-01: Add `batchSize` argument to `migrateTasksToEpic`, `smartAssignEpics`, `deleteEpic`
- [ ] Run repair mutations: `repairSubtaskIds`, `repairEpicTaskIds`
- [ ] Run `npm test` — must pass 100%
- [ ] Manual validation: all 4 Phase 1 checklist items

### Phase 2 — Week 3

- [ ] FE-03: Create `src/hooks/useToast.ts`
- [ ] FE-03: Replace all 12 `alert()` calls in `DraggableTaskBoard.tsx`
- [ ] FE-03: Add `ToastContainer` to component render
- [ ] GH-01: Replace JSON join-parse with line-by-line `JSON.parse` in `fetchGitHubCommits`
- [ ] GH-02: Add module-level commit cache with 60-second TTL
- [ ] GH-03: Create `spawnWithTimeout` utility; replace `spawnSync` in `fetchGitHubCommits`
- [ ] GH-03: Add concurrency guard for GitHub fetch
- [ ] Run `npm test` — must pass 100%
- [ ] Verify `grep -r "alert(" src/` returns 0 results
- [ ] Manual validation: all 3 Phase 2 checklist items

### Phase 3 — Week 4

- [ ] CP-01: Add `tasks.getCriticalPath` query to `convex/tasks.ts`
- [ ] CP-01: Add `tasks.getBottlenecks` query
- [ ] CP-01: Wire `BottleneckVisualizer` to new queries
- [ ] MSG-01: Add `broadcastMentionAll` internal action to `convex/messages.ts`
- [ ] MSG-01: Replace inline `@all` fan-out with `ctx.scheduler.runAfter` dispatch
- [ ] IDX-01: Fix `epics.getWithDetails` to use `by_epic` index
- [ ] IDX-01: Fix `tasks.remove` threadSubscriptions scan to use `by_task` index
- [ ] IDX-01: Fix `messages.getWithMentions` to use bounded recent-messages scan
- [ ] OBS-01: Create `convex/analytics.ts` with 3 queries
- [ ] OBS-01: Wire `AnalyticsDashboard` and `AgentWorkload` to new queries
- [ ] Run `npm test` — must pass 100%
- [ ] Manual validation: all 4 Phase 3 checklist items

---

*Plan authored: 2026-02-17. All file references use absolute paths. All line numbers verified against current codebase state.*
