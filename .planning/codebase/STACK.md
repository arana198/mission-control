# Technology Stack

**Analysis Date:** 2026-02-26

## Languages

**Primary:**
- TypeScript 5.4.0 - Full codebase: backend Convex functions, Next.js frontend, API routes
- JavaScript (Node.js) - Build scripts, configuration files
- JSX/TSX - React components in frontend (`frontend/src/components/`, `frontend/src/app/`)

**Secondary:**
- Bash - DevOps scripts (`scripts/setup-agents.sh`, etc.)

## Runtime

**Environment:**
- Node.js 18.0.0+ (required per `package.json` engines field)
- No `.nvmrc` file present - relies on engine specification

**Package Manager:**
- npm 9+ (workspace support required)
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js 15.1.6 - Full-stack React framework (frontend + API routes)
  - Location: `frontend/src/app/` (App Router pattern)
  - API routes: `frontend/src/app/api/`
- Convex 1.32.0 - Backend-as-a-Service database + serverless functions
  - Location: `backend/convex/`
  - Configuration: `convex.json`
  - Schema: `backend/convex/schema.ts`

**Frontend UI:**
- React 19.0.0 - UI library
- React DOM 19.0.0 - DOM rendering
- TailwindCSS 3.4.0 - Styling framework
- Lucide React 0.400.0 - Icon library
- Tiptap 3.20.0 - Rich text editor (with extensions: tables, task lists, code blocks, links)

**Build/Dev:**
- TypeScript 5.4.0 - Type checking (`npm run build`, `npm run typecheck`)
- Autoprefixer 10.4.0 - CSS vendor prefixes
- PostCSS 8.4.0 - CSS processing
- Tailwind Merge 3.4.0 - CSS class merging utility

## Key Dependencies

**Critical:**
- `zod` 4.3.6 - Schema validation (used in API routes, Convex functions)
- `zod-openapi` 5.4.6 - OpenAPI 3.0 spec generation from Zod schemas
- `ws` 8.18.0 - WebSocket client for gateway RPC communication (`frontend/src/services/gatewayRpc.ts`)
- `swagger-ui-react` 5.31.1 - Interactive API documentation
- `swagger-ui-dist` 5.31.1 - Swagger UI static assets

**Logging & Observability:**
- `pino` 10.3.1 - Structured logging (JSON format)
- `pino-pretty` 13.1.3 - Pretty-printed logs for development

**Utilities:**
- `date-fns` 3.6.0 - Date manipulation and formatting
- `clsx` 2.1.0 - CSS class name utility
- `lowlight` 3.3.0 - Syntax highlighting for code blocks

## Development & Testing

**Testing Framework:**
- Jest 30.2.0 - Unit/integration test runner
  - Configuration: `jest.config.js`
  - Test environment: jsdom (supports both browser and Node.js tests)
  - Coverage: 50% threshold (branches, functions, lines, statements)

**Test Utilities:**
- `@testing-library/react` 16.3.2 - React component testing
- `@testing-library/dom` 10.4.1 - DOM utilities
- `@testing-library/jest-dom` 6.9.1 - DOM matchers
- `ts-jest` 29.4.6 - TypeScript support for Jest
- `jest-environment-jsdom` 30.2.0 - DOM environment
- `jest-environment-node` 30.2.0 - Node.js environment

**E2E Testing:**
- Playwright 1.58.2 (`@playwright/test`) - Browser automation
  - Configuration: `playwright.config.ts`
  - Commands: `npm run e2e`, `npm run e2e:ui`, `npm run e2e:debug`

**Linting & Code Quality:**
- ESLint 8.0.0 - JavaScript linting
- ESLint Config (Next.js) 14.0.0 - Next.js recommended rules

**Type Checking:**
- TypeScript compiler (`tsc --noEmit`) - Strict mode enabled
  - Used in build step and separate typecheck commands

## Monorepo Architecture

**Workspaces:**
- Root workspace orchestrates two packages:
  1. `@mission-control/backend` - Convex functions, pure logic utilities
  2. `@mission-control/frontend` - Next.js app, React components, API routes

**Workspace Scripts:**
- `npm run dev` - Frontend only (requires Convex backend running separately)
- `npm run build` - Frontend build only
- `npm run convex:dev` - Backend (Convex dev server)
- `npm run convex:deploy` - Deploy Convex to production
- `npm test` - Run Jest across both workspaces
- `npm run validate` - Lint + build + test (comprehensive validation)

## Path Aliases

**TypeScript Configuration** (`tsconfig.json` paths):
- `@/convex/*` → `backend/convex/*`
- `@/lib/*` → `frontend/lib/*`
- `@/types/*` → `frontend/src/types/*`
- `@/components/*` → `frontend/src/components/*`
- `@/hooks/*` → `frontend/src/hooks/*`
- `@/services/*` → `frontend/src/services/*`
- `@/contexts/*` → `frontend/src/contexts/*`
- `@/styles/*` → `frontend/src/styles/*`
- `@/*` → `frontend/*`

## Environment Configuration

**Required for Development:**
- `NEXT_PUBLIC_CONVEX_URL` - Convex deployment URL (public, used in browser)
- `CONVEX_URL` - Convex deployment URL (server-side)

**Optional for Features:**
- `OPENCLAW_GATEWAY_URL` - Gateway daemon URL for WebSocket RPC (default: `http://localhost:8000`)
- `TELEGRAM_BOT_TOKEN` - Telegram notification bot token
- `TELEGRAM_CHAT_ID` - Telegram chat for standup delivery
- `WAKE_SECRET` - Secret for `/wake` endpoint (Convex HTTP action)

**Development Optional:**
- `POLL_INTERVAL_MS` - Polling interval for daemon (default: 2000)
- `LOG_LEVEL` - Pino log level (default: info)
- `NEXT_PUBLIC_APP_NAME` - UI display name

**Configuration Files:**
- `.env.local` - Local development variables (gitignored)
- `.env.example` - Template for required env vars
- `.env.docker.example` - Docker deployment template

## Build & Deployment

**Frontend Build:**
- `npm run build` - TypeScript validation + Next.js build
- Output: `frontend/.next/` directory
- Validation: TypeScript strict mode, ESLint

**Backend Build:**
- `npm run convex:deploy` - Deploy Convex functions to production
- No separate build step; functions deployed directly

**Production Environment:**
- Next.js 15 deployment-ready (supports Vercel, AWS, Docker, self-hosted)
- Node.js 18+ required for runtime

## Process Management

**Optional: PM2 for Daemons**
- `npm run daemon:start` - Start background processes with PM2
- `npm run daemon:stop` - Stop background processes
- Configuration: `ecosystem.config.js`

## Dependency Overview

**Total Production Dependencies:** 17
**Total Dev Dependencies:** 21

---

*Stack analysis: 2026-02-26*
