# Mission Control V2 - Phase 1
# Agent Control + Execution Logging

## Quick Start

### 1. Start Convex Backend
```bash
cd ~/dev/ankit/mission-control
npx convex dev --typecheck=disable
```

### 2. Sync OpenClaw Data
```bash
# Agent registry only
node scripts/sync-openclaw.js

# Agent registry + executions
node scripts/sync-openclaw.js --executions
```

### 3. Set Up Automated Sync (Cron)
```bash
# Run every 5 minutes - syncs agents + executions
openclaw cron add --name "mc-sync" --schedule "*/5 * * * *" "node ~/dev/ankit/mission-control/scripts/sync-openclaw.js && node ~/dev/ankit/mission-control/scripts/sync-openclaw.js --executions"
```

## API Endpoints

- `dashboard:getDashboardSummary` - Quick stats
- `dashboard:getExecutions` - Execution history
- `executionLog:logExecution` - Log new execution
- `agents:getAllAgents` - All agents
- `agents:getWithCurrentTask` - Agents with tasks

## Files

- `convex/schema.ts` - Extended with agents + executions
- `convex/dashboard.ts` - Dashboard queries
- `convex/executionLog.ts` - Execution logging mutation
- `scripts/sync-openclaw.js` - OpenClaw sync script