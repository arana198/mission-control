# Architecture

**Analysis Date:** 2025-02-25

## Pattern Overview

**Overall:** Layered full-stack with Convex backend + Next.js frontend + distributed gateway communication.

**Key Characteristics:**
- Multi-workspace, single-instance SaaS architecture
- Real-time agent orchestration with WebSocket communication
- Reactive frontend powered by Convex hooks (useQuery, useMutation)
- Kanban-based task management with dependency validation
- Error standardization via ApiError wrapper
- Gateway connection pooling to reduce WebSocket overhead

## Layers

**Frontend (React/Next.js):**
- Purpose: User-facing interface for workspace management, task boards, agent monitoring
- Location: `src/app/`, `src/components/`, `src/hooks/`, `src/contexts/`
- Contains: Page routes, UI components, custom hooks, context providers
- Depends on: Convex queries/mutations, Next.js routing, TailwindCSS
- Used by: Browser clients (no direct backend dependencies)

**API Routes (Next.js Server Functions):**
- Purpose: HTTP handlers that bridge frontend to Convex and external services (gateways, agents)
- Location: `src/app/api/`
- Contains: Route handlers for agents, tasks, gateway communication, admin operations
- Depends on: Convex client, services (gatewayRpc, agentProvisioning, memory), WebSocket pools
- Used by: Frontend fetch calls, external webhooks, agents via HTTP polling

**Backend Data Layer (Convex):**
- Purpose: Real-time database with mutations and queries for single source of truth
- Location: `convex/`
- Contains: Schema definition, mutations, queries, utilities
- Depends on: Zod validators, task transition rules, cycle detection
- Used by: Frontend (via hooks), API routes (via HTTP client), migrations

**Services (Shared Utilities):**
- Purpose: Reusable logic for gateway communication, agent provisioning, error handling
- Location: `lib/`, `src/services/`
- Contains: Error handling (ApiError, retries), gateway RPC, agent provisioning, validators
- Depends on: ws (WebSocket), Zod (validation)
- Used by: API routes, Convex mutations, frontend hooks

**Infrastructure & Configuration:**
- TypeScript strict mode, path aliases (@/), module-level singletons (gatewayPool)
- Convex schema as authority for data model
- Workspace-scoped all mutations for multi-tenant isolation

## Data Flow

**User Creates Task:**

1. Frontend: User fills task form in `src/components/dashboard/` → calls Convex `tasks.createTask` mutation
2. Convex: `convex/tasks.ts` validates via `validateTaskInput()` → detects circular dependencies via `detectCycle()` → checks epic link → infers tags → writes to `tasks` table → logs to `activities`
3. Frontend: Convex hook updates local cache → component re-renders with new task

**Agent Polls for Work:**

1. Backend: Agent makes HTTP GET to `src/app/api/agents/[agentId]/tasks/`
2. API Route: Queries Convex for tasks assigned to agent via `api.tasks.getForAgent` → filters by status
3. Frontend: Convex client returns task batch → agent webhook response includes work item
4. Agent: Executes task → calls back via `/agents/[agentId]/tasks/[taskId]/status` to update status

**Gateway Session Management:**

1. Frontend: `useGatewaySessions` hook polls `/api/gateway/[gatewayId]?action=sessions` every 30s
2. API Route: `handleGetSessions()` → acquires WebSocket from `gatewayPool` → calls `sessions.list` RPC
3. Gateway: Returns active session list with `lastActivity` timestamp
4. Frontend: Component renders sessions with dynamic status badges (active/idle/inactive) based on timestamp thresholds

**State Management:**

- **Frontend State:** React useState for UI state (panels, selected tasks), Convex hooks for server state
- **Backend State:** Convex tables (tasks, agents, workspaces) with automatic subscription via useQuery
- **Cache:** Gateway WebSocket connection pool (60-second TTL) to avoid handshake overhead on 30-second polls
- **Persistence:** All mutations write to Convex tables; migrations handle schema changes

## Key Abstractions

**ApiError:**
- Purpose: Standardized error responses with request IDs and error codes
- Examples: `ApiError.notFound()`, `ApiError.validation()`, `ApiError.conflict()`
- Pattern: Wrapped in `wrapConvexHandler` for mutations to auto-catch and format errors
- Files: `lib/errors/ApiError.ts`, `lib/errors/convexErrorHandler.ts`

**Task Validation:**
- Purpose: Enforce title/description length, priority values, epic/assignee requirements
- Pattern: Zod schemas (`CreateTaskSchema`, `UpdateTaskSchema`) applied before Convex writes
- Files: `lib/validators/taskValidators.ts`
- Ensures: No invalid data enters database; clear error messages on validation failure

