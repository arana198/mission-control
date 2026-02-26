---
phase: housekeeping
plan: claude-refactor
type: execute
wave: 3
depends_on: []
files_modified:
  - .claude/CLAUDE.md
  - .claude/architecture.md
  - .claude/testing.md
  - .claude/convex.md
  - .claude/code-quality.md
  - .claude/deployment.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "Root CLAUDE.md is under 50 lines"
    - "All 12 original sections are preserved across the 5 linked files"
    - "Each linked file is self-contained and readable standalone"
    - "All relative links in root resolve to real files"
    - "No content is duplicated between files"
  artifacts:
    - path: ".claude/CLAUDE.md"
      provides: "Minimal root — runtime, commands, links to detail files"
      max_lines: 50
    - path: ".claude/architecture.md"
      provides: "Folder/file responsibilities (Section 2)"
    - path: ".claude/testing.md"
      provides: "Definition of Done, Testing Policy, E2E details (Sections 3, 6, 11)"
    - path: ".claude/convex.md"
      provides: "Schema rules, Convex-specific rules (Sections 4, 9)"
    - path: ".claude/code-quality.md"
      provides: "Safety Rules, Execution Principle, TDD Gate (Sections 5, 7, 8)"
    - path: ".claude/deployment.md"
      provides: "Deployment rules (Section 12)"
  key_links:
    - from: ".claude/CLAUDE.md"
      to: ".claude/architecture.md"
      via: "relative markdown link"
    - from: ".claude/CLAUDE.md"
      to: ".claude/testing.md"
      via: "relative markdown link"
    - from: ".claude/CLAUDE.md"
      to: ".claude/convex.md"
      via: "relative markdown link"
    - from: ".claude/CLAUDE.md"
      to: ".claude/code-quality.md"
      via: "relative markdown link"
    - from: ".claude/CLAUDE.md"
      to: ".claude/deployment.md"
      via: "relative markdown link"
---

<objective>
Refactor `.claude/CLAUDE.md` from a 189-line monolith into a minimal root file (under 50 lines) that links to 5 focused topic files using progressive disclosure.

Purpose: Claude reads the root on every task but only needs full detail for the relevant topic. A 50-line root means every context window starts with ~139 fewer irrelevant lines, reducing noise and increasing signal for targeted work.

Output: 6 files total — 1 lean root + 5 standalone detail files.
</objective>

<execution_context>
@/Users/arana/.claude/get-shit-done/workflows/execute-plan.md
@/Users/arana/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md

Source material (read before executing any task):
@.claude/CLAUDE.md
</context>

<tasks>

<!-- ===== WAVE 1: CREATE LINKED FILES (all 5 run in parallel) ===== -->

<task type="auto">
  <name>Task 1: Create .claude/architecture.md (Section 2)</name>
  <files>.claude/architecture.md</files>
  <action>
    Create `.claude/architecture.md` by extracting Section 2 (Architecture Boundaries) from the current CLAUDE.md verbatim, then expanding it slightly for standalone readability.

    Structure the file as follows:

    ```markdown
    # Architecture Boundaries

    This project is a Convex + Next.js full-stack application. Code belongs in exactly
    one layer. Do not mix concerns across boundaries.

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
    ```

    Do not include any content from other sections. This file must stand alone.
  </action>
  <verify>
    File exists at `.claude/architecture.md`. Contains all three boundary sections (Frontend, Backend, Shared). Under 40 lines. No references to testing, deployment, or Convex mutations rules.
  </verify>
  <done>`.claude/architecture.md` created, self-contained, covers Section 2 fully.</done>
</task>

<task type="auto">
  <name>Task 2: Create .claude/testing.md (Sections 3, 6, 11)</name>
  <files>.claude/testing.md</files>
  <action>
    Create `.claude/testing.md` by consolidating Sections 3 (Definition of Done), 6 (Testing Policy), and 11 (E2E Testing) from the current CLAUDE.md. No content from these sections should remain only in the root after Wave 2.

    Structure the file as follows:

    ```markdown
    # Testing Guide

    Logic is not validated unless explicitly tested. If tests are missing, the feature
    is incomplete. Production stability depends on test coverage.

    ## Definition of Done (MANDATORY)

    Before every commit:

    1. **Unit tests written** for all new logic.
    2. **Integration tests written** for all Convex mutations.
    3. **E2E tests written** for all UI changes (use Playwright).
    4. `npm test` passes (all unit/integration tests).
    5. `npm run build` passes (TypeScript compilation, imports verified).
    6. `npm run lint` passes.
    7. `npm run validate` passes (lint + build + tests — comprehensive validation).
    8. **Manual validation performed:** Run both terminals and verify the feature works
       in browser.

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
    ```

    This file must stand alone without requiring the reader to consult CLAUDE.md.
  </action>
  <verify>
    File exists at `.claude/testing.md`. Contains Definition of Done numbered list (8 items), Testing Policy section, and E2E section with the commands table. No content from Schema Rules, Safety Rules, or Deployment sections. Under 70 lines.
  </verify>
  <done>`.claude/testing.md` created, self-contained, covers Sections 3, 6, and 11 fully.</done>
