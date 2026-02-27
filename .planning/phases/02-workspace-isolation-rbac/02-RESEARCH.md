# Phase 2: Workspace Isolation & RBAC - Research

**Researched:** 2026-02-27
**Domain:** Role-based access control, workspace isolation, Convex schema migration, Next.js middleware
**Confidence:** HIGH (based on direct codebase analysis + Convex architecture knowledge)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Role Hierarchy & Migration
- **4-level hierarchy:** admin > agent > collaborator > viewer (strict inheritance)
- **Immediate data migration:** Convert existing owner→admin, admin→collaborator, member→viewer in this phase (no coexistence period)
- **Global roles:** Users have one role across all workspaces (not workspace-specific)
- **Schema change:** Rename `organizationMembers.role` → `organizationMembers.userRole` for clarity
- **Workspace creation authority:** Only system admins can create workspaces
- **System admins as super-users:** System admins automatically have admin privileges in all workspaces
- **Last admin protection:** Prevent downgrading/removing the last admin of a workspace (error: "Must have at least one admin")
- **Audit trail:** Keep `workspaces.createdBy` field for tracking which admin created each workspace
- **API key roles:** Keys are always agent-scoped, regardless of the user's role
- **Role-based quotas:** Admins get higher rate limits than agents/collaborators/viewers
- **Admin action logging:** Mark all actions taken by admins distinctly in activity logs

#### Workspace Context Enforcement
- **All endpoints workspace-scoped:** Every API endpoint follows `/api/v1/workspaces/{workspaceId}/...` pattern (including agent registration)
- **Defense-in-depth validation:** Middleware validates workspace membership, route handlers extract and use context
- **Error handling:** Invalid/inaccessible workspace returns 404 (not 403), maintaining security through ambiguity
- **Admin endpoints:** System admins get separate `/api/admin/...` endpoints without workspace requirement
- **Context propagation:** Use convex-helpers `customQuery`/`customMutation` builders to propagate workspace context implicitly
- **Membership validation:** Validate on every request (no caching); fresh check each time
- **No cross-workspace queries:** Single workspace per request; no aggregate queries across multiple workspaces

#### Agent Isolation Model
- **Global key auth:** Agents can authenticate and call any workspace endpoint (not limited to registered workspaces)
- **Execution scoping:** When an agent claims a ticket from workspace A, they can only access workspace A data during that execution
- **Workspace-agnostic keys:** API keys work with any workspace endpoint; agents decide at request time
- **Key expiration:** API keys auto-expire after 1 year (forces rotation)
- **Deactivation recovery:** When agent is deactivated, keys are suspended immediately; auto-delete after 30 days if not reactivated
- **Activity logging:** Agent API requests logged to activity with sensitive field masking (not hidden completely)
- **Concurrent requests:** Same agent/key can make concurrent requests to different workspaces (no sequential enforcement)

#### Permission Failure Behavior
- **Minimal error detail:** 404 returns only HTTP status, no detail message (security through obscurity)
- **Rate limiting on failures:** After 5 failed permission attempts, 1-minute cooldown; prevents brute force
- **Failure logging:** All permission failures logged to user-visible activity log (full audit trail)
- **Admin notifications:** Workspace admins notified when unauthorized access is attempted (alerts on pattern detection)

### Claude's Discretion
- Exact rate limit thresholds (currently 5 failures = 1-min cooldown)
- Specific format of admin notifications (email, in-app alert, etc.)
- Implementation of role hierarchy in code (builders vs manual checks)
- Exact role level numeric values (admin=4, agent=3, etc.)

