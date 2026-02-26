# Codebase Concerns

**Analysis Date:** 2026-02-25

## Tech Debt

**Incomplete Memory Service Implementation:**
- Issue: `MemoryService` class (`src/services/memory/MemoryService.ts`) has placeholder implementations for core features. Nine critical methods return empty arrays or mock data instead of real implementations
- Files: `src/services/memory/MemoryService.ts` (lines 97, 149, 187, 220, 225, 230, 235, 240, 274, 285)
- Methods affected: `getGoals()`, `getRelevantContext()`, `updateGoalProgress()`, `searchConversations()`, `searchDecisions()`, `searchResearch()`, `searchGoals()`, `getRecentDecisions()`, `storeDecision()`, `storeInsight()`
- Impact: Any AI feature relying on goal context, historical decision search, or semantic memory will return zero results. Task generation and strategic planning cannot function properly
- Fix approach: Connect to actual persistent memory storage system. Implement vector embeddings for semantic search. Add proper database queries instead of mock returns

**Disabled Cron Job Scheduling:**
- Issue: All cron job registrations are commented out in `convex/cron.ts` (lines 551-583)
- Files: `convex/cron.ts` (lines 548-549, 551-583)
- Impact: Auto-claim tasks, agent heartbeat monitoring, escalation checks, alert evaluation, and presence cleanup do not run automatically. System relies on manual triggers via `npm run auto-claim`
- Cause: Type compatibility issue with Convex `SchedulableFunctionReference`
- Fix approach: Resolve Convex SDK type issues by reviewing recent SDK updates or using internal mutations for scheduling. Create test harness to verify cron handlers before re-enabling

**Execution Log Placeholder Logging:**
- Issue: Task execution logging uses TODO comments instead of proper `executions` table entries in three route handlers
- Files:
  - `src/app/api/tasks/[taskId]/route.ts` (line 173)
  - `src/app/api/tasks/execute/route.ts` (lines 80, 96, 124)
- Impact: Agent task execution is not logged to persistent audit trail. Observability of agent work is degraded. Phase 6A execution tracking is incomplete
- Fix approach: Implement proper `executionLog.create()` mutations with full context (model, tokens, cost, latency). Create `executions` table entries as mentioned in schema

**Silent Error Swallowing in API Handlers:**
- Issue: Five route handlers silently catch JSON parse errors with `.catch(() => ({}))`
- Files:
  - `src/app/api/tasks/generate-daily/route.ts` (line 41)
  - `src/app/api/admin/migrations/agent-workspace-paths/route.ts` (line 19)
  - `src/app/api/admin/agents/setup-workspace/route.ts` (line 19)
  - `src/app/api/agents/[agentId]/route.ts` (line 88)
  - `src/app/api/reports/route.ts` (line 71)
- Impact: Invalid JSON requests return empty objects and proceed silently. Malformed requests from agents/clients fail without diagnostic information. Debugging becomes difficult
- Fix approach: Log parse errors before returning empty object. Return 400 Bad Request with error message. Add request validation middleware

**Silent Component Catch Blocks:**
- Issue: Components swallow errors with empty catch blocks
- Files:
  - `src/components/EpicBoard.tsx` (line 622)
  - `src/components/NotificationPanel.tsx` (lines 14, 113)
- Impact: Component failures go unlogged. Bugs in dragging, loading notifications, or epic operations are invisible to error monitoring. Failed mutations don't surface to user or developer
- Fix approach: Log errors to console or error tracking service. Display user-friendly error toast/notification. Preserve error context for debugging

## Known Bugs

**Gateway Connection Pool Race Condition:**
- Symptoms: Multiple concurrent requests to same gateway may create multiple connections despite pool caching
- Files: `src/services/gatewayConnectionPool.ts` (lines 61-120)
- Trigger: Rapid successive HTTP requests to same gateway within 60ms before first `release()` is called
- Root cause: No mutex/lock protecting `acquire()` and `release()` operations on `this.pool` map
- Workaround: Pool provides eventual consistency - second request will find socket within 60ms if first is slow
- Test coverage: `src/services/__tests__/gatewayConnectionPool.test.ts` lacks race condition tests (concurrent acquire stress test needed)

**TypeScript `as any` Casts Bypass Type Safety:**
- Symptoms: Type errors hidden at runtime, incorrect assumptions about object shapes
- Files:
  - `src/services/gatewayConnectionPool.ts` (line 201) - accessing private pool map
  - `src/services/gatewayRpc.ts` (lines 98, 111, 151, 174) - WebSocket event handler casting
  - `convex/activities.ts` (lines 23, 83, 162) - query index callback typing
  - `convex/agents.ts` (lines 38, 45, 184, 415) - query builder typing
  - 40+ additional locations across codebase
