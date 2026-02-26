# Convex Rules

Convex is the backend runtime. All data mutations flow through it. These rules prevent data corruption, ensure auditability, and maintain type safety.

## Schema & Data Rules

- **Any schema change requires migration** in `convex/migrations.ts`.
- **Migrations must be deterministic and documented** — include comments explaining what changed and why.
- **No breaking changes without migration scripts** — existing data must be handled gracefully.
- **All Convex mutations must have corresponding tests** — mutations are not validated unless explicitly tested.
- **Type safety is mandatory** — use Zod validation at the boundary (`convex/schema.ts`).

## Convex-Specific Rules

- **Convex functions are the single source of truth** for data mutations.
- **All state changes must go through Convex mutations** — never mutate state in React directly.
- **Seed data must be deterministic** — use `seed.ts` and `seed:all` script.
- **Sensitive operations (cron, migrations) must log comprehensively** — use Pino logger.

## High-Risk Files

Modifying these files requires comprehensive tests written first:

| File | Risk |
|------|------|
| `convex/schema.ts` | Changes affect the entire data model |
| `convex/tasks.ts` | Breakage blocks all workflows |
| `convex/migrations.ts` | Broken migrations can corrupt data |
| `convex/agents.ts` | Errors propagate across squads |
| `convex/epics.ts` | Circular dependencies must be prevented |
