# Technology Stack

**Analysis Date:** 2026-02-25

## Languages

**Primary:**
- TypeScript 5.4 - Core codebase, full type safety with strict mode enabled
- JavaScript/JSX - Used for configuration files and build scripts

**Secondary:**
- Shell/Bash - Development scripts (e.g., `scripts/setup-agents.sh`)

## Runtime

**Environment:**
- Node.js 18.0.0+ (specified in `package.json` engines)
- Browser runtime: Chrome/Chromium (via Playwright E2E tests)

**Package Manager:**
- npm - Manages all dependencies
- Lockfile: `package-lock.json` (present, recommended for commits)

## Frameworks

**Core:**
- Next.js 15.1.6 - Full-stack React framework with App Router
  - Location: `src/app/` for routes, `src/components/` for UI
  - Build: Turbopack-enabled for faster development
- React 19.0.0 - Component library with hooks pattern
- React DOM 19.0.0 - DOM rendering layer

**Backend/Data:**
- Convex 1.32.0 - Real-time database and backend-as-a-service
  - Location: `convex/` directory
  - TypeScript functions (queries, mutations, actions)
  - Sync client: `ConvexReactClient` in components
  - HTTP client: `ConvexHttpClient` in API routes

**Testing:**
- Jest 30.2.0 - Unit and integration test runner
  - Config: `jest.config.js`
  - Preset: `ts-jest` for TypeScript support
  - Environments: `jest-environment-node` and `jest-environment-jsdom`
- Testing Library
  - `@testing-library/react` 16.3.2 - React component testing
  - `@testing-library/jest-dom` 6.9.1 - DOM matchers
- Playwright 1.58.2 - E2E browser testing
  - Config: `playwright.config.ts`
  - Only Chromium project configured
  - Runs against `http://localhost:3000`

**Build/Dev:**
- TypeScript 5.4 - Type checking and compilation
- ESLint 8.0.0 - Code linting with Next.js config
- Tailwind CSS 3.4.0 - Utility-first CSS framework
  - Config: `tailwind.config.js`
  - PostCSS 8.4.0 integration
- Autoprefixer 10.4.0 - Browser vendor prefix automation

## Key Dependencies

**Critical:**
- Convex 1.32.0 - Backend sync engine and real-time queries (foundation)
- Next.js 15.1.6 - Production-grade React framework with routing and API routes
- zod 4.3.6 - Runtime type validation at system boundaries
- ws 8.18.0 - WebSocket client for gateway RPC communication
  - Used in `src/services/gatewayRpc.ts` for OpenClaw gateway connections

**UI/Rich Content:**
- Tiptap 3.20.0 - Rich text editor framework
  - Extensions: code-block-lowlight, link, placeholder, table, task items
- Lucide React 0.400.0 - Icon library (480+ icons)
- clsx 2.1.0 - Dynamic className utility
- tailwind-merge 3.4.0 - Tailwind CSS class merging

**Data/Formatting:**
- date-fns 3.6.0 - Modern date manipulation library
- lowlight 3.3.0 - Syntax highlighting for code blocks

**API/Documentation:**
- swagger-ui-react 5.31.1 - Interactive API documentation viewer
- swagger-ui-dist 5.31.1 - Static files for Swagger UI
- zod-openapi 5.4.6 - OpenAPI 3.0 spec generation from Zod schemas

**Logging:**
- pino 10.3.1 - Structured JSON logging library
- pino-pretty 13.1.3 - Pretty-print formatter for development

## Configuration

**Environment:**
- `.env.local` - Runtime configuration (development)
- `.env.example` - Template for required environment variables
- `.env.docker.example` - Docker-specific configuration template
- Key vars required:
  - `NEXT_PUBLIC_CONVEX_URL` - Convex deployment URL (public)
  - `CONVEX_URL` - Convex backend URL (server-side)
  - `OPENCLAW_GATEWAY_URL` - OpenClaw gateway WebSocket endpoint
  - Optional: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (for standup notifications)

**Build:**
- `next.config.js` - Next.js configuration (Turbopack, TypeScript path)
- `tsconfig.json` - TypeScript compiler options with path aliases (`@/*`)
- `jest.config.js` - Jest test runner configuration with path mapping
- `tailwind.config.js` - Tailwind CSS customization
- `postcss.config.js` - PostCSS plugin configuration
- `playwright.config.ts` - E2E test configuration

**Development:**
- `ecosystem.config.js` - PM2 daemon process management (for notification daemon)

## Platform Requirements

**Development:**
- Node.js 18.0.0 or higher
- npm 8.0.0 or higher (for package management)
- Two concurrent terminal sessions required:
  - Terminal 1: `npm run convex:dev` (Convex backend)
  - Terminal 2: `npm run dev` (Next.js frontend on port 3000)

**Production:**
- Convex Cloud deployment (via `convex deploy`)
- Next.js deployment (Vercel, AWS, or self-hosted Node.js)
- WebSocket support (for gateway connections to OpenClaw)

## Scripts & Build System

**Development:**
- `npm run dev` - Start Next.js dev server (port 3000)
- `npm run convex:dev` - Start Convex backend locally with hot reload
- `npm test` - Run Jest unit/integration tests
- `npm run test:watch` - Jest in watch mode
- `npm run test:coverage` - Generate coverage reports (HTML, JSON)
- `npm run lint` - Run ESLint on codebase

**Build & Validation:**
- `npm run build` - Next.js production build (TypeScript compilation)
- `npm run validate` - Run lint + build + test (comprehensive CI pipeline)

**Testing:**
- `npm run e2e` - Run Playwright tests headless
- `npm run e2e:ui` - Playwright UI mode (interactive debugging)
- `npm run e2e:debug` - Step-through debugging mode

**Deployment:**
- `npm run convex:deploy` - Deploy Convex functions to production
- `npm run start` - Run Next.js production server

**Automation:**
- `npm run daemon:start` - Start PM2 notification daemon
- `npm run daemon:stop` - Stop PM2 daemon
- `npm run auto-claim` - Trigger auto-claim logic
- `npm run auto-claim:cron` - Run auto-claim via Convex cron
- `npm run morning-brief:setup` - Configure morning standup automation

## Dependency Tree Summary

```
Mission Control (Next.js + Convex)
├── Backend: Convex 1.32.0 (database + functions)
│   ├── zod (validation)
│   ├── date-fns (date utilities)
│   └── pino (logging)
├── Frontend: React 19 + Next.js 15
│   ├── Tiptap 3.20 (rich text)
│   ├── Tailwind CSS 3.4 (styling)
│   └── Lucide React (icons)
├── API/Integration:
│   ├── ws (WebSocket for gateways)
│   ├── swagger-ui (API docs)
│   └── zod-openapi (OpenAPI specs)
└── Testing:
    ├── Jest 30 + ts-jest
    ├── Playwright 1.58
    └── Testing Library 16
```

---

*Stack analysis: 2026-02-25*