</task>

<task type="auto">
  <name>Task 3: Create .claude/convex.md (Sections 4, 9)</name>
  <files>.claude/convex.md</files>
  <action>
    Create `.claude/convex.md` by consolidating Section 4 (Schema & Data Rules) and Section 9 (Convex-Specific Rules) from the current CLAUDE.md.

    Structure the file as follows:

    ```markdown
    # Convex Rules

    Convex is the backend runtime. All data mutations flow through it. These rules
    prevent data corruption, ensure auditability, and maintain type safety.

    ## Schema & Data Rules

    - **Any schema change requires migration** in `convex/migrations.ts`.
    - **Migrations must be deterministic and documented** — include comments explaining
      what changed and why.
    - **No breaking changes without migration scripts** — existing data must be handled
      gracefully.
    - **All Convex mutations must have corresponding tests** — mutations are not
      validated unless explicitly tested.
    - **Type safety is mandatory** — use Zod validation at the boundary (`convex/schema.ts`).

    ## Convex-Specific Rules

    - **Convex functions are the single source of truth** for data mutations.
    - **All state changes must go through Convex mutations** — never mutate state in
      React directly.
    - **Seed data must be deterministic** — use `seed.ts` and `seed:all` script.
    - **Sensitive operations (cron, migrations) must log comprehensively** — use Pino
      logger.

    ## High-Risk Files

    Modifying these files requires comprehensive tests written first:

    | File | Risk |
    |------|------|
    | `convex/schema.ts` | Changes affect the entire data model |
    | `convex/tasks.ts` | Breakage blocks all workflows |
    | `convex/migrations.ts` | Broken migrations can corrupt data |
    | `convex/agents.ts` | Errors propagate across squads |
    | `convex/epics.ts` | Circular dependencies must be prevented |
    ```

    Note: The high-risk file table is duplicated from Section 5 (Safety Rules) because it belongs here — it is specifically about Convex file risk. The code-quality.md file will link here for the Convex-specific list rather than repeat it.
  </action>
  <verify>
    File exists at `.claude/convex.md`. Contains Schema & Data Rules (5 bullet points), Convex-Specific Rules (4 bullet points), and High-Risk Files table (5 rows). Under 50 lines. No content about E2E, deployment, or architecture folders.
  </verify>
  <done>`.claude/convex.md` created, self-contained, covers Sections 4 and 9 fully including high-risk file table.</done>
</task>

<task type="auto">
  <name>Task 4: Create .claude/code-quality.md (Sections 5, 7, 8)</name>
  <files>.claude/code-quality.md</files>
  <action>
    Create `.claude/code-quality.md` by consolidating Section 5 (Safety Rules), Section 7 (Execution Principle), and Section 8 (Test-First Enforcement Gate) from the current CLAUDE.md.

    Structure the file as follows:

    ```markdown
    # Code Quality Rules

    Tests first. Small diffs. Deterministic changes. No speculative refactors.

    ## Safety Rules

    - **No circular task dependencies** — validate dependency graphs before merging.
    - **No duplication of utilities** — search `lib/` and `src/lib/` before adding new
      abstractions.
    - **No speculative refactors** — only refactor when fixing a bug or adding a feature.
    - **Do not modify high-risk Convex files without comprehensive tests** — see
      [convex.md](convex.md) for the full list.

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
    ```

    The reference to `convex.md` in the Safety Rules section avoids duplicating the high-risk file table — point to it instead.
  </action>
  <verify>
    File exists at `.claude/code-quality.md`. Contains Safety Rules (4 bullets, with link to convex.md), Execution Principle (7-step list), and Test-First Enforcement Gate (7-step list with HALT header). Under 55 lines. No content about schema, E2E commands, or deployment.
  </verify>
  <done>`.claude/code-quality.md` created, self-contained, covers Sections 5, 7, and 8 fully.</done>
</task>

