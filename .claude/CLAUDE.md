# Mission Control Constitution

---

## 1. Runtime

Development requires the following processes running simultaneously:

**Terminal 1 (Backend/Convex):**
```
npm run convex:dev
```

**Terminal 2 (Frontend/Next.js):**
```
npm run dev
```

**Strict Rule:** Frontend is NOT operational without Convex (`convex:dev`) running in Terminal 1.

---

## 2. Architecture Boundaries

**Frontend / UI:**
- `src/app/` — Next.js page routes and layouts
- `src/components/` — React components
- `src/hooks/` — Custom React hooks
- `src/styles/` — Global styles and Tailwind configuration

**Backend / Core Logic:**
- `convex/schema.ts` — Data model and table definitions
- `convex/tasks.ts` — Task mutation and query logic
- `convex/agents.ts` — Agent logic and operations
- `convex/epics.ts` — Epic management
- `convex/migrations.ts` — Schema migrations and deterministic updates
- `convex/` (other files) — Supporting backend functions (messages, notifications, etc.)

**Shared / Utilities:**
- `lib/` — Shared utilities and helpers
- `src/lib/` — Frontend utility functions
- `src/services/` — Shared service classes

---

## 3. Definition of Done (MANDATORY)

Before commit:

1. **Unit tests written** for all new logic.
2. **Integration tests written** for all Convex mutations.
3. **E2E tests written** for all UI changes (use Playwright).
4. `npm test` passes (all unit/integration tests).
5. `npm run build` passes (TypeScript compilation, imports verified).
6. `npm run lint` passes.
7. `npm run validate` passes (lint + build + tests - comprehensive validation).
8. **Manual validation performed:** Run both `npm run convex:dev` (Terminal 1) and `npm run dev` (Terminal 2) and verify the feature works as expected in browser.

**No exceptions. Tests first. Build must pass. UI changes need E2E tests.**

---

## 4. Schema & Data Rules

- **Any schema change requires migration** in `convex/migrations.ts`.
- **Migrations must be deterministic and documented** — include comments explaining what changed and why.
- **No breaking changes without migration scripts** — existing data must be handled gracefully.
- **All Convex mutations must have corresponding tests** — mutations are not validated unless explicitly tested.
- **Type safety is mandatory** — use Zod validation at the boundary (convex/schema.ts).

---

## 5. Safety Rules

- **No circular task dependencies** — validate dependency graphs before merging.
- **No duplication of utilities** — search `lib/` and `src/lib/` before adding new abstractions.
- **No speculative refactors** — only refactor when fixing a bug or adding a feature.
- **Do not modify high-risk files without comprehensive tests:**
  - `convex/schema.ts` — Changes here affect the entire data model.
  - `convex/tasks.ts` — Core task execution logic; breakage blocks all workflows.
  - `convex/migrations.ts` — Broken migrations can corrupt data.
  - `convex/agents.ts` — Agent autonomy logic; errors propagate across squads.
  - `convex/epics.ts` — Epic hierarchy; circular dependencies must be prevented.

---

## 6. Testing Policy

- **Logic is not validated unless explicitly tested.**
- **If tests are missing, the feature is incomplete.**
- **Production stability depends on test coverage.**
- Run `npm run test:coverage` before finalizing features.
- Integration tests for Convex mutations are non-negotiable.

---

## 7. Execution Principle

**Tests first. Small diffs. Deterministic changes. No speculative refactors.**

1. Write the test first (red phase).
2. Implement the feature (green phase).
3. Refactor only if needed (yellow phase, optional).
4. Run full test suite: `npm test`.
5. Run linter: `npm run lint`.
6. Manual validation on both terminals.
7. Commit with small, logical diffs.

---

## 8. Test-First Enforcement Gate

**Before implementing any feature, HALT and follow this sequence:**

1. **Identify affected modules** — Which backend mutations? Which components?
2. **Create or update tests** — Write tests for the new behavior.
3. **Confirm tests fail** (expected) — Red phase.
4. **Implement the feature** — Write the code.
5. **Confirm tests pass** — Green phase.
6. **Run the full suite** — `npm test && npm run lint`.
7. **Validate manually** — Both terminals, real user workflow.

**If tests are not written first, halt execution and restart with TDD.**

---

## 9. Convex-Specific Rules

- **Convex functions are the single source of truth** for data mutations.
- **All state changes must go through Convex mutations** — never mutate state in React directly.
- **Seed data must be deterministic** — use `seed.ts` and `seed:all` script.
- **Sensitive operations (cron, migrations) must log comprehensively** — use Pino logger.

---

## 10. Common Commands

| Command | Purpose |
|---------|---------|
| `npm run convex:dev` | Start Convex backend (Terminal 1) |
| `npm run dev` | Start Next.js frontend (Terminal 2) |
| `npm test` | Run all unit/integration tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Generate test coverage report |
| `npm run lint` | Lint code with ESLint |
| `npm run build` | Build for production (TypeScript validation) |
| `npm run validate` | Run lint + build + tests (comprehensive validation) |
| `npm run e2e` | Run E2E tests with Playwright |
| `npm run e2e:ui` | Run E2E tests with Playwright UI mode |
| `npm run e2e:debug` | Run E2E tests in debug mode |
| `npm run seed:all` | Seed all demo data |

---

## 11. E2E Testing (UI Validation)

All **UI changes MUST include E2E tests** to prevent runtime rendering errors:

**E2E Test Coverage:**
- UI components render correctly
- Navigation and routing work as expected
- Component interactions function properly
- No broken imports or compilation errors

**Writing E2E Tests:**
1. Create test files in `/e2e` directory
2. Use Playwright (configured in `playwright.config.ts`)
3. Test critical user paths and component interactions
4. Example: `/e2e/business-selector.spec.ts`, `/e2e/layout.spec.ts`

**Running E2E Tests:**
- `npm run e2e` — Run all E2E tests
- `npm run e2e:ui` — Interactive UI mode (pause and inspect)
- `npm run e2e:debug` — Step-through debugging

**Why E2E tests matter for UI:**
- Unit tests pass but page fails to render → E2E catches it
- Broken imports cause runtime errors → Build validation catches it
- Component composition issues → E2E tests catch it
- Tests + Build validation + E2E tests = Confident deployments

---

## 12. Deployment

- **Production builds must pass all tests** — `npm test && npm run build`.
- **Convex migrations are auto-applied on deploy** — ensure they are tested locally first.
- **Never force-deploy without testing migrations locally** — data corruption is irreversible.
