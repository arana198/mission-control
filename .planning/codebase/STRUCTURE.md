# Codebase Structure

**Analysis Date:** 2026-02-26

## Directory Layout

```
mission-control/                          # Monorepo root (npm workspaces)
├── backend/                              # Convex backend package
│   ├── convex/                           # Convex server functions
│   │   ├── schema.ts                    # Database schema (39 tables)
│   │   ├── agents.ts                    # Agent CRUD + lifecycle
│   │   ├── tasks.ts                     # Task management mutations
│   │   ├── epics.ts                     # Epic/initiative management
│   │   ├── executions.ts                # Execution audit trail
│   │   ├── workflows.ts                 # Multi-agent workflow ops (Phase 10)
│   │   ├── gateways.ts                  # External gateway management
│   │   ├── workspaces.ts                # Multi-tenant workspace ops
│   │   ├── cron.ts                      # Scheduled jobs
│   │   ├── utils/                       # Pure logic, no mutations
│   │   │   ├── workflowValidation.ts   # DAG cycle detection, topological sort
│   │   │   ├── activityLogger.ts       # Activity document creation
│   │   │   ├── graphValidation.ts      # Cycle detection for tasks
│   │   │   ├── rateLimit.ts            # Rate limit enforcement
│   │   │   └── [other utilities]
│   │   ├── tasks/                       # Task-specific functions (nested)
│   │   ├── agents/                      # Agent-specific functions (nested)
│   │   ├── epics/                       # Epic-specific functions (nested)
│   │   └── __tests__/                   # Convex function tests
│   ├── lib/                              # Backend-only utilities
│   │   ├── errors/                      # ApiError class + handlers
│   │   │   ├── ApiError.ts             # Standardized error class
│   │   │   ├── convexErrorHandler.ts   # Error wrapping utility
│   │   │   └── index.ts                # Exports wrapConvexHandler()
│   │   ├── validators/                  # Zod schemas for input validation
│   │   │   ├── taskValidators.ts       # Task input schemas
│   │   │   └── agentTaskValidators.ts  # Agent task schemas
│   │   ├── auth/                        # Authorization logic
│   │   │   └── permissions.ts          # Role-based permission checks
│   │   ├── constants/                   # Shared constants
│   │   │   ├── business.ts             # Business/workspace constants
│   │   │   └── taskTransitions.ts      # Valid state transitions
│   │   └── utils/                       # Helper utilities
│   │       └── requestId.ts            # Request ID generation
│   └── package.json                     # Backend package config (minimal deps)
│
├── frontend/                             # Next.js frontend package
│   ├── src/                              # Source code
│   │   ├── app/                         # Next.js App Router
│   │   │   ├── layout.tsx               # Root layout
│   │   │   ├── ClientLayout.tsx         # Client wrapper with sidebar
│   │   │   ├── [workspaceSlug]/         # Workspace-scoped routes
│   │   │   ├── agents/                  # Agent management pages
│   │   │   ├── gateways/                # Gateway UI pages
│   │   │   ├── api/                     # HTTP API endpoints
│   │   │   │   ├── gateway/[gatewayId]/ # Gateway integration endpoints
│   │   │   │   │   ├── route.ts        # GET/POST dispatcher
│   │   │   │   │   ├── __tests__/
│   │   │   │   │   │   ├── sessions.test.ts    # Session fetch tests
│   │   │   │   │   │   ├── provision.test.ts   # Agent provisioning tests
│   │   │   │   │   │   └── [more tests]
│   │   │   │   ├── tasks/               # Task execution endpoints
│   │   │   │   ├── calendar/            # Calendar sync endpoints
│   │   │   │   └── businesses/          # Business CRUD endpoints
│   │   │   └── workspaces/              # Workspace management
│   │   ├── components/                  # React components (78 files)
│   │   │   ├── AgentSquad.tsx           # Agent visualization
│   │   │   ├── TaskBoard.tsx            # Kanban board
│   │   │   ├── CalendarView.tsx         # Calendar integration
│   │   │   ├── BrainHub.tsx             # Knowledge base UI
│   │   │   └── [many more UI components]
│   │   ├── hooks/                       # Custom React hooks
│   │   ├── contexts/                    # React contexts
│   │   │   └── PanelContext.tsx         # Sidebar panel state
│   │   ├── types/                       # TypeScript type definitions
│   │   └── services/                    # Client-side service layer (for frontend use only, not imported by backend)
│   ├── lib/                              # Frontend utilities (SEPARATE from backend/lib)
│   │   ├── services/                    # Domain-specific services
│   │   │   ├── gatewayConnectionPool.ts # WebSocket connection pooling
│   │   │   ├── gatewayRpc.ts            # Gateway RPC communication
│   │   │   ├── executionService.ts      # Execution state management
│   │   │   ├── taskGenerationService.ts # Task generation logic
│   │   │   ├── strategicPlanningEngine.ts # Planning algorithms
│   │   │   └── [other services]
│   │   ├── validators/                  # Zod schemas (REUSED from backend)
│   │   ├── utils/                       # Utility functions
│   │   │   ├── formatting.ts            # Date/number formatting
│   │   │   └── parsing.ts               # Data parsing helpers
│   │   ├── errors/                      # Error handling utilities
│   │   ├── constants/                   # Frontend constants
│   │   ├── api-client.ts                # Convex HTTP client wrapper
│   │   ├── logger.ts                    # Client-side logging
│   │   ├── monitoring.ts                # Error monitoring
│   │   └── openapi/                     # OpenAPI spec generation
│   ├── public/                           # Static assets
│   ├── .next/                            # Build output (gitignored)
│   ├── package.json                     # Frontend package config
│   └── tsconfig.json                    # Frontend TypeScript config
│
├── e2e/                                  # Playwright E2E tests
│   ├── gateway-sessions.spec.ts         # Gateway integration tests
│   └── [more E2E test files]
│
├── jest.config.js                        # Jest configuration
├── tsconfig.json                         # Root TypeScript config with path aliases
├── package.json                          # Root workspace config
├── compose.yml                           # Docker Compose setup
├── convex.json                           # Convex deployment config
└── .claude/                              # Project instructions
    ├── CLAUDE.md                         # Constitution and guidelines
    ├── architecture.md                   # Detailed architecture guide
    └── [other .claude docs]
```

