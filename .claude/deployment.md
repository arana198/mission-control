# Deployment Rules

Production deploys are irreversible in one dimension: corrupted data cannot be un-corrupted. These rules prevent the irreversible outcomes.

## Pre-Deploy Checklist

Before any production deploy:

1. `npm test` passes — all unit and integration tests green.
2. `npm run build` passes — TypeScript clean, no import errors.
3. All Convex migrations tested locally first.
4. `npm run validate` passes — comprehensive gate (lint + build + tests).

## Migration Safety

- **Convex migrations are auto-applied on deploy** — the moment you deploy, migrations run against production data. There is no dry-run in production.
- **Always test migrations locally first** — run `npm run convex:dev` and verify migration behavior against a local dataset before deploying.
- **Never force-deploy without testing migrations locally** — data corruption is irreversible.

## Production Build Command Sequence

```bash
npm test          # All tests must pass
npm run build     # TypeScript must compile clean
npm run validate  # Full gate: lint + build + tests
# Then deploy
```

This file must stand alone. A developer reading only this file should know exactly what to do before deploying.