### Deferred Ideas (OUT OF SCOPE)
- **Workspace hierarchies (parent/child workspaces):** Out of scope for Phase 2; noted for future architecture expansion
- **Invite/join workflows for workspace membership:** Currently not discussed; assignment happens via admin only
- **OAuth/SAML authentication:** Out of scope; API key auth sufficient for v1
- **Granular permission matrix (admin can edit but not delete):** Out of scope; using strict role hierarchy instead
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WS-01 | User can create a workspace (name, slug, mission statement, emoji, color) | Workspace creation already exists in `workspaces.ts::create`; needs `createdBy` field added and admin-only guard |
| WS-02 | Workspace has isolated data: agents, tickets, crons, wiki, cost budget | Most tables already have `workspaceId`; gaps exist in `executions` (optional), `notifications` (no by_workspace index), some legacy tables |
| WS-03 | Admin can set workspace budget (monthly token limit) | Rate limit module exists at `rateLimit.ts`; needs role-based quota tiers (admin vs others) in `apiKeyQuota` |
| WS-04 | Admin can set default workspace | `workspaces.ts::setDefault` already exists; needs admin-only guard added |
| WS-05 | Workspace isolation enforced (users see only assigned workspaces) | `organizationMembers` table exists with old 3-role model; needs migration to 4-level hierarchy and enforcement in all API routes |
| WS-06 | Workspace context propagated through all API calls (URL path `/api/v1/workspaces/{id}/...`) | Pattern already established in Phase 1; middleware extracts workspace from URL; needs to enforce membership validation in handlers |
</phase_requirements>

---

## Summary

Phase 2 is a schema migration + access control enforcement phase. The codebase already has the bones in place: the `organizationMembers` table (with 3 roles: owner/admin/member), workspace-scoped API routes under `/api/v1/workspaces/{workspaceId}/`, an existing `extractWorkspaceId` middleware, and a rate limiting module. The primary work is:

1. **Schema migration:** Rename `organizationMembers.role` → `organizationMembers.userRole`, change the union type from `owner|admin|member` to `admin|agent|collaborator|viewer`, migrate all existing data, add `createdBy` to workspaces table.

2. **RBAC enforcement layer:** Add a `requireRole()` helper in Convex, implement permission checks in all route handlers that are currently TODOs (the agents route has `// TODO: Validate workspace access when workspace context is available` comment), and wire the permission-failure rate limiter (using the existing settings-based rate limit utility).

3. **Role-based rate limits:** The existing `apiKeyQuota` table and `checkAndDecrement` mutation use flat defaults (1000/hr, 10000/day). This needs to be parameterized by role tier.

4. **Admin endpoint routing:** Add `/api/admin/...` routes for system admin operations (workspace creation, global user management) that bypass the workspace middleware.

**Primary recommendation:** Execute as 4 sequential waves: (1) Schema + migration, (2) Convex RBAC helpers, (3) API middleware enforcement, (4) Rate limit tier implementation. Each wave is independently testable.

---

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `convex` | ^1.32.0 | Database, functions, realtime | Project foundation — all backend logic |
| `next` | ^15.1.6 | API routes, middleware | Project foundation — all HTTP handling |
| `zod` | ^4.3.6 | Schema validation | Already used in validators; RFC 9457 integration |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `convex-helpers` | Not yet installed | `customQuery`/`customMutation` context builders | Needed for workspace-scoped Convex functions with implicit context propagation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual `requireRole()` checks in each handler | `customQuery`/`customMutation` from convex-helpers | convex-helpers cleaner but adds dependency; manual checks more explicit and already follow project pattern |
| settings-based rate limit (existing) | Dedicated `permissionFailures` table | Settings-based reuses existing infra; dedicated table gives better audit trail |

**Installation (if convex-helpers needed):**
```bash
npm install convex-helpers
```
Note: CONTEXT.md mentions using convex-helpers `customQuery`/`customMutation` as a locked decision, but the package is NOT currently in `package.json`. This is a dependency gap.

---

## Architecture Patterns

### Recommended Project Structure

