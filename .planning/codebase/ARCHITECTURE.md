# Architecture

**Analysis Date:** 2026-02-26

## Pattern Overview

**Overall:** Monorepo Full-Stack with Layered Backend + Frontend Separation

**Key Characteristics:**
- Monorepo structure (`npm workspaces`) with two isolated packages: `@mission-control/backend` (Convex) and `@mission-control/frontend` (Next.js)
- Clear architectural boundary: frontend can only import from `@/convex/_generated/api` (typed API surface), NOT backend implementation
- Three-tier backend: schema → queries/mutations → utility logic
- Real-time sync via Convex with WebSocket connection pooling for gateway integrations
- Multi-tenant workspace support with role-based access control

## Layers

**Backend (Convex):**
- Purpose: Real-time database, server functions, authentication
- Location: `backend/convex/`
- Contains: Schema definitions, queries, mutations, actions, internal logic
- Depends on: Convex SDK, Zod validators, utility modules
- Used by: Frontend via Convex HTTP client, external agents via HTTP API

**Library Layer (Backend):**
- Purpose: Shared utilities, validators, error handling, auth logic
- Location: `backend/lib/`
- Contains: `validators/`, `errors/`, `auth/`, `constants/`, `utils/`
- Depends on: Convex types, Zod
- Used by: All Convex functions for standardization

**Frontend (Next.js):**
- Purpose: UI rendering, client state, user interactions
- Location: `frontend/src/`
- Contains: React components, pages, hooks, contexts, utility services
- Depends on: Convex client, React, TailwindCSS, utility libraries
- Used by: Browser clients, agents via API endpoints

**Services Layer (Frontend):**
- Purpose: Business logic, API integration, state synchronization
- Location: `frontend/lib/services/` and `frontend/src/services/`
- Contains: Task generation, execution scaling, strategic planning, calendar sync
- Pattern: Service classes with methods for domain operations

**API Routes (Frontend):**
- Purpose: HTTP endpoints for agent integration, webhook handlers
- Location: `frontend/src/app/api/`
- Contains: Gateway integration, task execution, calendar operations, business logic
- Pattern: Next.js dynamic routes with query parameter-based action dispatch

## Data Flow

**Mutation Flow (Task Creation):**

1. Frontend component calls `api.tasks.createTask()` via Convex client
2. `backend/convex/tasks.ts:createTask` mutation handler receives validated input
3. Validation via `backend/lib/validators/taskValidators.ts`
4. Rate limit check via `backend/convex/utils/rateLimit.ts`
5. Task document inserted into Convex database
6. Activity logged via `backend/convex/utils/activityLogger.ts`
7. Real-time subscription pushes update to all connected clients
8. Frontend re-renders via Convex reactive hook

**Agent Execution Flow (Gateway Sessions):**

1. Frontend requests sessions: `GET /api/gateway/[gatewayId]?action=sessions`
2. Route handler `frontend/src/app/api/gateway/[gatewayId]/route.ts`
3. Connection pooled via `frontend/lib/services/gatewayConnectionPool.ts` (POOL_MAX_PER_KEY=3)
4. Reuses WebSocket connection from `frontend/lib/services/gatewayRpc.ts`
5. RPC call to gateway backend service
6. Sessions array returned with timestamps
7. Response cached and sent to frontend
8. If timeout detected: `ws.terminate()` and pool releases connection

**Workflow Execution Flow (Multi-Agent):**

1. Workflow definition stored in `backend/convex/schema.ts:workflows.definition`
2. DAG structure: `{ nodes: { [nodeId]: { agentId, taskTemplate } }, edges: { [fromNodeId]: [toNodeId] } }`
3. Validation via `backend/convex/utils/workflowValidation.ts:validateWorkflowDefinition()`
4. Execution tracked in `workflow_executions` table with node execution mapping
5. Step advancement via `advanceWorkflowStep()` - auto-merges previous step's outputData into next inputData
6. Multiple concurrent executions allowed per workflow (no serial blocking)

**State Management:**

- Convex reactive queries: all components using `useQuery(api.*)` auto-sync with database
- Local task optimizations: `frontend/lib/optimisticUpdates.ts` for instant UI feedback
- Advanced caching: `frontend/lib/advancedCache.ts` with TTL and invalidation
- Gateway session state: transient (not persisted), pooled across requests

## Key Abstractions

