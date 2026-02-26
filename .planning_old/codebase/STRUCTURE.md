# Codebase Structure

**Analysis Date:** 2025-02-25

## Directory Layout

```
mission-control/
├── src/                           # Frontend application code
│   ├── app/                       # Next.js app router pages and layouts
│   │   ├── api/                   # HTTP route handlers (API endpoints)
│   │   ├── [workspace routes]/    # Workspace-scoped pages (overview, board, epics, etc.)
│   │   ├── layout.tsx             # Root layout (Server)
│   │   ├── ClientLayout.tsx       # Main client layout with sidebar/header
│   │   ├── page.tsx               # Root redirect to workspace overview
│   │   └── globals.css            # Global styles
│   ├── components/                # Reusable React components
│   │   ├── ui/                    # Base UI primitives (buttons, cards, modals)
│   │   ├── dashboard/             # Dashboard-specific components
│   │   ├── agent/                 # Agent management components
│   │   ├── __tests__/             # Component unit tests
│   │   ├── ConvexClientProvider.tsx
│   │   ├── WorkspaceProvider.tsx
│   │   ├── ThemeProvider.tsx
│   │   └── ErrorBoundary.tsx
│   ├── hooks/                     # Custom React hooks
│   │   ├── useGatewaySessions.ts
│   │   ├── __tests__/
│   │   └── [other hooks]
│   ├── contexts/                  # React Context definitions
│   │   └── PanelContext.ts
│   ├── services/                  # Shared services for API communication
│   │   ├── gatewayConnectionPool.ts
│   │   ├── gatewayRpc.ts
│   │   ├── agentProvisioning.ts
│   │   ├── memory/
│   │   └── __tests__/
│   ├── types/                     # TypeScript type definitions
│   ├── lib/                       # Frontend utilities
│   ├── styles/                    # Tailwind configuration
│   └── pages/                     # (Legacy Next.js Pages Router - migration in progress)
├── convex/                        # Backend: Convex database & functions
│   ├── schema.ts                  # Data model definition (tables, indexes)
│   ├── migrations.ts              # Schema migrations (deterministic updates)
│   ├── tasks.ts                   # Task CRUD & orchestration
│   ├── agents.ts                  # Agent management & status
│   ├── workspaces.ts              # Workspace CRUD
│   ├── epics.ts                   # Epic management
│   ├── calendarEvents.ts
│   ├── gateways.ts                # Gateway (external system) CRUD
│   ├── admin.ts                   # Admin utilities (clear data, setup)
│   ├── agents/                    # Agent-specific logic (subdirectory)
│   │   └── __tests__/
│   ├── tasks/                     # Task-specific logic (subdirectory)
│   │   └── __tests__/
│   ├── epics/                     # Epic-specific logic (subdirectory)
│   │   └── __tests__/
│   ├── utils/                     # Helper functions
│   │   ├── graphValidation.ts     # Cycle detection
│   │   ├── rateLimit.ts
│   │   ├── activityLogger.ts
│   │   └── __tests__/
│   ├── __tests__/                 # Convex mutation/query tests
│   └── _generated/                # Auto-generated types (do not edit)
├── lib/                           # Shared library (root-level, used by both frontend & backend)
│   ├── errors/                    # Error handling & standardization
│   │   ├── ApiError.ts
│   │   ├── convexErrorHandler.ts
│   │   ├── retryStrategy.ts
│   │   └── __tests__/
│   ├── validators/                # Zod schemas for validation
│   │   ├── taskValidators.ts
│   │   └── __tests__/
│   ├── constants/                 # Constants (task transitions, keywords, etc.)
│   │   ├── taskTransitions.ts
│   │   └── roleKeywords.ts
│   ├── auth/                      # Authentication utilities
│   ├── utils/                     # General utilities
│   ├── middleware/
│   ├── services/                  # Shared services (e.g., OpenAPI generation)
│   ├── api-client.ts              # Convex HTTP client wrapper
│   ├── api-docs-generator.ts
│   └── __tests__/
├── e2e/                           # End-to-end tests (Playwright)
│   ├── gateway-sessions.spec.ts
│   └── [other E2E tests]
├── public/                        # Static assets
├── agents/                        # External agent code (reference implementations)
├── scripts/                       # Utility scripts (cron setup, notifications, etc.)
├── convex.json                    # Convex project config
├── tsconfig.json                  # TypeScript configuration with path aliases
├── jest.config.js                 # Jest testing configuration
├── package.json                   # Project dependencies
├── next.config.js                 # Next.js configuration
├── playwright.config.ts           # Playwright E2E configuration
└── .planning/                     # GSD planning documents (this directory)
    └── codebase/
        ├── ARCHITECTURE.md
        ├── STRUCTURE.md
        ├── CONVENTIONS.md
        ├── TESTING.md
        ├── STACK.md
        ├── INTEGRATIONS.md
        └── CONCERNS.md
```