- Impact: Type checker cannot catch shape mismatches. If schema changes, code breaks silently at runtime
- Fix approach: Create proper TypeScript interfaces for query callbacks. Use generic types instead of `any`. Run strict TypeScript checks (`noImplicitAny`, `strict` mode)

**Unsafe WebSocket Event Handler Registration:**
- Symptoms: Messages lost if handler is removed before response arrives
- Files: `src/services/gatewayRpc.ts` (lines 94-111, 155-174)
- Problem: Event listener added for message reception, but timeout may fire before cleanup. Message handler removed by `removeEventListener` before checking response ID
- Risk: High-latency responses may arrive after timeout fires, message discarded
- Safe pattern exists in same file but not universally applied
- Fix approach: Use WeakMap to track all pending requests. Central cleanup function. Consider request queue pattern

## Security Considerations

**Insecure TLS Disabled for Gateway Connections:**
- Risk: Man-in-the-middle attacks possible when `allowInsecureTls` flag is enabled
- Files: `src/services/gatewayRpc.ts` (line 64)
- Current mitigation: Flag is opt-in (`disableDevicePairing` default false). Used only for local development/testing
- Recommendations:
  - Only enable in non-production environments. Add compile-time check to reject in production builds
  - Document that `allowInsecureTls: true` should never be used in production
  - Add warning log when insecure TLS is enabled
  - Consider using environment-based feature flags

**Missing API Authentication on Gateway Endpoints:**
- Risk: Any client can call `POST /api/gateway/[gatewayId]?action=provision` to set up agents without authorization checks
- Files: `src/app/api/gateway/[gatewayId]/route.ts` (lines 119, 200-350)
- Current state: No auth guard before `handleProvision()`. No workspace permission checks
- Impact: Unauthorized users can provision agents, create workspace agents, modify gateway configuration
- Recommendations:
  - Add `verifyAuth()` check at start of GET/POST handlers
  - Verify requester has admin permission in target workspace
  - Log all provision/sync operations with user ID
  - Rate-limit provision endpoint to prevent abuse

**Environment Variable Exposure Risk:**
- Issue: `NEXT_PUBLIC_CONVEX_URL` is public, but actual Convex API keys and gateway tokens may be in environment
- Files: `src/app/api/gateway/[gatewayId]/route.ts` (line 21)
- Current: Code correctly checks for presence, but no validation that secrets are stored safely
- Recommendations:
  - Audit `.env` files for unencrypted secrets
  - Use Convex's built-in secret management
  - Never log gateway tokens or API keys
  - Rotate gateway tokens on schedule

## Performance Bottlenecks

**MemoryService Keyword Matching is O(n×m):**
- Problem: `getGoalAlignment()` method performs linear scan of all goals with substring matching
- Files: `src/services/memory/MemoryService.ts` (lines 197-203)
- Cause: No indexing, full text search, or caching of goal metadata
- Current: Works fine for <100 goals. With 1000+ goals per workspace, becomes noticeably slow
- Improvement path:
  - Add search index on goal title/description (Convex full-text search)
  - Cache goal metadata in memory with TTL
  - Use semantic embeddings instead of keyword matching (requires vector DB)

