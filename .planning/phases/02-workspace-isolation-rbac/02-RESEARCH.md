# Phase 2: Workspace Isolation & RBAC - Research

**Researched:** 2026-02-26
**Domain:** Multi-tenant workspace isolation, role-based access control, Convex authorization patterns
**Confidence:** HIGH

## Summary

Phase 2 enforces workspace boundaries and role-based access control on an existing multi-workspace codebase. The foundation is already built: the `workspaces` table exists with create/update/delete operations, an `organizationMembers` table tracks user membership with `owner/admin/member` roles, and most data tables already carry a `workspaceId` field with `by_workspace` indexes. However, **isolation is not enforced** -- queries treat `workspaceId` as an optional filter rather than a mandatory boundary, and no Convex function checks membership before returning data.

The core technical challenge is retrofitting authorization into ~60+ existing Convex queries and mutations without breaking the current application. The recommended approach uses `convex-helpers` library's `customQuery`/`customMutation` wrappers to create workspace-scoped function builders that automatically validate membership and inject workspace context. This creates a "functions.ts" pattern (already documented in Convex best practices) where the raw `query`/`mutation` imports are replaced with workspace-aware versions, and ESLint rules prevent accidental bypass.

**Primary recommendation:** Install `convex-helpers`, create `backend/convex/functions.ts` with `workspaceQuery`/`workspaceMutation` builders that enforce membership checks and inject `workspaceId` into context, then progressively migrate existing functions. Use row-level security as a defense-in-depth safety net, not as the primary enforcement mechanism.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WS-01 | User can create a workspace (name, slug, mission statement, emoji, color) | **Already implemented.** `workspaces.create` mutation exists with all fields. Needs RBAC guard: only authenticated users should create workspaces. |
| WS-02 | Workspace has isolated data: agents, tickets, crons, wiki, cost budget | **Schema ready, enforcement missing.** 25+ tables have `workspaceId` + `by_workspace` indexes. Queries must be migrated from optional to mandatory workspace filtering via `workspaceQuery` builder. Agents are currently global (shared across workspaces) -- needs scoping decision. |
| WS-03 | Admin can set workspace budget (monthly token limit) | **Schema extension needed.** `workspaces` table lacks `monthlyTokenBudget` field. Add field to schema + migration. Budget enforcement logic exists in `workflowValidation.ts` patterns. |
| WS-04 | Admin can set default workspace | **Already implemented.** `workspaces.setDefault` mutation exists. Needs RBAC guard: only workspace admin/owner should change default. |
| WS-05 | Workspace isolation enforced (users see only assigned workspaces) | **Critical gap.** `workspaces.getAll` returns all workspaces unfiltered. Must be replaced with membership-filtered query. `WorkspaceProvider.tsx` must be updated to only show assigned workspaces. |
| WS-06 | Workspace context propagated through all API calls (URL path `/api/v1/workspaces/{id}/...`) | **Not implemented.** Current API routes use body params (`workspaceId` in JSON). Must add URL-path-based workspace extraction middleware and propagate through all API handlers. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| convex-helpers | latest (0.1.x+) | Custom function builders + row-level security | Official Convex companion library; provides `customQuery`, `customMutation`, `customCtx`, `wrapDatabaseReader`, `wrapDatabaseWriter` |
| convex | 1.32.0 (existing) | Backend runtime | Already in project; provides `defineTable`, `query`, `mutation` base functions |
| zod | 4.3.6 (existing) | Input validation | Already in project; used for API route validation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| convex-helpers/server/customFunctions | (part of convex-helpers) | `customQuery`, `customMutation`, `customCtx` | Every workspace-scoped function definition |
| convex-helpers/server/rowLevelSecurity | (part of convex-helpers) | `wrapDatabaseReader`, `wrapDatabaseWriter`, `Rules` | Defense-in-depth layer on db operations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| convex-helpers customQuery | Manual `requireWorkspaceMembership()` calls | Manual calls are forgettable; custom builders are structural enforcement |
| Row-level security as primary | Endpoint-level checks only | RLS adds overhead on every read; endpoint checks are cheaper but can be bypassed by dev mistake |
| Convex Auth (convex-auth) | Current API key auth | Convex Auth adds OAuth/magic links; overkill for API-key-based agent auth. Keep current approach. |