## Directory Purposes

**`src/app/`:**
- Purpose: Next.js App Router pages and API routes
- Contains: Page components (TSX), route handlers (TS), layouts
- Key files: `layout.tsx` (root), `page.tsx` (redirects), `ClientLayout.tsx` (main wrapper)

**`src/app/api/`:**
- Purpose: HTTP request handlers that bridge frontend to Convex and external services
- Contains: Route handlers for `/api/tasks/`, `/api/agents/`, `/api/gateway/`, `/api/calendar/`, etc.
- Pattern: Each resource has a `route.ts` file with GET/POST/PUT/DELETE handlers
- Key files: `src/app/api/gateway/[gatewayId]/route.ts` (gateway RPC bridge), `src/app/api/tasks/generate-daily/route.ts` (scheduled task generation)

**`src/components/`:**
- Purpose: Reusable React components
- Contains: UI primitives, dashboard panels, agent controls, wiki editors
- Key files: `ConvexClientProvider.tsx` (Convex setup), `WorkspaceProvider.tsx` (multi-workspace context), `ClientLayout.tsx` (main layout)
- Pattern: Components use `useQuery`/`useMutation` hooks directly; no props drilling for server state

**`src/hooks/`:**
- Purpose: Custom React hooks for data fetching and business logic
- Contains: Workspace queries, gateway session management, task filtering
- Key files: `useGatewaySessions.ts` (polls `/api/gateway/[gatewayId]?action=sessions` every 30s)

**`src/contexts/`:**
- Purpose: React Context definitions for cross-cutting state
- Contains: Panel state (livefeed, chat), workspace context
- Key files: `PanelContext.ts` (right panel state)

**`src/services/`:**
- Purpose: Shared service classes for API communication and external integrations
- Contains: Gateway WebSocket connection pool, agent provisioning, memory services
- Key files: `gatewayConnectionPool.ts` (connection reuse), `gatewayRpc.ts` (WebSocket RPC), `agentProvisioning.ts` (7-step agent setup)

**`convex/`:**
- Purpose: Backend database schema, mutations, and queries
- Contains: Zod-validated data model, CRUD operations, activity logging
- Key files: `schema.ts` (table definitions), `tasks.ts` (task orchestration), `agents.ts` (agent status), `migrations.ts` (schema evolution)
- Pattern: Every mutation wrapped in `wrapConvexHandler` for error standardization; every write logs to `activities` table

**`convex/utils/`:**
- Purpose: Backend helper functions
- Contains: Cycle detection, rate limiting, activity logging, batch operations
- Key files: `graphValidation.ts` (prevents circular task dependencies), `rateLimit.ts` (agent heartbeat limits)

**`lib/errors/`:**
- Purpose: Error handling and standardization
- Contains: ApiError class with codes (VALIDATION_ERROR, NOT_FOUND, etc.), retry strategies, circuit breaker
- Key files: `ApiError.ts`, `convexErrorHandler.ts` (wrapConvexHandler), `retryStrategy.ts` (exponential backoff)

**`lib/validators/`:**
- Purpose: Zod schemas for input validation
- Contains: Task creation/update schemas, field validation rules
- Key files: `taskValidators.ts` (CreateTaskSchema, UpdateTaskSchema)

**`lib/constants/`:**
- Purpose: Shared constants and enums
- Contains: Task transition rules, role keywords for tag inference, alert severities
- Key files: `taskTransitions.ts` (valid status flows), `roleKeywords.ts` (keyword → tag mapping)

**`e2e/`:**
- Purpose: End-to-end tests with Playwright
- Contains: Full user workflow tests (UI + API + database)
- Key files: `gateway-sessions.spec.ts` (test gateway polling flow)

**`.planning/codebase/`:**
- Purpose: GSD codebase mapping documents (ARCHITECTURE.md, STRUCTURE.md, etc.)
- Generated by: `/gsd:map-codebase` orchestrator command

## Key File Locations

**Entry Points:**
- `src/app/page.tsx` - Root page (redirects to workspace overview)
- `src/app/layout.tsx` - Root layout (Server Component with providers)
- `src/app/ClientLayout.tsx` - Main client layout with sidebar and header
- `convex/schema.ts` - Data model authority (all table definitions)

**Configuration:**
- `tsconfig.json` - TypeScript compiler options + path aliases (@/)
- `jest.config.js` - Jest test runner configuration
- `next.config.js` - Next.js build configuration
- `playwright.config.ts` - Playwright E2E test configuration
- `convex.json` - Convex project ID and settings