## Directory Purposes

**backend/convex/:**
- Purpose: Server-side functions (queries, mutations, actions) + schema
- Contains: 39+ module files, pure logic utilities, database definitions
- Key files: `schema.ts` (source of truth), function files by domain

**backend/lib/:**
- Purpose: Shared backend utilities NOT part of Convex runtime
- Contains: Validators, error classes, auth logic, type definitions
- Isolation: Never imported by frontend (path aliases prevent this)

**frontend/src/app/api/:**
- Purpose: HTTP API endpoints for agent integration, webhooks
- Pattern: Each file is a route handler with GET/POST methods
- Action dispatch: Uses URL search params (e.g., `?action=sessions`) to route to handlers

**frontend/src/components/:**
- Purpose: React UI components
- Scope: All "use client" components with event handlers and state
- Pattern: Named exports matching component names

**frontend/lib/services/:**
- Purpose: Business logic + integrations (NOT imported by backend)
- Examples: `gatewayConnectionPool.ts` (pooling WebSocket connections), `taskGenerationService.ts` (generating tasks from schedules)
- Pattern: Singleton instances or service classes with methods

**frontend/lib/validators/:**
- Purpose: Zod schemas for form validation
- Reuse: Same schemas imported from `backend/lib/validators/` (shared package)

## Key File Locations

**Entry Points:**
- `backend/convex/schema.ts`: Database schema (39 tables) - source of truth
- `frontend/src/app/layout.tsx`: Root Next.js layout
- `frontend/src/app/ClientLayout.tsx`: Client wrapper with sidebar navigation
- `frontend/src/app/api/gateway/[gatewayId]/route.ts`: Main gateway API endpoint

**Configuration:**
- `tsconfig.json`: Path aliases (`@/lib/*`, `@/convex/*`, etc.)
- `convex.json`: Convex project ID, OpenAI API key reference
- `jest.config.js`: Jest test runner config
- `frontend/package.json`: Build and dev scripts

**Core Logic:**
- `backend/convex/tasks.ts`: Task creation, updates, state transitions
- `backend/convex/agents.ts`: Agent CRUD, heartbeat, status tracking
- `backend/convex/utils/workflowValidation.ts`: DAG validation + state machine logic
- `backend/lib/errors/ApiError.ts`: Standardized error handling
- `frontend/lib/services/gatewayConnectionPool.ts`: WebSocket connection management