<task type="auto">
  <name>Task 5: Create .claude/deployment.md (Section 12)</name>
  <files>.claude/deployment.md</files>
  <action>
    Create `.claude/deployment.md` by extracting Section 12 (Deployment) from the current CLAUDE.md and expanding it to be self-contained.

    Structure the file as follows:

    ```markdown
    # Deployment Rules

    Production deploys are irreversible in one dimension: corrupted data cannot be
    un-corrupted. These rules prevent the irreversible outcomes.

    ## Pre-Deploy Checklist

    Before any production deploy:

    1. `npm test` passes — all unit and integration tests green.
    2. `npm run build` passes — TypeScript clean, no import errors.
    3. All Convex migrations tested locally first.
    4. `npm run validate` passes — comprehensive gate (lint + build + tests).

    ## Migration Safety

    - **Convex migrations are auto-applied on deploy** — the moment you deploy, migrations
      run against production data. There is no dry-run in production.
    - **Always test migrations locally first** — run `npm run convex:dev` and verify
      migration behavior against a local dataset before deploying.
    - **Never force-deploy without testing migrations locally** — data corruption is
      irreversible.

    ## Production Build Command Sequence

    ```bash
    npm test          # All tests must pass
    npm run build     # TypeScript must compile clean
    npm run validate  # Full gate: lint + build + tests
    # Then deploy
    ```
    ```

    This file must stand alone. A developer reading only this file should know exactly
    what to do before deploying.
  </action>
  <verify>
    File exists at `.claude/deployment.md`. Contains pre-deploy checklist, migration safety section with the "auto-applied on deploy" warning, and the command sequence. Under 45 lines. No content about TDD, architecture, or E2E test writing.
  </verify>
  <done>`.claude/deployment.md` created, self-contained, covers Section 12 fully with context added.</done>
</task>

<!-- ===== WAVE 2: REWRITE ROOT (after Wave 1 complete) ===== -->

<task type="auto">
  <name>Task 6: Rewrite .claude/CLAUDE.md as minimal root</name>
  <files>.claude/CLAUDE.md</files>
  <action>
    Rewrite `.claude/CLAUDE.md` in full. Replace the 189-line monolith with a lean root that contains ONLY:

    1. A one-line project identity statement
    2. Runtime requirements (the two terminals — this applies 100% of the time)
    3. The common commands table (Section 10 — frequently referenced regardless of task)
    4. A "Detail Files" section with links and one-line summaries for each of the 5 files

    Write exactly this content (copy precisely — do not paraphrase the runtime rule):

    ```markdown
    # Mission Control Constitution

    Convex + Next.js full-stack app. Agents execute autonomously; Mission Control
    enforces governance and auditability.

    ## Runtime (Required for ALL work)

    Two terminals must run simultaneously:

    **Terminal 1 — Backend:**
    ```
    npm run convex:dev
    ```

    **Terminal 2 — Frontend:**
    ```
    npm run dev
    ```

    **Frontend is NOT operational without Terminal 1 running.**

    ## Common Commands

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

    ## Detail Files

    Read the relevant file for your task type:

    | File | Covers |
    |------|--------|
    | [architecture.md](architecture.md) | Folder/file responsibilities, layer boundaries |
    | [testing.md](testing.md) | Definition of Done, unit/integration/E2E testing rules |
    | [convex.md](convex.md) | Schema rules, migrations, Convex-specific constraints |
    | [code-quality.md](code-quality.md) | Safety rules, TDD workflow, enforcement gate |
    | [deployment.md](deployment.md) | Pre-deploy checklist, migration safety |
    ```

    IMPORTANT: The final file must be under 50 lines. Count lines after writing. If over 50, trim prose — do not remove any commands from the table or any links from the Detail Files section.
  </action>
  <verify>
    Run: `wc -l /Users/arana/dev/ankit/mission-control/.claude/CLAUDE.md`
    Result must be 50 or fewer lines.

    Check all 5 links exist: `ls /Users/arana/dev/ankit/mission-control/.claude/`
    Must show: CLAUDE.md, architecture.md, testing.md, convex.md, code-quality.md, deployment.md

    Read the file — must contain: both terminal commands, commands table (12 rows), Detail Files table (5 rows).
  </verify>
  <done>CLAUDE.md is under 50 lines, contains runtime rules + commands table + 5 working links, no monolithic section content.</done>
</task>

<!-- ===== WAVE 3: VERIFICATION ===== -->

