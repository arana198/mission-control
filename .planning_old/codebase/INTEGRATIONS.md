# External Integrations

**Analysis Date:** 2026-02-25

## APIs & External Services

**OpenClaw Gateway:**
- Service: OpenClaw distributed runtime environment
- What it's used for: Agent orchestration, session management, RPC communication with agents
  - SDK/Client: `ws` (WebSocket client)
  - Implementation: `src/services/gatewayRpc.ts` (JSON-RPC v3 protocol)
  - Connection: WebSocket (ws:// or wss://)
  - Auth: Optional token via gateway config
  - Operations: `sessions.list`, `chat.history`, `chat.send`, `agents.create`

**GitHub Integration:**
- Service: Local git repository access
- What it's used for: Commit fetching and linking to task tickets
  - Implementation: `convex/github.ts`
  - Method: `spawnSync("git")` for local commits only (no GitHub API)
  - Pattern matching: Extracts ticket IDs like CORE-01, PERF-01, EPUK-1 from commit messages
  - No authentication required (local filesystem only)

## Data Storage

**Databases:**
- Convex Cloud
  - Type: Real-time document database with live queries
  - Provider: Convex (SaaS)
  - Connection: Via `NEXT_PUBLIC_CONVEX_URL` environment variable
  - Client: `ConvexReactClient` (frontend), `ConvexHttpClient` (API routes)
  - ORM: Convex SDK (declarative schema in `convex/schema.ts`)
  - Tables: 40+ including workspaces, agents, tasks, epics, executions, notifications, gateways, etc.

**File Storage:**
- Local filesystem only
  - Workspace root paths stored in `agents.workspacePath`
  - No cloud storage integration detected
  - Git commits accessed locally via filesystem

**Caching:**
- In-memory caching in Convex queries (automatic)
- No external cache service (Redis, Memcached) detected

## Authentication & Identity

**Auth Provider:**
- Custom implementation via API keys
  - Agent authentication: API key stored in `agents.apiKey`
  - Key rotation: Tracked with `lastKeyRotationAt`, `keyRotationCount`, `previousApiKey`
  - Human/organizational auth: Invitation-based via `invites` table
  - Email validation: Case-insensitive normalization in `convex/invites.ts`

**Authorization:**
- Workspace-scoped access control
  - Multi-tenant via `workspaceId` in most tables
  - Agent role-based: "lead", "specialist", "intern"

## Monitoring & Observability

**Error Tracking:**
- Custom error handling
  - Implementation: `lib/errors/convexErrorHandler.ts`
  - Structured error types: `ApiError`, `ValidationError`, `NotFoundError`
  - Stack traces included in development, hidden in production
  - No third-party error tracking (Sentry, Rollbar) detected

**Logs:**
- Structured logging via custom logger
  - Framework: `lib/utils/logger.ts` (custom implementation, not Pino in use)
  - Format: JSON lines in production, pretty-printed in development
  - Levels: debug, info, warn, error
  - Environment: `LOG_LEVEL` env var controls verbosity
  - Output: stdout/stderr (suitable for log aggregation services)

**Metrics & Analytics:**
- Agent execution metrics tracked in database
  - `executions` table: duration, tokens, cost, status
  - `agentMetrics.ts`: Token counts, performance tracking
  - `agentSelfCheck.ts`: Self-evaluation and anomaly detection
  - Dashboard: `convex/dashboard.ts` aggregates real-time metrics

**Observability Gaps:**
- No APM (Application Performance Monitoring) detected
- No distributed tracing framework (OpenTelemetry)
- No uptime/SLA monitoring

## CI/CD & Deployment

**Hosting:**
- Frontend: Next.js (Vercel, AWS, or self-hosted)
- Backend: Convex Cloud (managed)

**CI Pipeline:**
- GitHub Actions (inferred from `.env.CI` patterns)
- Test automation: `npm run test:ci` configured with coverage
- Build validation: `npm run validate` (lint + build + test)

**Deployment Targets:**
- Convex: `npm run convex:deploy` (automatic on schema changes)
- Next.js: Standard production build via `npm run build`

## Environment Configuration

**Required env vars:**
- `NEXT_PUBLIC_CONVEX_URL` - Convex deployment URL (public)
- `CONVEX_URL` - Convex backend URL (server-side)
- `OPENCLAW_GATEWAY_URL` - Gateway WebSocket endpoint (e.g., http://localhost:8000)

**Optional env vars:**
- `TELEGRAM_BOT_TOKEN` - For Telegram standup notifications
- `TELEGRAM_CHAT_ID` - Telegram chat recipient
- `LOG_LEVEL` - Logging verbosity (default: "info")
- `POLL_INTERVAL_MS` - Daemon polling interval
- `NODE_ENV` - Environment (development, production)
- `NEXT_PUBLIC_APP_NAME` - UI branding

**Secrets location:**
- `.env.local` (development, not committed)
- `.env.docker.example` (template for Docker deployments)
- Convex secrets: Managed via Convex dashboard
- API keys: Stored in database (`agents.apiKey`), rotated via `convex/agents.ts`

## Webhooks & Callbacks

**Incoming:**
- Wake notifications: `convex/wake.ts` endpoint
  - Method: POST with `WAKE_SECRET` token validation
  - Purpose: Trigger agent wake-up events
  - Verified by: `process.env.WAKE_SECRET`

**Outgoing:**
- Telegram notifications (optional)
  - Used in: Standup delivery, automated reports
  - Config: `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`
  - Status: Enabled if env vars present, silent fail otherwise

- Slack notifications (schema-prepared, not yet implemented)
  - Alert rules support: `alertRules` table has `slackChannel`, `slackMention` fields
  - Status: Schema defined but no active integration

## Real-time Communication

**WebSocket Connections:**
- Gateway RPC: `ws://` or `wss://` connections to OpenClaw gateway
  - Implementation: `src/services/gatewayRpc.ts`
  - Protocol: JSON-RPC v3
  - Connection timeout: 10 seconds
  - Device pairing: Optional (can disable for control UI)
  - TLS validation: `allowInsecureTls` option for dev environments

- Convex live queries: Automatic WebSocket via ConvexClient
  - Real-time data sync without polling

## External Service Dependencies

**OpenClaw (Required for gateway features):**
- Status: Essential for distributed agent runtime
- Connection: `OPENCLAW_GATEWAY_URL` must be set
- Fallback: None (manual validation via `?action=validate` endpoint)

**Telegram (Optional):**
- Status: Optional for notifications
- Fallback: Graceful degradation if env vars missing

**Slack (Planned):**
- Status: Schema prepared, not yet integrated
- Priority: Lower (alert rules defined but no active implementation)

## Rate Limiting & Quotas

**Convex:**
- Built-in rate limiting per deployment
- Token-based pricing tracked in `executions` table

**Gateway RPC:**
- No explicit rate limiting detected
- Connection per request pattern (no connection pooling)

**File Operations:**
- Local git operations: No limits

## Security Considerations

**Authentication:**
- API key-based for agents
- Invitation tokens for human users
- Convex handles auth for client/server communication

**Authorization:**
- Workspace isolation (multi-tenant)
- Role-based access control (agent levels: lead, specialist, intern)

**Data Protection:**
- TLS/HTTPS for Convex connections (HTTPS URLs)
- Optional TLS for gateway connections (configurable)
- Secrets in environment variables, not hardcoded

**Key Rotation:**
- Automatic agent API key rotation tracked in schema
- Grace period: `previousKeyExpiresAt` for old keys

---

*Integration audit: 2026-02-25*