```
backend/convex/
├── organizationMembers.ts    # MODIFY: add new role type, requireRole(), migration query
├── workspaces.ts             # MODIFY: add createdBy field, admin-only guard on create
├── rateLimit.ts              # MODIFY: add role-based quota tiers
├── schema.ts                 # MODIFY: rename role→userRole, update union type, add createdBy

frontend/lib/api/
├── auth.ts                   # MODIFY: add workspace membership validation call
├── rbac.ts                   # CREATE: role hierarchy helpers, permission checks
│
frontend/src/app/api/
├── admin/                    # CREATE: /api/admin/ routes for system admin operations
│   └── workspaces/
│       └── route.ts
└── v1/workspaces/[workspaceId]/
    └── (all existing routes)  # MODIFY: wire in requireRole() from rbac.ts

backend/convex/migrations.ts  # ADD: MIG-11 role migration (owner→admin, admin→collaborator, member→viewer)
```

### Pattern 1: Role Hierarchy as Numeric Comparison

The existing code uses string comparisons (`member.role === "owner"` or `roleHierarchy[member.role] >= roleHierarchy[args.requiredRole]`). The new 4-level hierarchy should use numeric values for clean comparison:

```typescript
// Source: Existing organizationMembers.ts pattern, extended
export const ROLE_LEVELS = {
  admin: 4,
  agent: 3,
  collaborator: 2,
  viewer: 1,
} as const;

export type UserRole = keyof typeof ROLE_LEVELS;

export function hasRequiredRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_LEVELS[userRole] >= ROLE_LEVELS[requiredRole];
}
```

**When to use:** In all `requireRole()` checks at both Convex layer and API middleware layer.

### Pattern 2: Convex requireRole Helper

The existing `requireAdmin()` and `requireOwner()` functions in `organizationMembers.ts` establish the pattern. Extend to parameterized role check:

```typescript
// Source: Existing organizationMembers.ts::requireAdmin pattern
export async function requireRole(
  ctx: any,
  workspaceId: Id<"workspaces">,
  userId: string,
  requiredRole: UserRole
): Promise<void> {
  const member = await ctx.db
    .query("organizationMembers")
    .withIndex("by_workspace_user", (q: any) =>
      q.eq("workspaceId", workspaceId).eq("userId", userId)
    )
    .first();

  // System admins bypass workspace membership check
  if (member?.isSystemAdmin) return;

  if (!member) {
    // Return 404 per locked decision (security through obscurity)
    throw new ConvexError("NOT_FOUND");
  }

  if (!hasRequiredRole(member.userRole, requiredRole)) {
    throw new ConvexError("NOT_FOUND");
  }
}
```

**When to use:** In every Convex mutation/query that modifies workspace-scoped data.

### Pattern 3: Schema Migration (Convex Mutation)

Follows the established MIG-XX pattern in `migrations.ts`:

```typescript
// Source: Existing migrations.ts MIG-04 pattern
export const migrationRoleRename = mutation({
  args: {
    batchSize: convexVal.optional(convexVal.number()),
  },
  handler: async (ctx, { batchSize = 100 }) => {
    // MIG-11: Rename role→userRole, map old roles to new hierarchy
    const roleMapping: Record<string, string> = {
      owner: "admin",
      admin: "collaborator",
      member: "viewer",
    };

    const members = await ctx.db.query("organizationMembers").take(batchSize);
    let migrated = 0;

    for (const member of members) {
      const newRole = roleMapping[member.role] || "viewer";
      await ctx.db.patch(member._id, {
        userRole: newRole,
        // Keep old role field until cleanup migration
      });
      migrated++;
    }

    return { migrated, message: `MIG-11: Migrated ${migrated} members` };
  },
});
```

**Key constraint:** Schema changes in Convex require updating `schema.ts` first (both fields exist simultaneously during migration), then running migration, then removing old field.

### Pattern 4: Permission Failure Rate Limiting

Uses existing `checkRateLimitSilent` from `backend/convex/utils/rateLimit.ts`:

```typescript
// Source: Existing rateLimit utility pattern (agents.ts heartbeat)
const failureKey = `perm_fail:${userId}:${workspaceId}`;
const allowed = await checkRateLimitSilent(ctx, failureKey, 5, 60_000); // 5 failures per 60s
if (!allowed) {
  // Log the rate limit event
  await ctx.db.insert("activities", { type: "permission_rate_limited", ... });
  throw new ConvexError("NOT_FOUND"); // Still 404, not 429, per locked decision
}
```