**Cycle Detection (Graph Validation):**
- Purpose: Prevent circular task dependencies that would deadlock execution
- Pattern: DFS algorithm in `detectCycle()` that traverses dependency graph
- Files: `convex/utils/graphValidation.ts`, tests: `convex/utils/__tests__/graphValidation.test.ts`
- When used: Before `tasks.createTask` and `updateDependencies` mutations

**Gateway Connection Pool:**
- Purpose: Reuse WebSocket connections across API requests to avoid 10-second handshake per request
- Pattern: Module-level singleton `gatewayPool` with acquire/release lifecycle
- Files: `src/services/gatewayConnectionPool.ts`
- Benefits: Reduces latency for 30-second polling; max 3 concurrent connections per gateway config

**Workspace Scoping:**
- Purpose: Multi-tenant isolation where all mutations require workspaceId
- Pattern: Every mutation validates workspace exists before writing
- Files: `convex/tasks.ts`, `convex/agents.ts`, `convex/workspaces.ts`
- Ensures: Data from one workspace never leaks to another

## Entry Points

**Frontend:**
- Location: `src/app/page.tsx`
- Triggers: Browser navigation to `/`
- Responsibilities: Redirects to default workspace overview via `useRouter`; shows loading skeleton while fetching workspace data

**Layout Root:**
- Location: `src/app/layout.tsx` (Server) → `src/app/ClientLayout.tsx` (Client)
- Triggers: All page routes wrap in this layout
- Responsibilities: Provider setup (Convex, Theme, Workspace), sidebar navigation, header with notifications

**API Handlers:**
- Location: `src/app/api/[resource]/[...routes]/route.ts`
- Triggers: Frontend fetch calls, agent webhooks, external cron jobs
- Responsibilities: Parse request → call Convex/services → return JSON response

**Convex Queries:**
- Entry: `api.tasks.getForAgent`, `api.workspaces.getAll`, `api.agents.getAllAgents`
- Called via: Frontend `useQuery` hooks, API routes via ConvexHttpClient
- Returns: Filtered/sorted data for UI or webhook responses

## Error Handling

**Strategy:** Standardized ApiError wrapper with request IDs for traceability.

**Patterns:**

1. **Validation Errors (HTTP 400):**
   - Source: Zod schema failure in validators
   - Response: `{ error: string, code: "VALIDATION_ERROR", fields: Record<string, string> }`
   - Example: `convex/tasks.ts` line 92 validates input before mutation

2. **Not Found Errors (HTTP 404):**
   - Source: Agent/workspace/task lookup fails
   - Response: `{ error: "Agent not found", code: "NOT_FOUND" }`
   - Example: `convex/agents.ts` line 60 throws `ApiError.notFound("Agent")`

3. **Circular Dependency Errors (HTTP 409):**
   - Source: `detectCycle()` returns true before task creation
   - Response: `{ error: "Circular dependency detected", code: "CONFLICT" }`
   - Example: `convex/tasks.ts` calls cycle detection before write

4. **Gateway Connection Errors (HTTP 503):**
   - Source: WebSocket connection fails or timeout
   - Fallback: Return cached data if pool has idle connection; retry with exponential backoff
   - Pattern: `withRetry` wrapper in retryStrategy

5. **Rate Limit Errors (HTTP 429):**
   - Source: Agent heartbeat limit exceeded
   - Pattern: `enforceRateLimit()` in `convex/utils/rateLimit.ts`
   - Enforcement: Per-agent limits to prevent DOS

## Cross-Cutting Concerns

**Logging:**
- Approach: Pino logger in backend (server) and console.log in frontend
- Files: Backend uses Pino instances; frontend uses browser console
- Pattern: `resolveActorName()` in `convex/utils/activityLogger.ts` logs who made the change (agent vs user)

**Validation:**
- Approach: Zod schemas at boundary (Convex mutations, API routes)
- Files: `lib/validators/` exports CreateTaskSchema, UpdateTaskSchema, etc.
- Pattern: `validateTaskInput()` called first in mutation before any database operations

**Authentication:**
- Approach: Agent API keys stored in `agents.apiKey` field; workspace isolation via parameter
- Files: `lib/auth/` for middleware, agent key rotation via `/api/agents/[agentId]/rotate-key`
- Pattern: No explicit user auth yet (system-to-system); workspace ID acts as scope boundary

**Workspace Context:**
- Approach: React Context API `WorkspaceProvider` wraps entire app
- Files: `src/components/WorkspaceProvider.tsx` provides `useWorkspace()` hook
- Pattern: Reads from URL params, localStorage, or defaults to first workspace; all routes include workspace in path: `/:workspaceSlug/:tab`

---

*Architecture analysis: 2025-02-25*
