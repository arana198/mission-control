# Mission Control Constitution

Convex + Next.js full-stack app. Agents execute autonomously; Mission Control enforces governance and auditability.

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