**Cron Handler Load on Ready Tasks Query:**
- Problem: `autoClaimCronHandler` fetches ALL ready tasks every 60 seconds, then iterates all assignees
- Files: `convex/cron.ts` (lines 40-44, 55-60)
- Impact: Scales as O(ready_tasks × assignees_per_task). With 100 ready tasks × 5 assignees = 500 notifications per run
- Scaling limit: Beyond 500 active ready tasks, cron handler may timeout before completing
- Improvement path:
  - Page results using batch queries
  - Add index on task status to speed initial fetch
  - Debounce notifications (don't notify if agent already has wake request pending)
  - Consider pub/sub model instead of polling

**Large Component Re-renders Not Memoized:**
- Problem: `EpicBoard.tsx` (852 lines), `BrainHub.tsx` (791 lines), `CreateTaskModal.tsx` (606 lines) render without memoization
- Files: `src/components/EpicBoard.tsx`, `src/components/BrainHub.tsx`, `src/components/CreateTaskModal.tsx`
- Impact: Parent re-renders cause full child re-render. Modal dialogs flash/stutter on state updates
- Scaling limit: With 500+ tasks and 20+ agents, board becomes sluggish (>200ms rerender)
- Improvement path:
  - Wrap components with `React.memo()` where props are stable
  - Use `useMemo()` for computed lists (filtered, sorted tasks)
  - Split into smaller components with stable keys
  - Add render profiling to identify hot paths

**Migration Batch Processing Not Paginated:**
- Problem: `migrationMultiSupport()` calls `.collect()` on entire task/epic/activity tables
- Files: `convex/migrations.ts` (lines 54, 66, 78, 90)
- Impact: Collects all rows into memory at once. With 100,000 tasks, causes OOM or timeout
- Scaling limit: Maximum ~50,000 documents before timeout/memory issues
- Fix approach: Use pagination with batch size. Process in chunks of 1000. Add progress tracking

## Fragile Areas

**Task Completion Flow (High Risk):**
- Files: `convex/tasks.ts` (1981 lines), `src/app/api/tasks/[taskId]/route.ts` (453 lines), `convex/utils/executionLogic.ts` (565 lines)
- Why fragile:
  - Epic/task sync logic (`syncEpicTaskLink()`) called without comprehensive tests
  - Status transition validation uses simple string comparison, not state machine
  - Completion notes stored in separate field; if not synced, historical context lost
- Safe modification:
  - Add E2E test for complete task workflow: create task → assign → claim → complete
  - Add validation for status transitions before mutation
  - Mock external dependencies (epic sync, execution log) in unit tests
- Test coverage gaps:
  - No test for completing task with time tracking
  - No test for task completion triggering epic progress update
  - No test for concurrent completion attempts (race condition)

**Gateway RPC Message Handling (High Risk):**
- Files: `src/services/gatewayRpc.ts` (200+ lines)
- Why fragile:
  - Message handler closure captures variables in nested Promise scopes
  - No deduplication if response comes after timeout
  - WebSocket event listeners not cleaned up if connection dies between calls
  - Manual UUID generation fallback if crypto.randomUUID unavailable
- Safe modification:
  - Add comprehensive logging of all RPC calls/responses
  - Test timeout scenarios: response arrives after timeout fires
  - Test connection drop during in-flight RPC call
  - Mock WebSocket to simulate all edge cases
- Test coverage gaps:
  - No test for timeout scenario
  - No test for connection drop mid-call
  - No test for overlapping requests with same handler

**Schema Migrations (Critical Risk):**
- Files: `convex/migrations.ts` (1568 lines), `convex/schema.ts` (1375 lines)
- Why fragile:
  - `migrationMultiSupport()` is idempotent but no rollback mechanism
  - Batch processing uses client-side filtering instead of server-side query indexing
  - No validation that migration succeeded (e.g., workspaceId exists on all records after migration)
  - Changes to schema require corresponding migration logic
- Safe modification:
  - Create dry-run mode that logs changes without persisting
  - Add post-migration validation queries
  - Create rollback function that reverts fields to previous values
  - Document migration impact before running
- Test coverage gaps:
  - No test for partial migration (failure mid-batch)
  - No test for data consistency after migration (missing workspaceId)
  - No test for migration with concurrent mutations happening

**Gateway Provisioning Flow (High Risk):**
- Files: `src/app/api/gateway/[gatewayId]/route.ts` (554 lines), `src/services/agentProvisioning.ts`
- Why fragile:
  - `handleProvision()` calls 7-step setup without transaction guarantees
  - Network failure between steps leaves partial state (agent created but files not uploaded)
  - No timeout or heartbeat during long provisioning operations
  - No rollback if setup fails partway through
- Safe modification:
  - Add comprehensive error handling with cleanup steps
  - Create idempotent provision operation (check what's already done before repeating)
  - Add provisioning state machine with explicit state transitions
  - Test each step in isolation
- Test coverage gaps:
  - No test for network failure mid-provision
  - No test for idempotent provision (calling twice with same params)
  - No test for provision with existing agent (should skip or update)

## Scaling Limits

**WebSocket Connection Pool Resource Exhaustion:**
- Current capacity: 3 concurrent connections per gateway config (POOL_MAX_PER_KEY)
- Limit: If 4+ clients hit same gateway simultaneously, 4th client opens new connection instead of reusing
- Scaling path:
  - Increase POOL_MAX_PER_KEY to 5-10 (measure connection overhead)
  - Implement connection queuing instead of fixed max
  - Add metrics to track pool utilization and connection reuse rates

**Execution Audit Trail Growth:**
- Current: Every task completion creates an execution log entry
- Limit: With 1000 tasks/day, 365,000 rows/year. Query performance degrades around 1M rows
- Scaling path:
  - Implement log archival (move old entries to cold storage quarterly)
  - Add TTL to execution logs (keep 90 days, archive 1 year)
  - Use separate database for execution logs (time-series DB like ClickHouse)
  - Add aggregation table for daily execution stats

**In-Memory Component State:**
- Current: Large components (EpicBoard, BrainHub) keep full task/epic/agent lists in React state
- Limit: Beyond 500 agents × 1000 tasks = 500K state objects, memory pressure becomes visible
- Scaling path:
  - Virtualize lists (render only visible items)
  - Move state to server cache (Convex queries with pagination)
  - Implement infinite scroll instead of loading all at once
  - Use IndexedDB for local caching of large datasets

**Notification Queue:**
- Current: Cron creates 1 notification per (task, assignee) pair
- Limit: Beyond 500 ready tasks × 20 assignees = 10K notifications/minute, queue backs up
- Scaling path:
  - Batch notifications by agent
  - Implement notification digest instead of individual messages
  - Add queue system (Bull, RabbitMQ) for async processing
  - Implement notification deduplication (don't notify for same task twice in 5 minutes)

## Dependencies at Risk

**Convex SDK Type Compatibility:**
- Risk: Cron job scheduling disabled due to type mismatch with `SchedulableFunctionReference`
- Current version: ^1.32.0
- Impact: Automated background tasks non-functional. Manual triggers required
- Migration plan: Contact Convex support for type issue. Upgrade to latest SDK. If issue persists, use internalActions with manual scheduling instead of cronJobs

**WebSocket (ws) Library Security:**
- Current: ^8.18.0
- Risk: Old versions had CVEs. Verify current version is up-to-date
- Recommendations: `npm audit` before each release. Update to ^8.18.0+ if available. Monitor security advisories

**Next.js 15 App Router Stability:**
- Current: ^15.1.6
- Risk: App Router is relatively new. Edge cases possible in dynamic routes and streaming
- Recommendations: Comprehensive E2E tests for all routes. Monitor issue tracker. Have rollback plan to Next.js 14

## Missing Critical Features

**Semantic Memory Search:**
- Problem: MemoryService cannot find relevant goals/decisions by meaning
- Blocks: AI task generation cannot understand goal context. Strategic planning guesses at priorities
- Required for:
  - Smart task suggestions aligned with business goals
  - Automated escalation based on goal priority
  - Intelligent agent assignment based on goal alignment

**Execution Cost Tracking:**
- Problem: `calculateCostLogic()` exists but never called. Cost calculations missing from execution logs
- Blocks: Cannot track agent operational costs. No cost attribution by goal/epic. Billing features impossible
- Required for:
  - Cost-per-task visibility
  - Budget alerts
  - ROI analysis for goals

**Agent Skill Matching:**
- Problem: Task assignment is manual or random (by priority/availability). No skill-based routing
- Blocks: Senior agents waste time on intern-level tasks. Complex tasks assigned to inexperienced agents
- Required for:
  - Automatic task-to-agent matching
  - Skill development tracking
  - Optimal resource allocation

**Real-Time Presence and Typing Indicators:**
- Problem: No live user presence. Cannot see who's editing task, working on epic, etc.
- Blocks: Concurrent editing causes conflicts. Users don't know who's active
- Required for:
  - Collaborative task management
  - Lock-free simultaneous editing
  - Live activity feed accuracy

## Test Coverage Gaps

**Gateway RPC Error Scenarios Untested:**
- What's not tested: Connection timeout, malformed response, partial message, network drop during RPC
- Files: `src/services/gatewayRpc.ts`, test file `src/app/api/gateway/[gatewayId]/__tests__/sessions.test.ts`
- Risk: Timeout bugs, message corruption, hanging requests go undetected until production
- Priority: High - Production deployments depend on gateway stability
- Add tests for: 30s timeout scenario, JSON.parse failure, connection close during handler

**Migration Idempotency Not Verified:**
- What's not tested: Running migration twice returns same result. Partial migration doesn't corrupt data
- Files: `convex/migrations.ts`
- Risk: Repeated migration runs cause data duplication or loss. Rollback impossible
- Priority: Critical - Schema changes affect entire database
- Add tests for: Run migration, verify state. Run again, verify unchanged. Simulate failure mid-batch

**Large Component Rendering Performance:**
- What's not tested: EpicBoard with 500+ tasks renders within <200ms. Dragging is smooth. No memory leaks
- Files: `src/components/EpicBoard.tsx`, `src/components/BrainHub.tsx`
- Risk: Board becomes unusable as data grows. Users cannot drag tasks. Memory leak causes app crash
- Priority: Medium - Affects day-to-day usability
- Add tests for: Render 100/500/1000 tasks. Measure render time. Test drag performance. Memory profiling

**API Error Handling Consistency:**
- What's not tested: Invalid JSON, missing required fields, auth failure returns consistent error format
- Files: All `src/app/api/**` route files
- Risk: Frontend error handling breaks. Inconsistent error messages confuse users and developers
- Priority: Medium - Affects debugging and UX
- Add tests for: Each handler with malformed input, missing params, auth failures

---

*Concerns audit: 2026-02-25*