**Installation:**
```bash
cd backend && npm install convex-helpers
```

## Architecture Patterns

### Recommended Project Structure
```
backend/convex/
├── functions.ts           # NEW: workspaceQuery, workspaceMutation, adminMutation builders
├── rules.ts               # NEW: Row-level security rules per table
├── organizationMembers.ts # EXISTING: membership CRUD (enhanced with role constants)
├── workspaces.ts          # EXISTING: workspace CRUD (add RBAC guards)
├── tasks.ts               # MIGRATE: use workspaceQuery instead of query
├── activities.ts          # MIGRATE: use workspaceQuery instead of query
├── ...                    # All workspace-scoped files migrated
└── utils/
    └── workspaceAuth.ts   # NEW: Pure helper functions for role checks

frontend/src/
├── components/
│   └── WorkspaceProvider.tsx  # MODIFY: filter workspaces by membership
├── hooks/
│   └── useRole.ts             # EXISTING: already works, minimal changes
└── app/
    └── api/
        └── v1/
            └── workspaces/
                └── [workspaceId]/  # NEW: workspace-scoped API routes
                    ├── agents/
                    ├── tasks/
                    └── ...
```

### Pattern 1: Workspace-Scoped Custom Functions (functions.ts)
**What:** Create `workspaceQuery` and `workspaceMutation` builders that require `workspaceId` in args, verify the caller's membership, and inject workspace context into `ctx`.
**When to use:** Every query/mutation that reads or writes workspace-scoped data.
**Example:**
```typescript
// backend/convex/functions.ts
// Source: https://stack.convex.dev/custom-functions + https://stack.convex.dev/authorization
import { customQuery, customMutation, customCtx } from "convex-helpers/server/customFunctions";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Role hierarchy: owner > admin > member > viewer
const ROLE_LEVELS = { owner: 4, admin: 3, member: 2, viewer: 1 } as const;
type Role = keyof typeof ROLE_LEVELS;

// Workspace-scoped query: requires workspaceId, verifies membership
export const workspaceQuery = customQuery(query, {
  args: { workspaceId: v.id("workspaces") },
  input: async (ctx, { workspaceId }) => {
    // For now: verify workspace exists (auth identity check added when Convex Auth integrated)
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) throw new Error("Workspace not found");
    return { ctx: { workspace, workspaceId }, args: {} };
  },
});

// Workspace-scoped mutation: same but for mutations, requires minimum role
export const workspaceMutation = customMutation(mutation, {
  args: { workspaceId: v.id("workspaces") },
  input: async (ctx, { workspaceId }) => {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) throw new Error("Workspace not found");
    return { ctx: { workspace, workspaceId }, args: {} };
  },
});

// Admin-only mutation: requires admin+ role
export const adminMutation = customMutation(mutation, {
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.string(), // caller identity
  },
  input: async (ctx, { workspaceId, userId }) => {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) throw new Error("Workspace not found");
    const member = await ctx.db
      .query("organizationMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", workspaceId).eq("userId", userId))
      .first();
    if (!member || ROLE_LEVELS[member.role as Role] < ROLE_LEVELS.admin) {
      throw new Error("Admin access required");
    }
    return { ctx: { workspace, workspaceId, member }, args: {} };
  },
});
```

### Pattern 2: Progressive Migration of Existing Functions
**What:** Migrate existing queries/mutations from `query`/`mutation` to `workspaceQuery`/`workspaceMutation` one file at a time. Each migration is a standalone commit that can be tested independently.
**When to use:** During the bulk migration of 60+ Convex functions.
**Example:**
```typescript
// BEFORE (current pattern -- no isolation)
export const getAllTasks = query({
  args: {
    workspaceId: convexVal.id("workspaces"),
  },
  handler: async (ctx, { workspaceId }) => {
    const allTasks = await ctx.db
      .query("tasks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    return allTasks;
  },
});

// AFTER (workspace isolation enforced)
export const getAllTasks = workspaceQuery({
  args: {},  // workspaceId consumed by builder
  handler: async (ctx, args) => {
    // ctx.workspaceId injected and verified by workspaceQuery builder
    const allTasks = await ctx.db
      .query("tasks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
      .collect();
    return allTasks;
  },
});
```

