# Phase 2: Workspace Isolation & RBAC - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Enforce multi-tenant isolation through workspace creation/management, role-based access control (Admin, Agent, Collaborator, Viewer), per-workspace data isolation (agents, tickets, crons, wiki, budget), and user-workspace membership management. Establish workspace context propagation across all API calls.

</domain>

<decisions>
## Implementation Decisions

### RBAC Model & Roles
- **Hierarchy:** Hierarchical inheritance (Admin ⊃ Collaborator ⊃ Agent ⊃ Viewer)
  - Admin can perform all actions; Collaborator can perform Collaborator + Agent + Viewer actions; Agent can perform Agent + Viewer actions; Viewer is read-only
- **Scope:** Uniform permissions per role across all resource types (no per-resource permission variation)
- **Users per role:** Single role per user per workspace (no multiple roles in same workspace)
- **Role capabilities:**
  - **Viewer:** Read-only access to all resources (agents, tickets, crons, wiki, budget summaries)
  - **Agent:** Claim and update work — claim tickets, post comments, update ticket status, execute crons, view workspace budget
  - **Collaborator:** Manage tickets and agents — create/edit/delete tickets, manage agent assignments, view workspace budget
  - **Admin:** Everything + user management — all Collaborator permissions + invite/remove/change roles for users, workspace configuration, audit logs

### Workspace Creation & Configuration
- **Creator policy:** Any authenticated user can create workspaces
- **Metadata editability:** All metadata editable after creation (name, slug, color, emoji, mission statement)
- **Naming constraints:** Workspace names must be globally unique; slug is auto-derived from name (URL-safe, immutable)
- **Workspace templates:** No templates — all workspaces created blank, user customizes after creation

### Data Isolation Boundaries
- **Scope:** All resources strictly workspace-scoped (agents, tickets, crons, wiki, budget)
  - Resources exist in exactly one workspace; no sharing across workspace boundaries
- **Cross-workspace references:** Not allowed — all references stay within workspace, complete isolation
- **Enforcement method:** Via middleware/auth layer (middleware validates workspace membership and filters results)
  - Note: This is API-level enforcement; database-level constraints deferred to Phase 2 if needed
- **User removal:** Data reassigned to remaining admin
  - When a user is removed from workspace, their tickets, crons, wiki pages are reassigned to another admin in the workspace
  - User access revoked immediately; data remains attributed to reassigned admin (audit trail preserved)

### User Onboarding & Workspace Defaults
- **Personal workspace:** Auto-created on account signup
  - Each user gets a personal workspace (named "{Username}" or "Personal") on signup
  - User is Admin of their personal workspace
- **API workspace context:** Explicit context required
  - All API calls must explicitly specify workspace_id; no implicit defaults
  - Prevents accidental operations in wrong workspace
- **Workspace switching (UI/API):**
  - URL param pattern: routes include workspace context (e.g., `/workspace/{slug}/tickets` or query param `?workspace={id}`)
  - UI sidebar provides workspace switcher; routes update when user switches workspaces
- **Access fallback:** Redirect to personal workspace
  - If user tries to access a workspace they don't have access to, redirect to personal workspace
  - If user has no other workspaces, personal workspace is always available as fallback

### Claude's Discretion
- Permission specifics for edge cases (e.g., can Collaborators manage API keys for agents?)
- Exact workspace naming constraints (length, special characters, reserved names)
- Personal workspace naming convention and display
- Audit logging schema for RBAC changes (level of detail captured)
- Database schema design for workspace-role-user relationships (normalized vs denormalized)

</decisions>

<specifics>
## Specific Ideas

- Workspace switching should feel natural and fast — sidebar dropdown with workspace search
- Personal workspace should feel like "my space" (emoji, color, mission are optional but encouraged)
- Admin role is trusted to manage other admins' permissions — no escalation checks

</specifics>

<deferred>
## Deferred Ideas

- Cross-workspace notifications — belongs in Phase 5 (Activity Logging & Observability)
- Workspace templates for teams — useful but can be backlog feature
- Workspace archival/soft-delete — can be Phase 2.1 or later
- SSO/SAML integration for workspace user management — belongs in Phase 3+ (Authentication)

</deferred>

---

*Phase: 02-workspace-isolation-rbac*
*Context gathered: 2026-02-26*
