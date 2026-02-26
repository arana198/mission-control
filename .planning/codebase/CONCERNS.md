# Codebase Concerns

**Analysis Date:** 2026-02-26

## Tech Debt

### Incomplete Task Execution Logging (Phase 6A Placeholder)
- Issue: Task execution logging uses TODO comments with conditional mutations disabled in three route handlers
- Files:
  - `frontend/src/app/api/tasks/execute/route.ts` (lines 80-98, 124-128)
  - `frontend/src/app/api/tasks/[taskId]/route.ts` (line 173)
  - `frontend/lib/services/executionService.ts` (lines 235, 256)
- Impact: Executions cannot be logged to persistent database; GET endpoint returns mock data; Phase 6A implementation not started
- Fix approach: Implement proper execution logging by uncommenting and completing the Convex mutations that persist execution logs to the `executionLog` table; create Phase 6A subtasks for real HTTP dispatch and polling

### OpenClaw Sub-agent Integration Mocked
- Issue: Task execution spawns OpenClaw sub-agents via mock function (`spawnOpenClawSubagent`); actual HTTP call is commented out
- Files: `frontend/src/app/api/tasks/execute/route.ts` (lines 166-199, specifically lines 174-182)
- Impact: Tasks execute with simulated results; no real autonomous execution; cannot verify agent integration without completing implementation
- Fix approach: Activate real HTTP POST to `${OPENCLAW_GATEWAY_URL}/api/sessions/spawn`; add real-time polling for completion; integrate authorization headers for OpenClaw gateway

### Memory Service Returns Empty or Mock Data
- Issue: MemoryService has 8 TODO comments; all search methods return empty arrays; goal retrieval returns hardcoded placeholder data
- Files: `frontend/src/services/memory/MemoryService.ts` (lines 97-240)
- Specific TODOs:
  - Line 97: Goal retrieval not implemented
  - Line 149: Semantic search across memory systems not implemented
  - Line 187: Goal progress updates not persisted
  - Line 220, 225, 230, 235: Conversation/decision/research/goal search all return []
  - Line 240: getRecentDecisions returns []
  - Line 274, 285: Decision and insight storage not persisted
- Impact: AI agents cannot access historical context, decisions, or goals for task generation; strategic planning lacks real memory integration; all searches hit dead-end returns
- Fix approach: Implement vector embedding integration for semantic search; connect to persistent memory storage layer; replace placeholder goal data with queries to actual memory tables; add storage implementations

### Cron Job Scheduling Disabled
- Issue: Internal mutation scheduling paused due to Convex internal issue
- Files: `backend/convex/cron.ts` (line 549)
- Impact: Auto-claim notifications, heartbeat monitoring, and escalation checks cannot run on schedule; manual intervention required or features silently fail
- Fix approach: Re-enable cron job after resolving Convex internal mutation scheduling issue; add feature flag for graceful degradation

### Logger Integration Unimplemented
- Issue: External logging integration is TODO placeholder
- Files: `frontend/lib/logger.ts` (line 109)
- Impact: Logs stay in console only; no central log aggregation for production monitoring; errors not captured in external system
- Fix approach: Implement integration with external logging service (Sentry, Datadog, CloudWatch, etc.)

## Known Bugs

### Schema Migration Field Duplication (businessId ↔ workspaceId)
- Symptoms: Both `businessId` (legacy string) and `workspaceId` (new ID type) coexist in schema; inconsistent field usage across codebase
- Files: `backend/convex/schema.ts` (lines 149-150, 177-178, 280-281, 326-327, 437-438, 456-457, 616-617, 650-651, 663-664)
- Trigger: Migration from single-workspace "businesses" table to multi-workspace "workspaces" table completed but legacy fields not removed; migration logic present but idempotent checks may miss partial migrations
- Workaround: Always populate both fields in mutations; query logic must handle null/undefined for either field
- Risk: Data inconsistency if some records have workspaceId and others don't; queries filtering on one field will miss records with the other; migration incomplete

### Type Safety Gaps with `as any` Casts
- Symptoms: Multiple `as any` type assertions bypass TypeScript checks
- Files:
  - `frontend/src/app/settings/members/page.tsx` (workspaceId cast)
  - `frontend/src/app/settings/invites/page.tsx` (workspaceId cast)
  - `frontend/src/app/businesses/page.tsx` (business object, err catch)
  - `frontend/src/app/workspaces/page.tsx` (multiple any casts in error handlers)
  - `frontend/src/app/gateways/page.tsx` (workspaceId, gatewayId, sortOrder casts)
- Impact: Hiding type errors; refactoring breaks go undetected; IDE autocomplete unavailable for casted values
- Fix approach: Replace `as any` with proper type assertions or type guards; improve error handling to avoid `err: any`

