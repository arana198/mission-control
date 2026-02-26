# Testing Guide

Logic is not validated unless explicitly tested. If tests are missing, the feature is incomplete. Production stability depends on test coverage.

## Definition of Done (MANDATORY)

Before every commit:

1. **Unit tests written** for all new logic.
2. **Integration tests written** for all Convex mutations.
3. **E2E tests written** for all UI changes (use Playwright).
4. `npm test` passes (all unit/integration tests).
5. `npm run build` passes (TypeScript compilation, imports verified).
6. `npm run lint` passes.
7. `npm run validate` passes (lint + build + tests — comprehensive validation).
8. **Manual validation performed:** Run both terminals and verify the feature works in browser.

**No exceptions. Tests first. Build must pass. UI changes need E2E tests.**

## Testing Policy

- Run `npm run test:coverage` before finalizing features.
- Integration tests for Convex mutations are non-negotiable.
- A feature with missing tests is an incomplete feature, not a "fast" one.

## E2E Testing (UI Validation)

All UI changes MUST include E2E tests to prevent runtime rendering errors.

**What E2E tests cover:**
- UI components render correctly
- Navigation and routing work as expected
- Component interactions function properly
- No broken imports or compilation errors

**Writing E2E tests:**
1. Create test files in `/e2e` directory
2. Use Playwright (configured in `playwright.config.ts`)
3. Test critical user paths and component interactions
4. Example: `/e2e/business-selector.spec.ts`, `/e2e/layout.spec.ts`

**Running E2E tests:**

| Command | Purpose |
|---------|---------|
| `npm run e2e` | Run all E2E tests |
| `npm run e2e:ui` | Interactive UI mode (pause and inspect) |
| `npm run e2e:debug` | Step-through debugging |

**Why E2E tests matter:**
- Unit tests pass but page fails to render → E2E catches it
- Broken imports cause runtime errors → build catches it
- Component composition issues → E2E catches it