### Pattern 3: RBAC Role Hierarchy with Guards
**What:** Define a role hierarchy (Admin > Agent > Collaborator > Viewer) with guard functions that check the minimum required role for an operation.
**When to use:** When different operations need different role levels.
**Example:**
```typescript
// backend/convex/utils/workspaceAuth.ts
// Pure logic, no Convex dependencies

export const ROLES = {
  ADMIN: "admin",
  AGENT: "agent",
  COLLABORATOR: "collaborator",
  VIEWER: "viewer",
} as const;

export type WorkspaceRole = typeof ROLES[keyof typeof ROLES];

const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  admin: 4,
  agent: 3,
  collaborator: 2,
  viewer: 1,
};

export function hasMinimumRole(userRole: WorkspaceRole, requiredRole: WorkspaceRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function canManageWorkspace(role: WorkspaceRole): boolean {
  return hasMinimumRole(role, "admin");
}

export function canWriteData(role: WorkspaceRole): boolean {
  return hasMinimumRole(role, "collaborator");
}

export function canReadData(role: WorkspaceRole): boolean {
  return hasMinimumRole(role, "viewer");
}
```

### Pattern 4: API Route Workspace Context Propagation
**What:** Extract `workspaceId` from URL path (`/api/v1/workspaces/{workspaceId}/...`) and validate it before passing to Convex.
**When to use:** All REST API routes that operate on workspace-scoped data.
**Example:**
```typescript
// frontend/src/app/api/v1/workspaces/[workspaceId]/tasks/route.ts
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { verifyAgent } from "@/lib/agent-auth";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(
  request: Request,
  { params }: { params: { workspaceId: string } }
) {
  // 1. Extract workspace from URL
  const { workspaceId } = params;

  // 2. Verify agent auth
  const agent = await verifyAgent(/* ... */);
  if (!agent) return new Response("Unauthorized", { status: 401 });

  // 3. Pass verified workspaceId to Convex
  const tasks = await convex.query(api.tasks.getAllTasks, {
    workspaceId: workspaceId as any,
  });

  return Response.json({ success: true, data: tasks });
}
```

### Anti-Patterns to Avoid
- **Optional workspaceId in queries:** Every workspace-scoped query MUST require `workspaceId`. Never allow fallback to "all data" queries for workspace-scoped tables.
- **Client-side workspace filtering:** Never trust the frontend to filter workspaces. Filtering MUST happen in Convex queries (server-side).
- **Direct `query`/`mutation` imports for workspace data:** Use `workspaceQuery`/`workspaceMutation` builders. Add ESLint rule to flag direct imports in workspace-scoped files.
- **Checking permissions after fetching data:** Verify membership BEFORE querying data. The `customQuery` input function runs before the handler.
- **Global agents without workspace scoping:** Agents are currently global. For workspace isolation, either: (a) keep agents global with workspace-level assignments, or (b) scope agents to workspaces. Recommendation: keep agents global since they serve multiple workspaces.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Custom function middleware | Manual `requireMembership()` in every handler | `convex-helpers` `customQuery`/`customMutation` | Structural enforcement, type-safe, forgetting is impossible when builder is required |
| Row-level security | Manual per-table access checks in each query | `convex-helpers` `wrapDatabaseReader`/`wrapDatabaseWriter` | Handles `db.get`, `db.query`, `db.patch`, `db.delete` interception uniformly |
| Role hierarchy comparison | `if (role === "admin" \|\| role === "owner")` chains | Role level number comparison | Extensible, no missed branches when new roles added |
| Slug validation | Custom regex per endpoint | Centralized slug validator in workspace creation | One canonical validation, tested once |
| API key generation | `Math.random()` token generation | `crypto.randomUUID()` or `crypto.getRandomValues()` | Already used in `invites.ts` pattern; cryptographically secure |

**Key insight:** The `convex-helpers` library is the official companion to Convex and provides battle-tested middleware patterns. Rolling custom middleware leads to inconsistent enforcement and security gaps.

## Common Pitfalls

