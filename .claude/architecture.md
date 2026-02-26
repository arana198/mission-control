# Architecture Boundaries

This project is a Convex + Next.js full-stack application. Code belongs in exactly one layer. Do not mix concerns across boundaries.

## Frontend / UI

- `src/app/` — Next.js page routes and layouts
- `src/components/` — React components
- `src/hooks/` — Custom React hooks
- `src/styles/` — Global styles and Tailwind configuration

## Backend / Core Logic

- `convex/schema.ts` — Data model and table definitions
- `convex/tasks.ts` — Task mutation and query logic
- `convex/agents.ts` — Agent logic and operations
- `convex/epics.ts` — Epic management
- `convex/migrations.ts` — Schema migrations and deterministic updates
- `convex/` (other files) — Supporting backend functions (messages, notifications, etc.)

## Shared / Utilities

- `lib/` — Shared utilities and helpers
- `src/lib/` — Frontend utility functions
- `src/services/` — Shared service classes

## Key Rule

Before adding a new utility, search `lib/` and `src/lib/` first — no duplication.