### Pattern 5: Route Handler Permission Check (Frontend)

The existing agent route has a TODO comment showing where to inject workspace validation. The pattern:

```typescript
// Source: Existing agents/route.ts pattern with TODO filled in
const workspaceId = context.params.workspaceId;
const apiKeyId = request.headers.get("x-api-key-id"); // set by middleware

// Validate workspace membership via Convex
const convex = getConvexClient();
const hasAccess = await convex.query(api.organizationMembers.hasAccess, {
  workspaceId: workspaceId as Id<"workspaces">,
  userId: apiKeyId!,
  requiredRole: "viewer", // minimum role to read
});

if (!hasAccess) {
  return NextResponse.json(
    { type: "...", title: "Not Found", status: 404 },
    { status: 404 }
  );
}
```

### Anti-Patterns to Avoid

- **Role check in route handler only (no Convex check):** The frontend middleware can be bypassed; Convex functions must also enforce roles. Defense-in-depth requires checks at both layers.
- **Caching workspace membership:** The locked decision says validate on every request. Don't add Redis/in-memory caching.
- **Returning 403 Forbidden for unauthorized access:** Locked decision says 404 only. Don't leak workspace existence.
- **Blocking concurrent agent requests:** The locked decision explicitly allows concurrent requests from same agent to different workspaces.
- **Using old role names (owner/admin/member) after migration:** The old roles must be completely replaced. The `invites` table also uses the old roles and must be updated.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limit tracking | Custom DB table | Existing `checkRateLimitSilent` in `backend/convex/utils/rateLimit.ts` | Already implemented with settings-based key-window tracking |
| Error response format | Custom error objects | Existing `ApiError` class in `backend/lib/errors.ts` + RFC 9457 in `frontend/lib/api/errors.ts` | Standardized across Phase 1; 14 error classes already defined |
| Paginated list responses | Custom pagination | Existing `createListResponseObject` / `parsePaginationFromRequest` in `routeHelpers.ts` | 47 pagination tests passing |
| Workspace ID extraction | URL parsing logic | Existing `extractWorkspaceIdFromPath` in `routeHelpers.ts` | Already handles v1 and legacy paths |
| Request ID generation | UUID generation | Existing `generateRequestId` in `responses.ts` | RFC 9457 tracing already in place |
| Cascade workspace delete | Manual deletion loops | Existing `batchDelete` utility + `remove` mutation in `workspaces.ts` | Already handles 25 workspace-scoped tables |

**Key insight:** Phase 1 built a complete API foundation (auth, pagination, errors, rate limiting, OpenAPI). Phase 2 should layer permission enforcement ON TOP of that foundation, not alongside it.

---

## Common Pitfalls

### Pitfall 1: Convex Schema Migration — Dual Field Period
**What goes wrong:** Removing the `role` field from schema.ts immediately breaks all existing queries that read `member.role` before the migration runs.
**Why it happens:** Convex schema changes are applied before data migration. Any code reading `role` will get `undefined` on un-migrated records.
**How to avoid:** Add `userRole` as optional alongside existing `role` in schema.ts. Run migration to populate `userRole`. Only then make `role` optional and switch all code to `userRole`. Final cleanup removes `role` entirely.
**Warning signs:** TypeScript errors in functions accessing `member.role` after schema change.

### Pitfall 2: Invites Table Also Uses Old Role Union
**What goes wrong:** `invites` table in schema.ts also has `role: v.union("owner", "admin", "member")`. Easy to miss when updating `organizationMembers`.
**Why it happens:** Two separate tables share the role enum without a shared type definition.
**How to avoid:** Search for ALL role union definitions: `grep -n 'literal("owner")' backend/convex/schema.ts` — found in both `organizationMembers` and `invites` tables.
**Warning signs:** TypeScript type errors in `invites.ts` after schema update.