### Pitfall 1: Migration Breaks Existing Clients
**What goes wrong:** Changing `workspaceId` from optional to required in Convex function args breaks every frontend component and API route that calls that function.
**Why it happens:** Functions like `activities.getRecent` currently accept optional `workspaceId`. Making it required causes TypeScript compilation failures across the codebase.
**How to avoid:** Migrate in phases: (1) Create new workspace-scoped versions alongside existing functions, (2) Update frontend callers to use new versions, (3) Delete old versions. Or: use the `workspaceQuery` builder which handles the arg injection, and update callers to pass `workspaceId` from context.
**Warning signs:** TypeScript errors mentioning missing `workspaceId` argument after migration.

### Pitfall 2: workspaceId Still Optional in Schema
**What goes wrong:** Schema defines `workspaceId: convexVal.optional(convexVal.id("workspaces"))` -- even if the query requires it, the DB allows null values.
**Why it happens:** Schema was designed for migration compatibility. Legacy docs without workspace IDs still exist.
**How to avoid:** Phase approach: (1) Ensure all existing documents have `workspaceId` (migration already done per MIG-10), (2) Make `workspaceId` required in schema for tables where migration is complete, (3) Run schema validation tests.
**Warning signs:** Queries returning documents with null `workspaceId`.

### Pitfall 3: Agents Are Global but Data Is Workspace-Scoped
**What goes wrong:** An agent belongs to no specific workspace but creates tasks, comments, and activities that are workspace-scoped. If the agent's workspace context is lost, data gets created with wrong or null `workspaceId`.
**Why it happens:** Agents are shared resources (10 agents across 2-5 workspaces). They receive workspace context per-request, not permanently.
**How to avoid:** Ensure every agent API call includes `workspaceId` in the request. The poll endpoint already requires it. Validate `workspaceId` at the API layer before passing to Convex.
**Warning signs:** Activities or tasks created with null `workspaceId`.

### Pitfall 4: RLS Performance Overhead
**What goes wrong:** Row-level security wrapping adds overhead to every database read/write operation, slowing queries that return large result sets.
**Why it happens:** `wrapDatabaseReader` evaluates the read rule for every document returned by `db.query().collect()`.
**How to avoid:** Use RLS as defense-in-depth (secondary), not primary enforcement. Primary enforcement should be at the `customQuery` input level (check membership once, not per-row). For large queries, rely on index-based filtering (`by_workspace` index) + input-level membership check.
**Warning signs:** Query latency increases after enabling RLS; queries collecting 100+ documents become noticeably slower.

### Pitfall 5: Default Workspace Assignment Race Condition
**What goes wrong:** New user creates account but has no workspace membership yet. Frontend tries to load workspace data and gets empty results or errors.
**Why it happens:** User creation and workspace membership creation are separate operations without transactional guarantee.
**How to avoid:** When creating a new user, atomically create their membership in the default workspace within the same mutation. The `acceptInvite` pattern in `invites.ts` already shows this -- membership + workspace assignment in one mutation.
**Warning signs:** New users seeing blank screens or "no workspace" errors.

### Pitfall 6: Convex 10-Second Mutation Limit
**What goes wrong:** Bulk migration of workspace membership for many existing users times out.
**Why it happens:** Convex mutations have a 10-second execution limit. Creating membership records for 100+ users exceeds this.
**How to avoid:** Use batch processing pattern from `batchDelete.ts`. Process in chunks of 50-100 records per mutation call. Use `internalAction` for orchestration if needed.
**Warning signs:** "Mutation timed out" errors during migration.

## Code Examples

Verified patterns from the existing codebase and official sources:

### Workspace Creation (Existing Pattern)
```typescript
// Source: backend/convex/workspaces.ts (already implemented)
export const create = mutation({
  args: {
    name: convexVal.string(),
    slug: convexVal.string(),
    color: convexVal.optional(convexVal.string()),
    emoji: convexVal.optional(convexVal.string()),
    description: convexVal.optional(convexVal.string()),
    missionStatement: convexVal.string(),
  },
  handler: wrapConvexHandler(async (ctx, args) => {
    // Slug validation, uniqueness check, max 5 limit
    // Auto-sets isDefault if first workspace
    // Creates per-workspace settings
  }),
});
```