**Agents:**
- Purpose: 10-agent squad with distinct roles (lead, specialist, intern)
- Examples: `backend/convex/agents.ts`, `backend/convex/agentLifecycle.ts`
- Pattern: Document-based with session keys and heartbeat tracking

**Tasks:**
- Purpose: Work items with epic grouping, tags, priorities
- Examples: `backend/convex/tasks.ts`, `backend/lib/validators/taskValidators.ts`
- Pattern: Kanban-style state machine (pending → in_progress → done/blocked)

**Epics:**
- Purpose: Strategic initiatives grouping related tasks
- Examples: `backend/convex/epics.ts`
- Pattern: Workspace-scoped collections with task linkage

**Workflows:**
- Purpose: Multi-agent pipelines with DAG execution
- Examples: `backend/convex/utils/workflowValidation.ts`, schema at `backend/convex/schema.ts:workflows`
- Pattern: Pure DAG validation + state machine for transitions

**Gateways:**
- Purpose: External service connection management (OpenClaw, webhooks)
- Examples: `backend/convex/gateways.ts`, `frontend/lib/services/gatewayConnectionPool.ts`
- Pattern: Connection pooling with RPC communication

**Executions:**
- Purpose: Immutable audit trail of all agent actions
- Examples: `backend/convex/executions.ts`, `backend/convex/utils/activityLogger.ts`
- Pattern: Append-only event log with tokens/cost tracking

## Entry Points

**Backend - Convex Functions:**
- Location: `backend/convex/` (39 root mutation/query files)
- Triggers: Convex client calls from frontend, HTTP API from agents, scheduled cron jobs
- Responsibilities: Data mutations, validation, authorization, audit logging

**Frontend - Next.js App:**
- Location: `frontend/src/app/`
- Triggers: User browser navigation, WebSocket real-time updates
- Responsibilities: Rendering UI, managing local state, calling Convex mutations

**Frontend - API Routes:**
- Location: `frontend/src/app/api/`
- Triggers: HTTP requests from agents, external webhooks
- Responsibilities: Gateway integration, task execution, calendar sync

**Scheduled Tasks:**
- Location: `backend/convex/cron.ts`
- Triggers: Time-based via Convex cron
- Responsibilities: Metrics aggregation, cleanup, workflow triggers

## Error Handling

**Strategy:** Standardized ApiError class with HTTP status mapping

**Patterns:**
- All Convex mutations wrapped with `wrapConvexHandler()` from `backend/lib/errors/index.ts`
- Errors thrown as `ApiError` with codes: `VALIDATION_ERROR` (422), `NOT_FOUND` (404), `CONFLICT` (409), `FORBIDDEN` (403), `LIMIT_EXCEEDED` (429), `INTERNAL_ERROR` (500)
- Each error includes unique `requestId` for tracing
- Retryable errors marked (transient): `SERVICE_UNAVAILABLE`, `LIMIT_EXCEEDED`
- API route handlers catch and serialize to JSON with error code + message + requestId
- Frontend services catch errors and log via `frontend/lib/monitoring.ts`

## Cross-Cutting Concerns

**Logging:**
- Backend: Pino logger via `backend/convex/utils/activityLogger.ts` - logs agent actions as `activities` table documents
- Frontend: Console logging + `frontend/lib/logger.ts` - debug logs with timestamps

**Validation:**
- Backend: Zod schemas in `backend/lib/validators/` - all inputs validated before mutations
- Frontend: Same Zod schemas reused for form validation
- Task validation: `taskValidators.ts`, agent task validation: `agentTaskValidators.ts`

**Authentication:**
- Backend: API key auth for agents (`agents.apiKey` field), Convex HTTP client for frontend
- Frontend: Session-based via Convex auth context
- Route-level: `canDeleteTask()` permission check in `backend/lib/auth/permissions.ts`

**Rate Limiting:**
- Backend: `backend/convex/utils/rateLimit.ts` with `enforceRateLimit()` (throws) and `checkRateLimitSilent()` (no error)
- Examples: 10 tasks/min per creator, 6 heartbeats/min per agent
- Stored as transient cache entries in Convex

**Performance Optimization:**
- Connection pooling: `gatewayConnectionPool.ts` (POOL_TTL_MS=60s, max 3 per cache key)
- Query indexing: Multi-field indexes on frequently filtered columns (e.g., `by_agent_time`, `by_status_time`)
- Denormalization: Agent names/roles stored in executions and metrics for N+1 prevention
- Batch operations: `backend/convex/utils/batchDelete.ts` for cleanup

---

*Architecture analysis: 2026-02-26*