### Pitfall 3: workspaceId Still Optional in Many Tables
**What goes wrong:** Most tables have `workspaceId: convexVal.optional(...)` with comment "Temporarily optional for migration." Queries filtering by workspaceId will silently return records without workspaceId.
**Why it happens:** Legacy migration from Phase 1 (MIG-04). Many records may not have workspaceId set.
**How to avoid:** Phase 2 enforcement queries MUST handle the optional case. Don't assume `workspaceId` is always set. Filter: `.filter(q => q.neq(q.field("workspaceId"), undefined))` or use `.withIndex("by_workspace")` which only returns records with the field set.
**Warning signs:** Endpoints returning data from wrong workspaces in integration tests.

### Pitfall 4: System Admin Flag Has No Schema Backing
**What goes wrong:** The locked decision says "system admins automatically have admin privileges in all workspaces," but there is no `isSystemAdmin` field in any table. The agents table has no user concept; `organizationMembers` only tracks `userId` as a string.
**Why it happens:** The current schema predates the system admin concept.
**How to avoid:** Determine where `isSystemAdmin` should live. Options: (a) Add `isSystemAdmin: boolean` to `organizationMembers` — but this is per-workspace membership, so a flag here would need to be on every membership record. (b) Create a separate `systemAdmins` table with `userId`. (c) Add `isSystemAdmin` to a global settings key. Recommendation: Use a simple `systemAdmins` table (new table, avoids complex migration).
**Warning signs:** Cannot implement "system admins bypass workspace checks" without a schema-level concept.

### Pitfall 5: Notifications Table Missing `by_workspace` Index
**What goes wrong:** The `notifications` table has `workspaceId` field but no `by_workspace` index (unlike every other workspace-scoped table). Queries filtering notifications by workspace will do full table scans.
**Why it happens:** Notifications were added after the workspace migration and the index was missed.
**How to avoid:** Add `.index("by_workspace", ["workspaceId"])` to notifications in schema.ts during Phase 2 schema work.
**Warning signs:** Slow notification queries in production; Convex warns about full table scans.

### Pitfall 6: `convex-helpers` Not Installed
**What goes wrong:** The locked decision specifies using convex-helpers `customQuery`/`customMutation` builders, but this package is NOT in `package.json`.
**Why it happens:** The decision was made conceptually during planning but never installed.
**How to avoid:** Either install `convex-helpers` (`npm install convex-helpers`) OR implement workspace context propagation manually using the existing pattern of passing `workspaceId` as an argument. The manual approach requires no new dependency and follows the existing codebase pattern.
**Recommendation:** Use manual `requireRole()` helper pattern (already established in `organizationMembers.ts`) rather than adding a new dependency. This maintains consistency with existing code.

### Pitfall 7: `workspaces.ts::create` Has No `createdBy` Field
**What goes wrong:** The locked decision requires `workspaces.createdBy` for audit trail, but the current `workspaces` table schema has no `createdBy` field. The `create` mutation in `workspaces.ts` does not accept or store `createdBy`.
**Why it happens:** Workspace creation existed before the RBAC design was finalized.
**How to avoid:** Add `createdBy: convexVal.optional(convexVal.string())` to workspaces schema and update `create` mutation. Make it optional initially to avoid breaking existing workspaces; backfill can happen in migration.

---

## Code Examples

Verified patterns from codebase analysis:

### Existing Role Check Pattern (to be extended)
```typescript
// Source: backend/convex/organizationMembers.ts::hasAccess
// Current 3-role check — this is the pattern to extend to 4 roles
const roleHierarchy = { owner: 3, admin: 2, member: 1 };
return roleHierarchy[member.role] >= roleHierarchy[args.requiredRole];
```

