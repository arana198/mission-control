# Code Quality Rules

Tests first. Small diffs. Deterministic changes. No speculative refactors.

## Safety Rules

- **No circular task dependencies** — validate dependency graphs before merging.
- **No duplication of utilities** — search `lib/` and `src/lib/` before adding new abstractions.
- **No speculative refactors** — only refactor when fixing a bug or adding a feature.
- **Do not modify high-risk Convex files without comprehensive tests** — see [convex.md](convex.md) for the full list.

## Execution Principle (TDD Workflow)

Every feature follows this sequence — no exceptions:

1. Write the test first (red phase).
2. Implement the feature (green phase).
3. Refactor only if needed (yellow phase, optional).
4. Run full test suite: `npm test`.
5. Run linter: `npm run lint`.
6. Manual validation on both terminals.
7. Commit with small, logical diffs.

## Test-First Enforcement Gate

**Before implementing any feature, HALT and follow this sequence:**

1. **Identify affected modules** — which backend mutations? which components?
2. **Create or update tests** — write tests for the new behavior.
3. **Confirm tests fail** (expected) — red phase.
4. **Implement the feature** — write the code.
5. **Confirm tests pass** — green phase.
6. **Run the full suite** — `npm test && npm run lint`.
7. **Validate manually** — both terminals, real user workflow.

**If tests are not written first, halt execution and restart with TDD.**