### Membership Check (Existing Pattern)
```typescript
// Source: backend/convex/organizationMembers.ts (already implemented)
export async function requireAdmin(
  ctx: any,
  workspaceId: Id<"workspaces">,
  userId: string
): Promise<void> {
  const member = await ctx.db
    .query("organizationMembers")
    .withIndex("by_workspace_user", (q) =>
      q.eq("workspaceId", workspaceId).eq("userId", userId)
    )
    .first();
  if (!member) throw new ConvexError("User is not a member");
  if (member.role !== "owner" && member.role !== "admin") {
    throw new ConvexError("Insufficient permissions");
  }
}
```

### Agent Auth Verification (Existing Pattern)
```typescript
// Source: frontend/lib/agent-auth.ts (already implemented)
export async function verifyAgent(
  agentId: string,
  apiKey: string
): Promise<VerifiedAgent | null> {
  const convex = getConvex();
  const agent = await convex.query(api.agents.verifyKeyWithGrace, {
    agentId: agentId as Id<"agents">,
    apiKey,
  });
  if (!agent) return null;
  return agent as VerifiedAgent;
}
```

### ESLint Rule to Prevent Direct Imports
```javascript
// Source: https://stack.convex.dev/custom-functions
// Add to .eslintrc or eslint.config.js
"no-restricted-imports": ["error", {
  patterns: [{
    group: ["*/_generated/server"],
    importNames: ["query", "mutation"],
    message: "Use workspaceQuery/workspaceMutation from convex/functions.ts"
  }]
}]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual auth checks in each handler | `customQuery`/`customMutation` builders (convex-helpers) | 2024 (convex-helpers matured) | Structural enforcement; impossible to forget |
| Client-side workspace filtering | Server-side RLS + workspace-scoped builders | Always been best practice | Prevents data leaks from malicious clients |
| Flat role strings ("admin"/"member") | Role hierarchy with numeric levels | Standard RBAC pattern | Extensible without code changes when adding roles |
| Workspace ID in request body | Workspace ID in URL path (`/api/v1/workspaces/{id}/...`) | REST best practice | Enables URL-level caching, clearer API structure, proxy-level routing |

**Deprecated/outdated:**
- `businessId` field: Legacy field being migrated to `workspaceId` (MIG-06). Still present as optional in schema. Phase 2 should remove or ignore.
- `BusinessProvider.tsx` / `BusinessFilter.tsx`: Legacy components from "business" naming era. Content duplicates `WorkspaceProvider.tsx` / `WorkspaceFilter.tsx`. Should be consolidated.

## Open Questions

1. **Agents: Global or Workspace-Scoped?**
   - What we know: Agents are currently global (shared across workspaces). Schema has no `workspaceId` on agents table. Requirements say "per-workspace data isolation" for agents.
   - What's unclear: Should agents be scoped to workspaces (breaking the current model) or remain global with workspace-level assignment tracking?
   - Recommendation: Keep agents global. Add an `agentWorkspaceAssignments` table or use `organizationMembers` to track which agents can operate in which workspaces. This preserves the current model while enabling per-workspace agent visibility.

2. **Role Model: Expand or Extend?**
   - What we know: Current roles are `owner/admin/member`. Requirements mention Admin, Agent, Collaborator, Viewer.
   - What's unclear: Should `owner` be kept or renamed to `admin`? Should `member` become `collaborator`?
   - Recommendation: Expand to 4 roles: `admin` (replaces owner+admin), `agent` (for AI agents operating via API), `collaborator` (human team member, read+write), `viewer` (read-only). Migration required for existing `organizationMembers` records.

3. **Convex Auth Integration Timing**
   - What we know: Current auth is API-key-based for agents and session-based (Convex client) for frontend. No `ctx.auth.getUserIdentity()` in use.
   - What's unclear: Should Phase 2 integrate Convex Auth (OAuth/magic links) or keep the current model?
   - Recommendation: Defer Convex Auth integration to a later phase. Phase 2 focuses on workspace isolation using the existing auth mechanism. The `customQuery` builder can be enhanced later to use `ctx.auth` when Convex Auth is added.

4. **Budget Field Location**
   - What we know: WS-03 requires workspace budget (monthly token limit). The `workspaces` table has no budget fields.
   - What's unclear: Should budget be on the `workspaces` table or a separate `workspace_budgets` table?
   - Recommendation: Add `monthlyTokenBudget` (number, optional) and `currentMonthSpent` (number, optional) directly to the `workspaces` table. Simple, queryable, no join needed. A separate table is only warranted if budget history tracking is needed (defer to Phase 4 observability).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30.2.0 + ts-jest |
| Config file | `jest.config.js` |
| Quick run command | `npm test -- --testPathPattern=workspace` |
| Full suite command | `npm run validate` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WS-01 | Workspace creation with all fields | unit | `npm test -- backend/convex/__tests__/businesses.test.ts` | Partial (existing test, needs RBAC guard test) |
| WS-02 | Workspace data isolation (queries filtered) | unit + integration | `npm test -- backend/convex/__tests__/workspace-isolation.test.ts` | Wave 0 |
| WS-03 | Admin sets workspace budget | unit | `npm test -- backend/convex/__tests__/workspace-budget.test.ts` | Wave 0 |
| WS-04 | Admin sets default workspace | unit | `npm test -- backend/convex/__tests__/businesses.test.ts` | Partial (exists, needs role check test) |
| WS-05 | User sees only assigned workspaces | unit + integration | `npm test -- backend/convex/__tests__/workspace-membership.test.ts` | Wave 0 |
| WS-06 | Workspace context in API URL path | integration | `npm test -- frontend/src/app/api/__tests__/workspace-api.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern=workspace`
- **Per wave merge:** `npm run validate`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/convex/__tests__/workspace-isolation.test.ts` -- covers WS-02: verify queries return only workspace-scoped data
- [ ] `backend/convex/__tests__/workspace-budget.test.ts` -- covers WS-03: budget CRUD and enforcement
- [ ] `backend/convex/__tests__/workspace-membership.test.ts` -- covers WS-05: membership filtering, role hierarchy
- [ ] `backend/convex/utils/__tests__/workspaceAuth.test.ts` -- covers role hierarchy pure logic
- [ ] `backend/convex/__tests__/functions.test.ts` -- covers `workspaceQuery`/`workspaceMutation` builders
- [ ] `frontend/src/app/api/__tests__/workspace-api.test.ts` -- covers WS-06: URL-path workspace extraction
- [ ] Install `convex-helpers`: `cd backend && npm install convex-helpers`

