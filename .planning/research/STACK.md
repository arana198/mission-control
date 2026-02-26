# Technology Stack & Patterns Research

**Project:** Mission Control - Agent Orchestration Platform
**Researched:** 2026-02-26
**Focus:** REST API Design, Agent Orchestration, Notifications, OpenAPI Documentation

---

## 1. REST API Design Best Practices (2025/2026)

### Versioning Strategy

**Recommendation: URL path versioning (`/api/v1/agents`)**

Use URL path versioning because it is explicit, cache-friendly, browser-testable, and the dominant convention in the industry. Header-based versioning (`Accept: application/vnd.mc.v1+json`) is purer REST theory but creates friction for agent consumers who need to debug requests manually. Mission Control's API consumers are AI agents, not browsers, but simplicity wins here.

**Confidence:** HIGH (industry consensus, multiple authoritative sources agree)

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| URL path (`/api/v1/`) | Explicit, cacheable, testable, easy routing | URL clutter | **Use this** |
| Header (`Accept`) | Clean URLs, pure REST | Hard to test, invisible | Too clever |
| Query param (`?v=1`) | Simple | Not cacheable, ugly | No |

**Implementation for Next.js App Router:**

```
frontend/src/app/api/v1/agents/route.ts       # New versioned routes
frontend/src/app/api/v1/agents/[agentId]/route.ts
frontend/src/app/api/agents/route.ts           # Keep as redirect to /v1/ during migration
```

**When to bump version:** Removed fields, type changes, auth changes, renamed resources. Adding optional fields is NOT a breaking change and does not need a version bump.

### Pagination

**Recommendation: Cursor-based pagination for all list endpoints**

Mission Control manages agents, tasks, notifications, and workflow executions. These are append-heavy, real-time datasets where items are constantly created. Offset pagination breaks when items are added between page requests (agents see duplicates or miss items). Cursor-based pagination uses a stable marker (typically encoded ID + timestamp) so results remain consistent.