**Testing:**
- `backend/convex/__tests__/`: Convex function tests
- `frontend/src/app/api/gateway/[gatewayId]/__tests__/`: Route handler tests
- `backend/lib/validators/__tests__/`: Validator tests
- `e2e/`: Playwright E2E tests

## Naming Conventions

**Files:**
- Mutations/queries: `{domain}.ts` (e.g., `agents.ts`, `tasks.ts`)
- Utilities: camelCase (e.g., `workflowValidation.ts`, `rateLimit.ts`)
- Components: PascalCase (e.g., `AgentSquad.tsx`, `TaskBoard.tsx`)
- Tests: `{name}.test.ts` (colocated with source)
- Hooks: `use{Feature}.ts` (e.g., `useWorkspace.ts`)

**Directories:**
- Domain folders: singular noun (e.g., `agents/`, `tasks/`, `epics/`)
- Utility folders: plural (e.g., `utils/`, `services/`, `constants/`)
- Type folders: `types/`, `validators/` (functional grouping)

**Functions:**
- Mutations: create/update/delete verbs (e.g., `createTask`, `updateStatus`)
- Queries: get/fetch verbs (e.g., `getAgents`, `fetchHistory`)
- Utilities: action nouns (e.g., `validateWorkflow`, `detectCycle`)

**Components:**
- Page components: named after route (e.g., `agents.tsx` → `Agents` page component)
- Utility components: feature-based names (e.g., `AgentSquad`, `TaskBoard`)

## Where to Add New Code

**New Feature (Complete Domain):**
- Backend mutation: `backend/convex/{domain}.ts` (new file)
- Backend validator: `backend/lib/validators/{domain}Validators.ts`
- Backend utility: `backend/convex/utils/{helper}.ts`
- Tests: Colocated `__tests__` folders (same structure as source)
- Frontend page: `frontend/src/app/{route}/page.tsx`
- Frontend components: `frontend/src/components/{Feature}*.tsx`
- API endpoint: `frontend/src/app/api/{domain}/route.ts`

**New Component/Module:**
- Implementation: `frontend/src/components/{ComponentName}.tsx` for UI
- Implementation: `frontend/lib/services/{serviceName}.ts` for logic
- Tests: Colocated `__tests__/` folder

**New Utility:**
- Shared by backend/frontend: Place in `backend/lib/` + re-export to frontend via package
- Frontend-only: `frontend/lib/utils/` or `frontend/lib/services/`
- Pure logic: `backend/convex/utils/` (Convex-agnostic)

**New Validator:**
- Shared schema: `backend/lib/validators/{domain}Validators.ts` (Zod schema)
- Frontend reuse: Import via `@/lib/validators/{domain}Validators`
- Attach to mutations: `validateTaskInput(schema, input)` in mutation handler

**New API Route:**
- Location: `frontend/src/app/api/{domain}/route.ts` or `frontend/src/app/api/{domain}/[id]/route.ts`
- Pattern: Single file with GET/POST/PUT/DELETE methods
- Action dispatch: Use `const action = searchParams.get('action')` to route
- Tests: `frontend/src/app/api/{domain}/__tests__/route.test.ts`

## Special Directories

**backend/convex/_generated/:**
- Purpose: Auto-generated Convex types and API client
- Generated: Yes (by Convex CLI)
- Committed: Yes
- Do NOT edit: Types regenerated on `convex dev` restart

**frontend/.next/:**
- Purpose: Next.js build output and generated types
- Generated: Yes (by `npm run build`)
- Committed: No (gitignored)
- Do NOT edit: Regenerated on each build

**backend/convex/_generated/ vs frontend/.next/:**
- Both are auto-generated and should never be manually edited
- Both contain type definitions used throughout the project
- Both are regenerated when you run dev servers (Convex and Next.js)

**e2e/:**
- Purpose: End-to-end tests with Playwright
- Structure: One spec file per feature (e.g., `gateway-sessions.spec.ts`)
- Run: `npm run e2e` or `npm run e2e:ui` for interactive debugging

---

*Structure analysis: 2026-02-26*