## Sources

### Primary (HIGH confidence)
- [Convex Custom Functions](https://stack.convex.dev/custom-functions) - `customQuery`, `customMutation`, `customCtx` API, ESLint enforcement patterns
- [Convex Authorization Best Practices](https://stack.convex.dev/authorization) - RBAC patterns, role hierarchy, membership tables, defense-in-depth
- [Convex Row-Level Security](https://stack.convex.dev/row-level-security) - `wrapDatabaseReader`, `wrapDatabaseWriter`, `Rules` type, default deny config
- [convex-helpers README](https://github.com/get-convex/convex-helpers) - Full API reference for custom functions and RLS modules
- Existing codebase: `backend/convex/organizationMembers.ts`, `backend/convex/workspaces.ts`, `backend/convex/invites.ts` -- verified working patterns

### Secondary (MEDIUM confidence)
- [Convex Authentication Wrappers as Middleware](https://stack.convex.dev/wrappers-as-middleware-authentication) - Historical context on middleware evolution in Convex
- [Convex Auth in Functions](https://docs.convex.dev/auth/functions-auth) - Official docs on `ctx.auth.getUserIdentity()` pattern

### Tertiary (LOW confidence)
- None -- all findings verified against official Convex documentation or existing codebase patterns.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - `convex-helpers` is the official companion library; patterns documented in Convex official blog
- Architecture: HIGH - Custom function builder pattern is explicitly recommended by Convex team; existing codebase has partial implementation (organizationMembers, invites)
- Pitfalls: HIGH - Based on direct analysis of existing codebase gaps (optional workspaceId, unfiltered queries, global agents)

**Research date:** 2026-02-26
**Valid until:** 2026-03-26 (stable -- Convex patterns mature, convex-helpers API stable)