**Confidence:** HIGH (well-established pattern, Slack's engineering blog documents their migration from offset to cursor)

**Standard response envelope:**

```typescript
interface PaginatedResponse<T> {
  success: true;
  data: {
    items: T[];
    cursor: string | null;  // null = no more pages
    hasMore: boolean;
  };
  timestamp: number;
}
```

**Request pattern:**

```
GET /api/v1/agents/tasks?cursor=eyJpZCI6...&limit=25
```

| Parameter | Type | Default | Max | Notes |
|-----------|------|---------|-----|-------|
| `cursor` | string | null | - | Opaque, base64-encoded. null = first page |
| `limit` | number | 25 | 100 | Items per page |

**Cursor encoding:** Base64 of `{id, createdAt}`. Convex IDs are sortable, making this natural for `_creationTime`-based ordering.

**Why not offset?** At the scale Mission Control targets (10+ agents, hundreds of tasks, thousands of notifications), offset pagination with SKIP is already degrading. More importantly, real-time data insertion causes items to shift between pages.

### Filtering and Sorting

**Recommendation: Query parameter conventions with Convex index alignment**

```
GET /api/v1/tasks?status=active&assignee=agent-123&sort=-createdAt&limit=25
```

| Convention | Pattern | Example |
|------------|---------|---------|
| Equality filter | `field=value` | `status=active` |
| Multi-value | `field=val1,val2` | `status=active,blocked` |
| Sort ascending | `sort=field` | `sort=createdAt` |
| Sort descending | `sort=-field` | `sort=-createdAt` |
| Date range | `field_after=` / `field_before=` | `createdAt_after=2026-01-01` |

**Important:** Only expose filters that map to Convex indexes. Do NOT allow arbitrary field filtering -- it forces full table scans. Each filterable field must have a backing index in `schema.ts`.

### Error Handling

**Recommendation: Adopt RFC 9457 (Problem Details for HTTP APIs)**

The current codebase uses a custom `{ success: false, error: { code, message, details } }` envelope. This is fine but non-standard. RFC 9457 (supersedes RFC 7807) provides a machine-readable, standard format that agent consumers can parse programmatically without knowing Mission Control-specific conventions.

**Confidence:** HIGH (RFC 9457 is the current IETF standard, published June 2024)

**RFC 9457 response shape:**

```typescript
interface ProblemDetail {
  type: string;       // URI identifying problem type (e.g., "/errors/validation")
  title: string;      // Human-readable summary
  status: number;     // HTTP status code
  detail?: string;    // Specific occurrence explanation
  instance?: string;  // URI of the specific occurrence
  // Extension fields allowed:
  errors?: Array<{ field: string; message: string }>;  // For validation errors
  traceId?: string;   // For debugging
}
```

**Content-Type:** `application/problem+json` for error responses.

**Migration path:** Keep existing `handleApiError()` but change its output shape to RFC 9457 format. The `AppError`, `ValidationError`, `NotFoundError`, `UnauthorizedError` class hierarchy is solid -- just change the serialization.

**Zod schema for Problem Details:**

```typescript
import { z } from "zod";

const ProblemDetailSchema = z.object({
  type: z.string().url().default("/errors/generic"),
  title: z.string(),
  status: z.number().int().min(100).max(599),
  detail: z.string().optional(),
  instance: z.string().optional(),
  errors: z.array(z.object({
    field: z.string(),
    message: z.string(),
  })).optional(),
  traceId: z.string().optional(),
});
```

### HTTP Method Semantics

The current codebase largely follows correct method semantics. Reinforcing:

| Method | Semantics | Idempotent | Safe |
|--------|-----------|------------|------|
| GET | Read resource(s) | Yes | Yes |
| POST | Create resource / trigger action | No | No |
| PUT | Full replace of resource | Yes | No |
| PATCH | Partial update | No* | No |
| DELETE | Remove resource | Yes | No |

**Current issue in codebase:** The agent poll endpoint (`POST /api/agents/{agentId}/poll`) uses POST for what is functionally a read operation with side effects (heartbeat update, mark notifications read). This is acceptable because the side effects make it non-safe, but consider splitting: `GET /api/v1/agents/{agentId}/inbox` (read-only) and let heartbeat/notification-read be separate explicit mutations.

### Rate Limiting

**Recommendation: @upstash/ratelimit with Convex-backed storage**

For agent-facing APIs, implement per-agent rate limiting. Agents authenticate with API keys, making per-key rate limiting natural.

| Endpoint Category | Rate Limit | Window |
|-------------------|-----------|---------|
| Read endpoints (GET) | 100 req | 1 minute |
| Write endpoints (POST/PUT) | 30 req | 1 minute |
| Poll endpoint | 60 req | 1 minute |
| Auth endpoints | 5 req | 15 minutes |

**Implementation:** Use Next.js middleware for rate limit checks. Store rate limit counters in Convex (native to the stack) or use Upstash Redis if sub-millisecond checks are needed. For 10 agents, Convex is sufficient.

---

## 2. Agent Orchestration & Workflow Patterns

### Existing Architecture Assessment

Mission Control already has solid foundations:
- **DAG validation:** `workflowValidation.ts` implements cycle detection (DFS), topological sort (Kahn's), ready-step computation, and state machines
- **State machines:** Workflow (`pending -> running -> success/failed/aborted`) and step (`pending -> running -> success/failed`, `pending -> skipped`) transitions are well-defined
- **Schema:** Workflow definitions use `nodes` (Record<string, WorkflowNode>) and `edges` (Record<string, string[]>) for DAG representation

### Recommendation: Use @convex-dev/workflow for Durable Execution

**Do NOT build a custom workflow executor.** The `@convex-dev/workflow` component (beta, but maintained by Convex team) provides exactly what Mission Control needs:

**Confidence:** MEDIUM (component is in beta, but Convex team actively maintains it; the alternative of building custom durable execution is far harder)

| Feature | @convex-dev/workflow | Custom Build |
|---------|---------------------|--------------|
| Durable execution | Built-in | Must implement |
| Step retry with backoff | Built-in | Must implement |
| Parallel steps | Built-in | Must implement |
| Sleep/delay | Built-in | ctx.scheduler |
| Reactive status | Built-in (subscriptions) | Must implement |
| Cancellation | Built-in | Must implement |
| Time to production | Days | Weeks |

**Integration pattern:**

```typescript
// Define workflow using @convex-dev/workflow
const myWorkflow = workflow.define({
  args: { workflowId: v.id("workflows") },
  handler: async (step, args) => {
    // Load workflow definition from DB
    const def = await step.runQuery(internal.workflows.getDefinition, { id: args.workflowId });

    // Execute steps based on DAG topology
    const readySteps = getReadySteps(def.nodes, def.edges, []);

    // Run ready steps in parallel
    const results = await Promise.all(
      readySteps.map(stepId =>
        step.runAction(internal.workflows.executeStep, { stepId })
      )
    );

    // Continue until all steps complete...
  }
});
```

**Convex execution guarantee:** Mutations are exactly-once. Actions are at-most-once (no auto-retry). Use the `@convex-dev/workflow` retry configuration for action steps.

### DAG Execution Pattern

The existing `getReadySteps()` function is the core scheduling primitive. The execution loop:

1. **Start:** Mark workflow `running`, compute initial ready steps from `entryNodeId`
2. **Dispatch:** For each ready step, create a task for the assigned agent
3. **Wait:** Agent completes task (via poll -> execute -> complete cycle)
4. **Advance:** On step completion, call `getReadySteps()` with updated completion set
5. **Repeat:** Dispatch newly ready steps. If none ready and all complete, mark workflow `success`
6. **Fail:** If step fails and no retry left, mark workflow `failed`

**Data chaining between steps:** Step N's `outputData` is auto-merged into step N+1's `inputData`. This is already designed in the `WorkflowNode.inputMapping` / `outputMapping` fields.

### Concurrent Workflow Executions

**Allow multiple concurrent executions per workflow definition.** Each execution is an independent instance with its own state. The schema already supports this with separate `workflowExecutions` records.

**Why:** An agent team might need to run the same workflow template for different contexts (different PRs, different bug reports). Serial execution would be a bottleneck.

### External Orchestrators (Not Recommended)

| Platform | Why Not |
|----------|---------|
| Temporal | Massive infrastructure overhead for 10-agent team. Designed for thousands of workflows. Overkill. |
| Apache Airflow | Python-centric, batch-oriented. Wrong paradigm for real-time agent orchestration. |
| Prefect | Python-centric. |
| LangGraph | Focused on LLM agent chains, not task-agent orchestration. Different abstraction level. |

**Rationale:** Mission Control already runs on Convex. Adding an external orchestrator means running another service, managing connections, syncing state. The `@convex-dev/workflow` component runs natively inside Convex -- same database, same reactivity, zero additional infrastructure.

---

## 3. Notification Patterns for Agent Teams

### Current State

The codebase uses **polling** (`POST /api/agents/{agentId}/poll`). Agents periodically call this endpoint to get assigned tasks and notifications. Heartbeat and notification-read are side effects of polling.

### Recommendation: Keep Polling as Primary, Add Webhook Push for Priority Events

**Confidence:** HIGH (polling is battle-tested and matches agent consumption patterns)

| Pattern | Use Case in Mission Control | Recommendation |
|---------|----------------------------|----------------|
| **Polling** | Agent work queue, heartbeat, routine notifications | **Keep (primary)** |
| **Webhooks** | Urgent task assignment, workflow step ready, abort signals | **Add (secondary)** |
| **SSE** | Dashboard real-time updates (human operators) | **Already handled by Convex subscriptions** |
| **WebSockets** | Bidirectional real-time | **Already handled by Convex** |

### Why Polling Works for Agents

1. **Agents are not browsers.** They run as CLI processes, cron jobs, or daemon loops. Polling fits their execution model.
2. **Heartbeat is natural.** Each poll doubles as a heartbeat, proving the agent is alive.
3. **Simplicity.** No webhook endpoint management, no callback URL registration, no retry logic for failed deliveries.
4. **Current implementation is solid.** The poll endpoint already returns tasks + notifications + server time + agent profile.

### Adding Webhook Push (Phase 2+)

For time-sensitive events where polling latency (up to 30s) is unacceptable:

```typescript
// Agent registers callback URL during registration
POST /api/v1/agents
{
  "name": "Jarvis",
  "callbackUrl": "http://localhost:3001/webhook",  // Optional
  ...
}

// Mission Control pushes to callback on urgent events
POST http://localhost:3001/webhook
{
  "event": "task.assigned",
  "data": { "taskId": "...", "priority": "critical" },
  "timestamp": 1234567890,
  "signature": "sha256=..."  // HMAC signature for verification
}
```

**Webhook delivery guarantees:**
- Retry 3 times with exponential backoff (1s, 5s, 25s)
- After 3 failures, fall back to polling (agent picks up on next poll)
- Include HMAC signature so agents can verify authenticity

**Events to push via webhook:**
- `task.assigned` (critical priority only)
- `workflow.step_ready` (agent's step is now executable)
- `workflow.aborted` (stop current work immediately)

### Convex Real-Time for Dashboard

The frontend dashboard already uses Convex's reactive `useQuery` hooks. This provides sub-second updates to human operators without any additional infrastructure. No SSE or custom WebSocket needed -- Convex handles this natively.

---

## 4. OpenAPI Documentation Strategy

### Current State

The codebase has:
- `zod-openapi` (v5.4.6) in dependencies
- `swagger-ui-react` (v5.31.1) for rendering docs
- A hand-built `openapi-generator.ts` (900+ lines) that manually constructs an OpenAPI 3.0 spec
- Zod schemas in `lib/validators/` for runtime validation

**Problem:** The OpenAPI spec is manually maintained and will drift from actual route implementations. The Zod schemas used for validation are separate from the OpenAPI spec generation.

### Recommendation: Schema-First with zod-openapi as Single Source of Truth

**Use `zod-openapi` (samchungy) to generate OpenAPI specs directly from your existing Zod validation schemas.** This eliminates the hand-built generator and makes docs impossible to drift from validation.

**Confidence:** HIGH (zod-openapi supports Zod v4, is actively maintained, and the project already has it as a dependency)

### Architecture

```
Zod Schema (validation)
    |
    +-- .meta() annotations (OpenAPI metadata)
    |
    v
zod-openapi createDocument()
    |
    v
OpenAPI 3.1 JSON
    |
    v
Swagger UI React (rendering)
```

### Implementation Pattern

**Step 1: Annotate existing Zod schemas with `.meta()`**

```typescript
// lib/validators/agentValidators.ts
import * as z from "zod/v4";

export const RegisterAgentSchema = z.object({
  name: z.string()
    .min(2)
    .max(50)
    .meta({
      description: "Unique agent name",
      example: "Jarvis"
    }),
  role: z.string()
    .min(2)
    .max(100)
    .meta({ description: "Agent role description" }),
  level: z.enum(["lead", "specialist", "intern"])
    .meta({ description: "Agent authority level" }),
  // ... existing validations
}).meta({
  id: "RegisterAgent",
  description: "Request body for agent registration",
});
```

**Step 2: Define route specs alongside route handlers**

```typescript
// lib/openapi/routes/agents.ts
import { RegisterAgentSchema } from "@/lib/validators/agentValidators";

export const agentRoutes = {
  "/api/v1/agents": {
    post: {
      operationId: "registerAgent",
      tags: ["Agents"],
      summary: "Register a new agent",
      requestBody: { content: { "application/json": { schema: RegisterAgentSchema } } },
      responses: {
        201: { description: "Agent created", content: { ... } },
        400: { description: "Validation error", content: { ... } },
      },
    },
  },
};
```

**Step 3: Generate spec at build time or on-demand**

```typescript
// lib/openapi/spec.ts
import { createDocument } from "zod-openapi";

export function generateSpec() {
  return createDocument({
    openapi: "3.1.0",
    info: { title: "Mission Control API", version: "1.0.0" },
    paths: { ...agentRoutes, ...taskRoutes, ...workflowRoutes },
  });
}
```

### Migration Path

1. **Phase 1:** Add `.meta()` annotations to existing Zod schemas (non-breaking)
2. **Phase 2:** Create route spec files alongside existing routes
3. **Phase 3:** Replace hand-built `openapi-generator.ts` with `createDocument()` call
4. **Phase 4:** Add CI check that validates OpenAPI spec is generated without errors

### Alternatives Considered

| Library | Verdict | Why |
|---------|---------|-----|
| `zod-openapi` (samchungy) | **Use this** | Already a dependency, supports Zod v4, .meta() based |
| `@asteasolutions/zod-to-openapi` | Alternative | Uses registry pattern instead of .meta(), more ceremony |
| Hono + Zod OpenAPI | Not applicable | Would require migrating from Next.js API routes to Hono |
| Hand-built (current) | Replace | 900+ lines that will inevitably drift |

---

## Recommended Technology Stack (Complete)

### Core Framework (Existing -- No Changes)

| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| Next.js | ^15.1.6 | Frontend + API routes | Keep |
| Convex | ^1.32.0 | Backend (DB, real-time, functions) | Keep |
| React | ^19.0.0 | UI framework | Keep |
| TypeScript | ^5.4.0 | Type safety | Keep |
| Zod | ^4.3.6 | Runtime validation | Keep |

### API Layer (Enhance)

| Technology | Version | Purpose | Action |
|------------|---------|---------|--------|
| zod-openapi | ^5.4.6 | OpenAPI spec generation from Zod schemas | **Leverage (already installed)** |
| swagger-ui-react | ^5.31.1 | API docs rendering | Keep |

### Workflow Orchestration (Add)

| Technology | Version | Purpose | Action |
|------------|---------|---------|--------|
| @convex-dev/workflow | latest | Durable workflow execution | **Add** |

### Notification Layer (Keep + Extend)

| Technology | Version | Purpose | Action |
|------------|---------|---------|--------|
| Convex subscriptions | built-in | Real-time dashboard updates | Keep |
| Agent polling | custom | Agent work queue delivery | Keep |
| Webhook push | custom | Priority event delivery | **Build (Phase 2+)** |

### Supporting Libraries (Existing -- No Changes)

| Library | Version | Purpose |
|---------|---------|---------|
| pino | ^10.3.1 | Structured logging |
| ws | ^8.18.0 | Gateway WebSocket connections |
| date-fns | ^3.6.0 | Date utilities |
| tailwind-merge | ^3.4.0 | CSS utility merging |

### Testing (Existing -- No Changes)

| Library | Version | Purpose |
|---------|---------|---------|
| Jest | ^30.2.0 | Unit/integration tests |
| Playwright | ^1.58.2 | E2E tests |
| Testing Library | ^16.3.2 | React component tests |

### Rate Limiting (Add When Needed)

| Technology | Version | Purpose | When |
|------------|---------|---------|------|
| @upstash/ratelimit | latest | Per-agent rate limiting | When opening API externally |

---

## Installation

```bash
# New dependency for workflow orchestration
npm install @convex-dev/workflow

# Already installed (verify in place)
# zod-openapi, swagger-ui-react, zod
```

---

## Sources

### REST API Design
- [OneUptime: REST API Design Best Practices (2026)](https://oneuptime.com/blog/post/2026-02-20-api-design-rest-best-practices/view) - MEDIUM confidence
- [Postman: REST API Best Practices](https://blog.postman.com/rest-api-best-practices/) - HIGH confidence
- [Microsoft: Web API Design Best Practices](https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design) - HIGH confidence
- [Devzery: Versioning REST API Strategies 2025](https://www.devzery.com/post/versioning-rest-api-strategies-best-practices-2025) - MEDIUM confidence
- [Speakeasy: Pagination Best Practices](https://www.speakeasy.com/api-design/pagination) - HIGH confidence
- [Slack Engineering: Evolving API Pagination](https://slack.engineering/evolving-api-pagination-at-slack/) - HIGH confidence
- [RFC 9457: Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html) - HIGH confidence (IETF standard)

### Agent Orchestration
- [Convex Workflow Component](https://www.convex.dev/components/workflow) - HIGH confidence (official)
- [Convex: Durable Workflows and Strong Guarantees](https://stack.convex.dev/durable-workflows-and-strong-guarantees) - HIGH confidence (official)
- [@convex-dev/workflow npm](https://www.npmjs.com/package/@convex-dev/workflow) - HIGH confidence (official)
- [PracData: State of Workflow Orchestration 2025](https://www.pracdata.io/p/state-of-workflow-orchestration-ecosystem-2025) - MEDIUM confidence
- [Convex Scheduling Documentation](https://docs.convex.dev/scheduling) - HIGH confidence (official)

### Notification Patterns
- [AlgoMaster: Polling vs Long Polling vs SSE vs WebSockets vs Webhooks](https://blog.algomaster.io/p/polling-vs-long-polling-vs-sse-vs-websockets-webhooks) - MEDIUM confidence
- [Svix: Webhooks vs SSE](https://www.svix.com/resources/faq/webhooks-vs-server-sent-events/) - MEDIUM confidence
- [Convex Realtime Documentation](https://docs.convex.dev/realtime) - HIGH confidence (official)

### OpenAPI Documentation
- [samchungy/zod-openapi GitHub](https://github.com/samchungy/zod-openapi) - HIGH confidence (official)
- [Speakeasy: Generate OpenAPI with Zod v4](https://www.speakeasy.com/openapi/frameworks/zod) - MEDIUM confidence
- [Swagger: Problem Details RFC 9457](https://swagger.io/blog/problem-details-rfc9457-api-error-handling/) - HIGH confidence

### Security
- [Next.js CVE-2025-29927 Middleware Bypass](https://www.turbostarter.dev/blog/complete-nextjs-security-guide-2025-authentication-api-protection-and-best-practices) - HIGH confidence
- [Next.js: Building APIs](https://nextjs.org/blog/building-apis-with-nextjs) - HIGH confidence (official)
