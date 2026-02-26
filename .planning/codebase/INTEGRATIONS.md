# External Integrations

**Analysis Date:** 2026-02-26

## APIs & External Services

**OpenClaw Gateway (Distributed Runtime):**
- Service: OpenClaw gateway daemon (local or remote)
- What it's used for: WebSocket RPC communication with distributed agent runtime
- Protocol: JSON-RPC 3.0 over WebSocket (ws:// or wss://)
- SDK/Client: Custom WebSocket client in `frontend/src/services/gatewayRpc.ts`
- Auth: Optional token-based auth + optional ed25519 device pairing signatures
- Connection Config env var: `OPENCLAW_GATEWAY_URL` (default: `http://localhost:8000`)
- Features:
  - Session management (get active sessions)
  - RPC method calls (health checks, message sending)
  - Automatic connection teardown

**Mission Control REST API:**
- Service: Self-hosted (Next.js API routes)
- What it's used for: Agent-facing HTTP endpoints + internal API
- Location: `frontend/src/app/api/`
- Framework: Next.js route handlers with TypeScript
- Endpoints:
  - `/api/gateway/[gatewayId]` - Gateway RPC proxy (sessions, messages, history)
  - `/api/businesses/` - Business management
  - `/api/tasks/` - Task operations
  - `/api/epics/` - Epic management
  - `/api/openapi` - OpenAPI 3.0 spec generation
  - `/api/health` - Health checks
  - More: see `frontend/src/app/api/` directory
- Auth: API key validation (agents authenticate with Convex API keys)
- Spec Generation: OpenAPI 3.0 generated dynamically from route handlers via `frontend/lib/openapi-generator.ts`

## Data Storage

**Convex Backend-as-a-Service:**
- Service: Convex (SaaS)
- Deployment: Cloud-hosted at `*.convex.cloud`
- Connection: HTTPS to Convex deployment URL
- Client: `convex` npm package + `ConvexHttpClient` for HTTP-based access
- Schema: `backend/convex/schema.ts` (defines 20+ tables)
- Key tables:
  - `workspaces` - Multi-tenant support
  - `agents` - Agent squad state
  - `tasks` - Task queue and execution log
  - `executions` - Full audit trail of agent actions
  - `gateways` - Gateway configuration (WebSocket URLs, auth tokens)
  - `businesses` - Organizational units
  - `documents`, `epics`, `goals` - Project management entities
  - And more (see schema.ts for complete list)
- Auth: API keys (agents) and internal Convex mutations (Mission Control)
- Real-time: Built-in via Convex subscriptions

**File Storage:**
- Not detected. Code suggests no external file storage integration.
- Assumption: Files managed locally or within Convex documents

**Caching:**
- Internal: `frontend/src/lib/advancedCache.ts` - In-memory caching utility
- External: Not detected (no Redis, Memcached imports)

## Authentication & Identity

**Agent Authentication:**
- Provider: Custom (Convex-based API keys)
- Implementation:
  - Agents authenticate via `apiKey` field in `agents` table
  - API keys stored in Convex database
  - HTTP routes validate API keys via `frontend/lib/agent-auth.ts`
  - Keys support rotation with grace periods (old key validity window)
- Key Rotation: Tracked in agents table:
  - `lastKeyRotationAt` - Timestamp of rotation
  - `keyRotationCount` - Total rotations (audit)
  - `previousApiKey` - Grace period old key
  - `previousKeyExpiresAt` - When old key becomes invalid

**Multi-User Access:**
- Method: Email-based invitations + role-based access control
- Implementation: `organizationMembers` table + `invites` table
- Roles: admin, member (custom role system)
- Invite flow: Admin sends invite email → user accepts → account created

**Gateway Device Pairing (Optional):**
- Method: Ed25519 signatures (device pairing protocol)
- Optional: Can be disabled via `disableDevicePairing` parameter
- Implementation: `frontend/src/services/gatewayRpc.ts` handles pairing handshake

## Monitoring & Observability

**Error Tracking:**
- Framework: Pino logging (structured JSON logs)
- Location: Backend Convex functions + API routes log to Pino
- Export: Not detected (logs to stdout/stderr)
- No external error tracking service (Sentry, Datadog, etc.) detected

**Logs:**
- Framework: Pino 10.3.1 (Node.js structured logger)
- Pretty-printing: `pino-pretty` for development (`npm run dev`)
- Log format: JSON (production-ready)
- Log level: Configurable via `LOG_LEVEL` env var (default: info)
- Utilities: `frontend/lib/logger.ts`, `backend/convex/utils/activityLogger.ts`
- Activity Audit: Separate activity logging via `executions` table for action audit trail

**Health Monitoring:**
- Health endpoint: `/api/health` (basic status checks)
- Gateway health: `call(ws, 'health')` RPC method to test gateway connectivity
- No external health/uptime monitoring detected

## CI/CD & Deployment

**Hosting:**
- Frontend: Deployment-ready for Vercel, AWS, Docker, self-hosted
- Backend (Convex): Convex cloud deployment via `npm run convex:deploy`
- Gateway: Runs locally or on separate infrastructure (connects via WebSocket)

**CI Pipeline:**
- Framework: None auto-detected (no GitHub Actions, GitLab CI, CircleCI configs found)
- Manual commands available:
  - `npm run validate` - Lint + build + test (pre-deploy checklist)
  - `npm test` - Unit/integration tests
  - `npm run e2e` - End-to-end tests with Playwright

## Environment Configuration

**Required env vars (must be set):**
- `NEXT_PUBLIC_CONVEX_URL` - Convex deployment URL
- `CONVEX_URL` - Server-side Convex URL

**Optional env vars:**
- `OPENCLAW_GATEWAY_URL` - Gateway WebSocket URL (default: http://localhost:8000)
- `WAKE_SECRET` - Webhook secret for wake endpoint
- `TELEGRAM_BOT_TOKEN` - Telegram notifications
- `TELEGRAM_CHAT_ID` - Telegram chat ID

**Secrets location:**
- `.env.local` (gitignored, local development only)
- `.env.production.local` (if using Next.js deployment)
- Convex dashboard (for deployed functions)
- PM2 environment variables (if using daemon processes)

## Webhooks & Callbacks

**Incoming Webhooks:**
- Wake endpoint: `/api/wake` (Convex HTTP action)
  - Purpose: External trigger for autonomous agents
  - Auth: `WAKE_SECRET` validation
  - Returns: List of pending tasks

**Outgoing Webhooks:**
- Not detected in current codebase
- Optional: Telegram notifications via `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`

## Notifications

**Telegram Integration (Optional):**
- Purpose: Standup delivery, team notifications
- Env vars: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- Implementation: `scripts/morning-brief.js`, `scripts/setup-morning-brief.js`
- Feature: Optional morning brief automation

**Slack Integration (Schema Support):**
- Schema fields present: `slackChannel`, `slackMention` in alert rules
- Implementation status: Schema defined but functionality not yet integrated
- Blocked on: External Slack API integration not yet implemented

**Email (Schema Support):**
- Schema support: `emailAddresses` field in alert rules
- Implementation status: Schema defined but no email provider integration found
- No SMTP or email service detected

## GitHub Integration (Reference Only)

**GitHub Settings Storage:**
- Component: `frontend/src/components/BusinessSettingsPanel.tsx`
- Settings tracked: `ticketPrefix`, `ticketPattern`, `githubRepo`
- Status: UI components reference GitHub settings but no actual GitHub API integration detected
- Not yet implemented: Would require GitHub OAuth + REST API client

## Platform Requirements

**Development:**
- Node.js 18.0.0+
- npm 9+
- Convex CLI (`npm install -g convex` or via npx)
- Playwright (for E2E tests)

**Production:**
- Node.js 18.0.0+ (for Next.js backend)
- Convex cloud account (free/paid tier)
- OpenClaw gateway (local or remote)
- Optionally: PM2 for process management
- Optionally: Docker for containerization

---

*Integration audit: 2026-02-26*