<task type="auto">
  <name>Task 7: Verify content completeness and link integrity</name>
  <files></files>
  <action>
    Run these verification checks in sequence. Fix any failures before marking done.

    **Check 1 — All 6 files exist:**
    ```bash
    ls /Users/arana/dev/ankit/mission-control/.claude/
    # Must show: CLAUDE.md architecture.md testing.md convex.md code-quality.md deployment.md
    ```

    **Check 2 — Root file line count:**
    ```bash
    wc -l /Users/arana/dev/ankit/mission-control/.claude/CLAUDE.md
    # Must be <= 50
    ```

    **Check 3 — All 12 original sections are covered:**
    Verify each original section maps to a file:
    - Section 1 (Runtime) → CLAUDE.md root
    - Section 2 (Architecture Boundaries) → architecture.md
    - Section 3 (Definition of Done) → testing.md
    - Section 4 (Schema & Data Rules) → convex.md
    - Section 5 (Safety Rules) → code-quality.md
    - Section 6 (Testing Policy) → testing.md
    - Section 7 (Execution Principle) → code-quality.md
    - Section 8 (Test-First Enforcement Gate) → code-quality.md
    - Section 9 (Convex-Specific Rules) → convex.md
    - Section 10 (Common Commands) → CLAUDE.md root
    - Section 11 (E2E Testing) → testing.md
    - Section 12 (Deployment) → deployment.md

    Grep for key phrases to confirm coverage:
    ```bash
    grep -l "convex:dev" /Users/arana/dev/ankit/mission-control/.claude/*.md
    grep -l "Definition of Done" /Users/arana/dev/ankit/mission-control/.claude/*.md
    grep -l "schema change requires migration" /Users/arana/dev/ankit/mission-control/.claude/*.md
    grep -l "speculative refactors" /Users/arana/dev/ankit/mission-control/.claude/*.md
    grep -l "red phase" /Users/arana/dev/ankit/mission-control/.claude/*.md
    grep -l "seed:all" /Users/arana/dev/ankit/mission-control/.claude/*.md
    grep -l "E2E" /Users/arana/dev/ankit/mission-control/.claude/*.md
    grep -l "force-deploy" /Users/arana/dev/ankit/mission-control/.claude/*.md
    ```

    Each grep must return at least one file. If any phrase is missing, locate which section it belonged to and add it to the appropriate file.

    **Check 4 — No content duplication:**
    The high-risk file list (convex/schema.ts, convex/tasks.ts, etc.) should appear only in convex.md (with a reference/link in code-quality.md). Grep to confirm:
    ```bash
    grep -l "convex/schema.ts" /Users/arana/dev/ankit/mission-control/.claude/*.md
    # Should return only: convex.md (CLAUDE.md and code-quality.md use a link, not a copy)
    ```

    **Check 5 — All links in root resolve:**
    ```bash
    ls /Users/arana/dev/ankit/mission-control/.claude/architecture.md
    ls /Users/arana/dev/ankit/mission-control/.claude/testing.md
    ls /Users/arana/dev/ankit/mission-control/.claude/convex.md
    ls /Users/arana/dev/ankit/mission-control/.claude/code-quality.md
    ls /Users/arana/dev/ankit/mission-control/.claude/deployment.md
    # All must exist (exit 0)
    ```

    If any check fails, fix the relevant file before proceeding.
  </action>
  <verify>
    All 5 grep checks return at least one matching file.
    `wc -l CLAUDE.md` returns 50 or fewer.
    All 5 linked files exist.
  </verify>
  <done>All 12 sections confirmed present across 6 files. Root under 50 lines. All links resolve. No duplicated content blocks.</done>
</task>

</tasks>

<verification>
After all tasks complete, the following must be true:

1. `wc -l .claude/CLAUDE.md` returns 50 or fewer
2. Six files exist in `.claude/`: CLAUDE.md, architecture.md, testing.md, convex.md, code-quality.md, deployment.md
3. Grep for "Definition of Done" hits testing.md
4. Grep for "schema change requires migration" hits convex.md
5. Grep for "speculative refactors" hits code-quality.md
6. Grep for "force-deploy" hits deployment.md
7. Grep for "src/app/" hits architecture.md
8. The root CLAUDE.md contains a markdown link to each of the 5 detail files
</verification>

<success_criteria>
- Root CLAUDE.md: under 50 lines, contains runtime + commands + links only
- Five detail files created, each under 70 lines, each self-contained
- All 12 original sections mapped — zero content lost
- No duplication: the high-risk file table appears once (convex.md), referenced elsewhere
- Every relative link in CLAUDE.md resolves to a real file in the same directory
</success_criteria>

<output>
After completion, create `.planning/CLAUDE-REFACTOR-SUMMARY.md` with:
- Files created/modified
- Line count of final CLAUDE.md
- Section mapping table (original section → new file)
- Any decisions made during execution
</output>