### Schema Union Type Change Pattern
```typescript
// Source: backend/convex/schema.ts (current)
role: convexVal.union(
  convexVal.literal("owner"),
  convexVal.literal("admin"),
  convexVal.literal("member")
),

// Target: Phase 2 migration (keep both during transition)
role: convexVal.optional(convexVal.union(
  convexVal.literal("owner"),
  convexVal.literal("admin"),
  convexVal.literal("member")
)),
userRole: convexVal.optional(convexVal.union(
  convexVal.literal("admin"),
  convexVal.literal("agent"),
  convexVal.literal("collaborator"),
  convexVal.literal("viewer")
)),
```

### Existing Migration Numbering (for next migration)
```typescript
// Source: backend/convex/migrations.ts — next migration ID is MIG-11
// MIG-01 through MIG-10 are already used
export const migrationRoleHierarchy = mutation({
  // MIG-11: Role rename + hierarchy migration
  // ...
});
```

### Existing Rate Limit for Permission Failures
```typescript
// Source: backend/convex/utils/rateLimit.ts::checkRateLimitSilent
// Already handles silent failure tracking
const allowed = await checkRateLimitSilent(
  ctx,
  `perm_fail:${userId}:${workspaceId}`,  // unique key per user+workspace
  5,        // 5 failures (Claude's Discretion threshold)
  60_000    // 1-minute cooldown (locked decision)
);
```

### Existing Middleware Context Pattern
```typescript
// Source: frontend/middleware.ts — workspace ID already extracted to header
response.headers.set("x-workspace-id", context.workspaceId);
response.headers.set("x-api-key-id", context.apiKeyId);

// Route handlers read it:
// Source: frontend/middleware.ts::getRequestContext
const workspaceId = request.headers.get("x-workspace-id");
const apiKeyId = request.headers.get("x-api-key-id");
```

