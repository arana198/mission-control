# Phase 2: Workspace Isolation & RBAC - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Enforce workspace boundaries through role-based access control. Implement a 4-level role hierarchy (admin > agent > collaborator > viewer), migrate existing role data, propagate workspace context through all API endpoints, and establish permission enforcement at backend (Convex) and frontend (API route middleware) layers.

</domain>

<decisions>
## Implementation Decisions

### Role Hierarchy & Migration
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

### Workspace Context Enforcement
- **All endpoints workspace-scoped:** Every API endpoint follows `/api/v1/workspaces/{workspaceId}/...` pattern (including agent registration)
- **Defense-in-depth validation:** Middleware validates workspace membership, route handlers extract and use context
- **Error handling:** Invalid/inaccessible workspace returns 404 (not 403), maintaining security through ambiguity
- **Admin endpoints:** System admins get separate `/api/admin/...` endpoints without workspace requirement
- **Context propagation:** Use convex-helpers `customQuery`/`customMutation` builders to propagate workspace context implicitly
- **Membership validation:** Validate on every request (no caching); fresh check each time
- **No cross-workspace queries:** Single workspace per request; no aggregate queries across multiple workspaces

### Agent Isolation Model
- **Global key auth:** Agents can authenticate and call any workspace endpoint (not limited to registered workspaces)
- **Execution scoping:** When an agent claims a ticket from workspace A, they can only access workspace A data during that execution
- **Workspace-agnostic keys:** API keys work with any workspace endpoint; agents decide at request time
- **Key expiration:** API keys auto-expire after 1 year (forces rotation)
- **Deactivation recovery:** When agent is deactivated, keys are suspended immediately; auto-delete after 30 days if not reactivated
- **Activity logging:** Agent API requests logged to activity with sensitive field masking (not hidden completely)
- **Concurrent requests:** Same agent/key can make concurrent requests to different workspaces (no sequential enforcement)

### Permission Failure Behavior
- **Minimal error detail:** 404 returns only HTTP status, no detail message (security through obscurity)
- **Rate limiting on failures:** After 5 failed permission attempts, 1-minute cooldown; prevents brute force
- **Failure logging:** All permission failures logged to user-visible activity log (full audit trail)
- **Admin notifications:** Workspace admins notified when unauthorized access is attempted (alerts on pattern detection)

### Claude's Discretion
- Exact rate limit thresholds (currently 5 failures = 1-min cooldown)
- Specific format of admin notifications (email, in-app alert, etc.)
- Implementation of role hierarchy in code (builders vs manual checks)
- Exact role level numeric values (admin=4, agent=3, etc.)

</decisions>

<specifics>
## Specific Ideas

- **Role migration should be atomic:** All users migrated in a single operation (not gradual). Reduces inconsistency windows.
- **Schema rename (role→userRole) is a breaking change:** Plan for backward compatibility or deprecation period with both fields.
- **Convex builders pattern:** Use official `convex-helpers` library for workspace-scoped functions (not custom middleware).
- **Admin notifications should be granular:** Different alerts for single failure vs. repeated failures vs. active attacks.

</specifics>

<deferred>
## Deferred Ideas

- **Workspace hierarchies (parent/child workspaces):** Out of scope for Phase 2; noted for future architecture expansion
- **Invite/join workflows for workspace membership:** Currently not discussed; assignment happens via admin only
- **OAuth/SAML authentication:** Out of scope; API key auth sufficient for v1
- **Granular permission matrix (admin can edit but not delete):** Out of scope; using strict role hierarchy instead

</deferred>

---

*Phase: 02-workspace-isolation-rbac*
*Context gathered: 2026-02-27*