### RPC Timeout Detection via String Matching
- Symptoms: Error handling checks `error.message.includes('RPC call timeout')` for timeout detection
- Files: `frontend/src/app/api/gateway/[gatewayId]/route.ts` (lines 214, 280, 351, 503)
- Impact: Fragile; error message changes break timeout logic; other errors containing 'RPC call timeout' are mis-classified; no standardized error codes
- Fix approach: Create standardized error types with error codes instead of message matching

## Security Considerations

### API Key Auth Layer Not Enforced on All Endpoints
- Risk: Agent API endpoints allow requests without API key validation on some routes
- Files: `frontend/src/app/api/agents/route.ts`, `frontend/src/app/api/tasks/execute/route.ts`
- Current mitigation: POST /api/agents has auth check; POST /api/tasks/execute has no auth check
- Recommendations:
  - Add API key validation to task execution endpoint
  - Create middleware wrapper for auth-required routes
  - Log auth failures to audit trail (already in agent-auth.ts)

### AllowInsecureTls Flag in Gateway Connections
- Risk: `allowInsecureTls` disables TLS cert validation; if compromised, enables MITM attacks on WebSocket gateway connections
- Files: `frontend/src/services/gatewayRpc.ts` (line 64), `frontend/src/services/gatewayConnectionPool.ts` (line 32)
- Current mitigation: Flag must be explicitly passed; defaults to false (secure)
- Recommendations:
  - Log when allowInsecureTls=true (compliance/audit)
  - Document when this is required vs optional
  - Add timeout safeguard if TLS verification fails

### Environment Configuration
- Risk: OPENCLAW_GATEWAY_URL not validated; NEXT_PUBLIC_CONVEX_URL errors silently with generic throw
- Files: `frontend/src/app/api/tasks/execute/route.ts` (lines 14-18)
- Recommendations:
  - Add startup validation for required env vars
  - Use proper configuration validator (zod/yup)
  - Fail fast on missing critical config

## Performance Bottlenecks

### Large Component Files Without Memoization
- Problem: Components with 600+ lines lack `React.memo()` or `useMemo()` for expensive renders
- Files:
  - `frontend/src/components/EpicBoard.tsx` (852 lines)
  - `frontend/src/components/BrainHub.tsx` (791 lines)
  - `frontend/src/components/TaskDetailModal.tsx` (590 lines)
  - `frontend/src/components/CalendarView.tsx` (572 lines)
  - `frontend/src/components/AgentWorkload.tsx` (563 lines)
  - `frontend/src/components/DraggableTaskBoard.tsx` (457 lines)
- Cause: No code splitting; all modal logic in single component; re-renders entire tree on minor state changes
- Improvement path: Split into smaller memoized sub-components; implement composition; use Suspense for heavy data loads

### Gateway Connection Handshake on Every Poll
- Problem: Sessions polling (30s interval) spawns new WebSocket with 10-second handshake before connection pool was implemented
- Files: `frontend/src/services/gatewayConnectionPool.ts` (Phase 9A addresses this)
- Current status: **FIXED** - Pool keeps connections alive for 60s; now reused within polling window
- Residual concern: Pool TTL=60s means first poll after 60s idle still triggers full handshake; consider extending TTL during off-hours

### Task Mutations Without Workspace Filtering
- Problem: Large tables (tasks, epics, activities) queried without workspace filter can become slow as data grows
- Files: `backend/convex/tasks.ts`, `backend/convex/schema.ts` (indices exist but must be used)
- Improvement path: Enforce workspace filtering in all queries; add index usage enforcement in code review; monitor query latency

### OpenAPI Spec Generation is 1400+ Lines
- Problem: Single large file (`frontend/lib/openapi/spec-generator.ts`, 1427 lines) with 120+ `.meta()` calls for schema definitions
- Cause: No abstraction for schema generation; manual specification of every endpoint
- Improvement path: Extract schema generators into separate modules; create DSL for route→schema mapping; use code generation

## Fragile Areas

### Gateway Route Handler State Management
- Files: `frontend/src/app/api/gateway/[gatewayId]/route.ts` (591 lines)
- Why fragile:
  - Multiple handlers (sessions, history, message, provision, status, validate) share WebSocket/pool acquisition logic
  - RPC timeout detection is string-based
  - Connection pool is global singleton (no isolation per gateway)
  - Error handling duplicated across handlers
- Safe modification: Extract shared try/catch/finally logic into wrapper function; create handler factory; add structured error types
- Test coverage: 70/70 route + pool tests passing (Phase 9A); E2E tests exist but require gateway config