**Core Logic:**
- `convex/tasks.ts` - Task creation, updates, status transitions, dependency validation
- `convex/agents.ts` - Agent CRUD, status updates, heartbeat handling
- `convex/workspaces.ts` - Workspace CRUD, default workspace logic
- `lib/errors/ApiError.ts` - Standardized error responses
- `lib/validators/taskValidators.ts` - Input validation schemas

**Services:**
- `src/services/gatewayConnectionPool.ts` - WebSocket connection pooling (60-second TTL)
- `src/services/gatewayRpc.ts` - WebSocket RPC call abstraction
- `src/services/agentProvisioning.ts` - 7-step agent setup orchestration
- `lib/errors/convexErrorHandler.ts` - Mutation error wrapper

**Testing:**
- `convex/__tests__/` - Convex mutation/query tests
- `src/components/__tests__/` - React component unit tests
- `src/services/__tests__/` - Service tests
- `e2e/` - Playwright end-to-end tests
- `jest.config.js` - Test configuration with moduleNameMapper for @/ imports

## Naming Conventions

**Files:**
- `.ts` - TypeScript backend/utility files
- `.tsx` - React components (JSX)
- `.test.ts` / `.test.tsx` - Unit tests (co-located with source)
- `route.ts` - Next.js API route handlers
- `[id]` - Dynamic route segments (Next.js)

**Directories:**
- PascalCase for domain groupings: `src/components/dashboard/`, `src/components/agent/`
- kebab-case for feature directories: `src/app/api/admin/agents/`
- `__tests__/` for test directories (co-located with source)
- `_generated/` for auto-generated files (Convex types)

**Functions:**
- camelCase for exported functions: `createTask`, `getBySlug`, `useGatewaySessions`
- UPPERCASE for constants: `POOL_TTL_MS`, `ALLOWED_TRANSITIONS`, `ROLE_KEYWORDS`
- Prefix verb pattern: `get*`, `create*`, `update*`, `delete*`, `list*` for CRUD

**React Components:**
- PascalCase for all React component exports
- Example: `WorkspaceProvider`, `TaskBoardCard`, `GatewaySessionsPanel`

**Types & Interfaces:**
- PascalCase: `GatewaySession`, `Task`, `Workspace`, `ApiError`
- Suffix `Type` or `Props`: `PanelContextType`, `ClientLayoutProps`

## Where to Add New Code

**New Feature (Task Status Sync):**
- Primary code: `convex/tasks.ts` (add mutation), `src/app/api/tasks/[taskId]/status/route.ts` (handler)
- Tests: `convex/__tests__/tasks.test.ts`, `src/app/api/tasks/__tests__/status.test.ts`
- Validation: Add schema to `lib/validators/taskValidators.ts`

**New Component (Status Badge):**
- Implementation: `src/components/dashboard/StatusBadge.tsx`
- Tests: `src/components/__tests__/StatusBadge.test.tsx`
- Styling: Tailwind classes in component; reusable constants in `src/styles/`
- Integration: Import in parent component, add to Storybook if UI library

**New API Route (Memory Query):**
- Implementation: `src/app/api/memory/query/route.ts`
- Tests: `src/app/api/memory/__tests__/query.test.ts`
- Validation: Zod schema at top of route.ts or imported from `lib/validators/`
- Error handling: Use `ApiError` for 400/404/500 responses

**Utilities:**
- Shared helpers in `lib/utils/` if used by both frontend & backend
- Frontend-only utilities in `src/lib/`
- Validators in `lib/validators/` (imported by Convex mutations and API routes)
- Constants in `lib/constants/` (task transitions, error codes, etc.)

**Tests:**
- Unit tests: Co-locate with source file (e.g., `src/components/Modal.test.tsx` next to `Modal.tsx`)
- API tests: `src/app/api/[resource]/__tests__/route.test.ts`
- Convex tests: `convex/__tests__/[mutation].test.ts`
- E2E tests: `e2e/[feature].spec.ts`

## Special Directories

**`convex/_generated/`:**
- Purpose: Auto-generated Convex types and API bindings
- Generated: By `npx convex push` command
- Committed: Yes (needed for TypeScript types)
- Do not edit: Changes will be overwritten on next Convex push

**`node_modules/`:**
- Purpose: Installed dependencies
- Committed: No (.gitignore)
- Size: ~700MB; run `npm install` to restore

**`.next/`:**
- Purpose: Next.js build cache and compiled output
- Generated: By `npm run build` or `npm run dev`
- Committed: No (.gitignore)

**`coverage/`:**
- Purpose: Jest test coverage reports (HTML)
- Generated: By `npm run test:coverage`
- Committed: No (.gitignore)

**`.planning/`:**
- Purpose: GSD orchestrator documents (this codebase mapping)
- Committed: Yes (source of truth for implementation)
- Update: By running `/gsd:map-codebase` command

---

*Structure analysis: 2025-02-25*