### Test Mock Pattern (from existing tests)
```typescript
// Source: existing route test files (tasks/__tests__/route.test.ts)
jest.mock("@/lib/api/auth", () => ({
  isAuthRequired: jest.fn(() => false),
  extractAuth: jest.fn(),
}));
// For RBAC tests, add:
jest.mock("@/lib/api/rbac", () => ({
  requireWorkspaceRole: jest.fn().mockResolvedValue(undefined), // no throw = allowed
}));
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 3-role model (owner/admin/member) | 4-role model (admin/agent/collaborator/viewer) | Phase 2 | Must migrate all `organizationMembers` records + update `invites` table |
| No workspace isolation enforcement | Defense-in-depth at middleware + Convex | Phase 2 | All route handlers need `requireRole` call added |
| Flat rate limits for all API keys | Role-based rate limits (admin tier > others) | Phase 2 | `apiKeyQuota.tokensPerHour/Day` must be set based on caller's role |
| Optional workspaceId on most tables | Required workspaceId (enforcement) | Phase 2 | Cannot make field required without full migration; enforcement via query filtering |

**Deprecated/outdated:**
- `requireOwner()` in `organizationMembers.ts`: "owner" role is being removed; replace with `requireRole(ctx, wsId, userId, "admin")`
- `requireAdmin()` in `organizationMembers.ts`: Uses old role name "admin" which maps to "collaborator" in new hierarchy; must be updated

---

## Open Questions

1. **`convex-helpers` vs manual context propagation**
   - What we know: Locked decision says use convex-helpers; package not installed; existing pattern is manual `workspaceId` passing
   - What's unclear: Whether installing convex-helpers is intended or if manual pattern is acceptable
   - Recommendation: Use manual `requireRole()` helper that follows existing `requireAdmin()`/`requireOwner()` pattern; avoids new dependency risk. If convex-helpers is desired, install it and document the new pattern.

2. **Where does `isSystemAdmin` live in the schema?**
   - What we know: No `isSystemAdmin` field anywhere in schema; `organizationMembers` userId is a string; agents have apiKey but no "user" concept
   - What's unclear: Is a "system admin" a human user or an agent? What ID system tracks them?
   - Recommendation: Add a `systemAdmins` table: `{ userId: v.string(), createdAt: v.number() }` with `.index("by_user", ["userId"])`. Simple lookup: if user is in this table, bypass workspace checks.

3. **Which `userId` to use for permission checks?**
   - What we know: API keys are on `agents` table; `organizationMembers.userId` is a string (not an agents ID); the middleware extracts `x-api-key-id` which is the raw API key value
   - What's unclear: How to map an API key to a userId for membership lookup. The `verifyAgent()` function returns agent details but doesn't give a `userId` matching `organizationMembers`
   - Recommendation: In Phase 2, `userId` in `organizationMembers` should be the agent's `_id` string. Update membership lookup to use agent ID directly. This aligns with the "Global roles: Users have one role" decision where an "agent" IS the user.

4. **`notifications` missing `by_workspace` index**
   - What we know: All other workspace-scoped tables have this index; notifications table is missing it
   - What's unclear: Whether this was intentional or an oversight
   - Recommendation: Add the index as part of Phase 2 schema work. Low risk, improves consistency.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30 + ts-jest 29 |
| Config file | `/Users/arana/dev/ankit/mission-control/jest.config.js` |
| Quick run command | `npm test -- --testPathPattern="organizationMembers\|rbac\|middleware"` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WS-01 | Admin-only workspace creation | unit | `npm test -- --testPathPattern="workspaces"` | ❌ Wave 0 |
| WS-02 | Workspace data isolation (query filtering) | unit | `npm test -- --testPathPattern="organizationMembers"` | ❌ Wave 0 |
| WS-03 | Role-based rate limit tiers | unit | `npm test -- --testPathPattern="rateLimit"` | Partial (flat limits only) |
| WS-04 | Admin-only setDefault | unit | `npm test -- --testPathPattern="workspaces"` | ❌ Wave 0 |
| WS-05 | 4-level role enforcement in routes | unit | `npm test -- --testPathPattern="rbac\|route"` | ❌ Wave 0 |
| WS-06 | Workspace context in all API calls | unit | `npm test -- --testPathPattern="middleware\|route"` | Partial (extracts but doesn't enforce) |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern="organizationMembers|rbac|workspaces"`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/convex/__tests__/organizationMembers.test.ts` — covers WS-02, WS-05 (role hierarchy, requireRole, migration)
- [ ] `frontend/lib/api/__tests__/rbac.test.ts` — covers WS-05 (frontend permission helpers)
- [ ] `backend/convex/__tests__/rateLimit.test.ts` — covers WS-03 (role-based quota tiers)
- [ ] `backend/convex/__tests__/migrations.test.ts` — covers MIG-11 role migration correctness

---

## Sources

### Primary (HIGH confidence)
- Direct analysis of `/Users/arana/dev/ankit/mission-control/backend/convex/schema.ts` — current schema structure, table definitions, indexes
- Direct analysis of `/Users/arana/dev/ankit/mission-control/backend/convex/organizationMembers.ts` — existing RBAC pattern
- Direct analysis of `/Users/arana/dev/ankit/mission-control/backend/convex/rateLimit.ts` — rate limit implementation
- Direct analysis of `/Users/arana/dev/ankit/mission-control/frontend/middleware.ts` — middleware pattern and context propagation
- Direct analysis of `/Users/arana/dev/ankit/mission-control/backend/convex/migrations.ts` — migration numbering (MIG-01 through MIG-10)
- Direct analysis of `.planning/phases/02-workspace-isolation-rbac/02-CONTEXT.md` — locked decisions

### Secondary (MEDIUM confidence)
- `package.json` analysis — confirmed `convex-helpers` is NOT installed; `convex ^1.32.0` is the version
- Grep across all route test files — confirmed mocking pattern for jest

### Tertiary (LOW confidence)
- convex-helpers `customQuery`/`customMutation` API: mentioned in CONTEXT.md but not verified against installed library (not installed)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — confirmed from package.json and direct codebase analysis
- Architecture: HIGH — based on existing patterns in the codebase that are working in production
- Pitfalls: HIGH — all 7 pitfalls found by directly reading the code, not hypothetical
- Open questions: MEDIUM — questions arise from gap between decisions and current schema state

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (schema-dependent; re-research if major Convex version bump)