### Task State Machine Implementation
- Files: `backend/convex/utils/workflowValidation.ts` (367 lines, 7 exported functions)
- Why fragile:
  - Workflow and step state transitions defined separately
  - Cycle detection via DFS could be O(V+E) expensive on large DAGs
  - Topological sort assumes acyclic input (detects cycles but doesn't fail gracefully)
- Safe modification: Add input validation; document assumptions; consider algebraic data types for states
- Test coverage: 44/44 tests passing (Phase 10 Step 1)

### Migration System with Idempotent Checks
- Files: `backend/convex/migrations.ts` (1533 lines)
- Why fragile:
  - Idempotent by checking if table has entries (not checking field population)
  - Partial migrations (some tasks have workspaceId, others don't) will halt re-run
  - No rollback mechanism if migration partially fails
- Safe modification: Add pre-migration validation; use feature flags; implement checkpointing; add post-migration verification
- Test coverage: No migration-specific tests present

### MemoryService Singleton with Empty Implementations
- Files: `frontend/src/services/memory/MemoryService.ts` (287 lines)
- Why fragile:
  - Promises empty return values (`return []`, `return null`)
  - Calling code assumes results but gets empty collections; no error propagation
  - Hard-coded placeholder goal will cause confusion
- Safe modification: Implement actual storage; add proper error handling; remove placeholders; consider lazy initialization
- Test coverage: No unit tests for MemoryService

## Scaling Limits

### Workspace-Scoped Data Isolation Incomplete
- Current capacity: Schema supports multiple workspaces; migration logic exists; but businessId/workspaceId dualism creates query confusion
- Limit: Queries may return incorrect cross-workspace results if filtering on wrong field
- Scaling path: Complete businessId removal; enforce workspaceId in all queries via query builder or type system; add workspace-level rate limiting

### WebSocket Connection Pool Per Gateway
- Current capacity: POOL_MAX_PER_KEY=3 concurrent connections per gateway config
- Limit: Hard-coded max; no dynamic adjustment based on load
- Scaling path: Monitor pool utilization; add metrics; make POOL_MAX_PER_KEY configurable per environment; implement backpressure

### Convex Database Query Load
- Current capacity: Cron jobs (auto-claim, heartbeat, escalation) run every 60-300s against potentially large result sets
- Limit: `.collect()` loads all records into memory; no pagination on cron queries
- Scaling path: Implement cursor-based pagination in cron handlers; add index coverage analysis; monitor query latency

## Dependencies at Risk

### Convex Internal Mutation Scheduling Issue
- Risk: Cron job scheduling (line 549 in cron.ts) paused due to "Convex internal mutation scheduling" problem
- Impact: Core background tasks blocked indefinitely
- Migration plan: Track Convex issue resolution; implement alternative scheduling via external cron service if needed

### OpenClaw Integration Incomplete
- Risk: Sub-agent spawning is mocked; actual endpoint URL and auth not verified
- Impact: Task autonomy feature cannot be validated
- Migration plan: Activate real HTTP dispatch; add integration tests with test gateway

## Missing Critical Features

### Execution Logging Infrastructure
- Problem: Tasks execute but logs are disabled (TODO Phase 6A)
- Blocks: Cannot track what agents have done; no audit trail for executed tasks; cannot replay executions
- Implementation: Create `executionLog` table mutations; add polling endpoint; integrate with task status updates

### Memory System Persistence
- Problem: All memory searches return empty; goal data is hardcoded
- Blocks: AI agents cannot make context-aware decisions; strategic planning without historical data; task generation not goal-aligned
- Implementation: Connect to persistent vector database; implement embeddings; migrate hardcoded goals to real storage

### Real-time Collaboration
- Problem: No WebSocket subscriptions for live updates; polling only (30s interval on sessions)
- Blocks: Multiple users see stale task state; notifications delayed; no presence indicators
- Implementation: Add Convex subscriptions; real-time comment/task updates; presence system

## Test Coverage Gaps

### MemoryService Untested
- What's not tested: All 8 search methods; goal alignment scoring; decision storage; insight generation
- Files: `frontend/src/services/memory/MemoryService.ts`
- Risk: Placeholder implementations masked by lack of tests; refactoring breaks silently
- Priority: High (used by task generation and strategic planning engines)

### Cron Job Execution Not Tested
- What's not tested: Auto-claim notification flow; heartbeat monitoring; escalation checks
- Files: `backend/convex/cron.ts`
- Risk: Cron jobs are disabled; when re-enabled, failures unknown until production
- Priority: High (affects all background task automation)

### OpenClaw Integration Mocked in Tests
- What's not tested: Real sub-agent spawning; task result polling; error handling for real gateway
- Files: `frontend/src/app/api/tasks/execute/route.ts`
- Risk: Feature appears to work in tests; fails silently in production
- Priority: High (critical path for autonomous execution)

### Gateway Connection Pool Edge Cases
- What's not tested: Socket connection errors mid-request; pool expiration during active requests; concurrent acquisition of same cache key
- Files: `frontend/src/services/gatewayConnectionPool.ts`
- Risk: Race conditions in high-load scenarios; pool corruption if socket dies mid-release
- Priority: Medium (Phase 9A tests cover nominal path; edge cases untested)

### Workspace Migration Data Consistency
- What's not tested: Partial migration scenarios; query correctness when businessId/workspaceId both null
- Files: `backend/convex/migrations.ts`
- Risk: Silent data loss during migration; queries return incomplete results
- Priority: High (affects all multi-workspace data)

---

*Concerns audit: 2026-02-26*
