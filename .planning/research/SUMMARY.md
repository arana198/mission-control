# Research Summary: Mission Control REST API & Agent Orchestration

**Domain:** Agent Orchestration Platform - REST API Layer, Workflow Patterns, Notification Design, OpenAPI Documentation
**Researched:** 2026-02-26
**Overall confidence:** HIGH

---

## Executive Summary

Mission Control is a Convex + Next.js agent orchestration platform managing 10 specialized AI agents across multi-workspace environments. The codebase has a solid foundation: 60+ API route handlers, Zod validation schemas, Convex backend with real-time subscriptions, DAG-based workflow validation (44 passing tests), and gateway WebSocket integration with connection pooling.

This research addresses four domains: (1) modernizing the REST API layer to current standards, (2) agent orchestration workflow execution patterns, (3) notification delivery for agent teams, and (4) keeping OpenAPI documentation synchronized with the actual API.

The highest-impact finding is that the project already has `zod-openapi` as a dependency but uses a hand-built 900+ line OpenAPI generator that will inevitably drift from the actual API. Replacing this with schema-driven generation from existing Zod validators is the single highest-ROI improvement -- low effort, eliminates an entire class of documentation bugs.

The second key finding is that `@convex-dev/workflow` (Convex's native durable workflow component) should be adopted instead of building a custom execution engine. The project already has the scheduling primitives (DAG validation, topological sort, ready-step computation, state machines) -- the missing piece is durable execution with retry, and `@convex-dev/workflow` provides exactly that within the existing Convex infrastructure.

For API design, the recommendation is URL path versioning (`/api/v1/`), cursor-based pagination, RFC 9457 error responses, and migration of the existing centralized error handler to produce the standard format. For notifications, the existing polling model is correct for agent consumers; webhook push should be added as a secondary channel for time-sensitive events only after the core workflow engine is operational.

## Key Findings

**Stack:** Keep Convex + Next.js. Add `@convex-dev/workflow` for durable execution. Leverage existing `zod-openapi` for spec generation. No new infrastructure needed.

**Architecture:** Action-mutation handoff pattern for gateway dispatch. Each workflow step is a Convex action (network calls allowed) that reports results back via mutation (database writes). DAG advancement happens in mutations, dispatch happens in actions.

**Critical pitfall:** Hand-built OpenAPI spec WILL drift from actual API behavior. Replace with schema-driven generation before the spec becomes unreliable.

---

## Implications for Roadmap

Based on research, suggested phase structure:

### 1. API Foundation Phase - Standardize the REST Layer

**Rationale:** Every subsequent feature (workflows, notifications, webhooks) is delivered via the REST API. Standardizing error format, pagination, and versioning FIRST means all new features ship with consistent patterns from day one.

**Addresses:**
- URL path versioning (`/api/v1/`)
- RFC 9457 error responses (single change to `handleApiError()` updates all routes)
- Cursor-based pagination helpers
- OpenAPI spec generation from Zod schemas (replace hand-built generator)

**Avoids:**
- Pitfall: Two error formats coexisting (partial RFC 9457 adoption)
- Pitfall: Breaking existing agents during versioning (use 301 redirects)

### 2. Workflow Execution Engine Phase - Core Value Proposition

**Rationale:** The workflow schema, validation logic, and state machines already exist. The execution engine is the missing piece that turns Mission Control from a task tracker into an orchestration platform.

**Addresses:**
- Integrate `@convex-dev/workflow` for durable step execution
- Implement `advanceWorkflowStep` mutation (core DAG advancement loop)
- Data chaining between steps (predecessor output -> successor input)
- Per-step retry with exponential backoff
- Step-level timeout detection

**Avoids:**
- Pitfall: Synchronous multi-step execution in one mutation (action-mutation handoff)
- Pitfall: Non-idempotent step dispatch (check-before-dispatch guard)
- Pitfall: Workflow definition edited during execution (snapshot at trigger time)

### 3. Notification & Monitoring Phase - Agent Lifecycle

**Rationale:** With workflows executing, agents need reliable notification delivery and the system needs monitoring to detect stalled agents and failed steps.

**Addresses:**
- Webhook push for priority events (task.assigned critical, workflow.aborted)
- Heartbeat-based liveness detection
- Auto-reassignment for stalled agents
- Budget enforcement per-step dispatch

**Avoids:**
- Pitfall: Agent deadlocks from crashed agents with no timeout detection
- Pitfall: Webhook delivery without signature verification

### 4. Observability & Documentation Phase - Production Readiness

**Rationale:** With the system operational, build the dashboard and documentation that operators and agent developers need.

**Addresses:**
- Workflow execution dashboard (live status via Convex subscriptions)
- Cost breakdown per workflow, step, agent
- Audit log viewer
- Swagger UI serving schema-generated OpenAPI spec

**Phase ordering rationale:**
- API Foundation must come first because error handling and pagination conventions propagate to every route
- Workflow Engine depends on API Foundation (workflow trigger and status endpoints use standardized patterns)
- Notifications depend on Workflow Engine (need running workflows to generate notification events)
- Observability comes last because it needs operational data to display

**Research flags for phases:**
- Phase 2 (Workflow Engine): Needs deeper research on `@convex-dev/workflow` beta limitations, specifically around parallel step execution and error propagation
- Phase 3 (Notifications): Webhook delivery reliability patterns need further investigation if agents are deployed across unreliable networks
- Phase 1 and 4: Standard patterns, low research risk

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| REST API Design (versioning, pagination, errors) | HIGH | Industry consensus, multiple authoritative sources (Microsoft, Postman, RFC 9457) |
| Workflow Execution (DAG patterns, action-mutation handoff) | HIGH | Convex documentation, existing codebase validation, industry patterns |
| @convex-dev/workflow Suitability | MEDIUM | Beta component; API may change. Verified against official docs but limited production reports. |
| Notification Patterns (polling vs webhooks) | HIGH | Well-established patterns, multiple sources agree. Convex real-time for dashboard is confirmed. |
| OpenAPI from Zod (zod-openapi) | HIGH | Already a dependency, supports Zod v4, actively maintained, well-documented |
| Rate Limiting Strategy | MEDIUM | Upstash/Convex approaches verified; specific implementation for this architecture needs Phase 1 research |

---

## Gaps to Address

- **@convex-dev/workflow beta stability:** No long-running production case studies found. Recommend running a spike/proof-of-concept with a 3-step workflow before full adoption.
- **Zod v4 + zod-openapi integration specifics:** The `.meta()` API for adding OpenAPI metadata to Zod v4 schemas needs hands-on validation. The library documents support but the interaction with existing validators should be tested.
- **Convex action retry behavior:** Documentation says actions are "at-most-once" but `@convex-dev/workflow` adds retry. Need to understand exactly when retries fire and how to prevent duplicate side effects.
- **Cross-workspace agent context:** Agents are global but workflows are workspace-scoped. The exact mechanism for propagating workspace context through workflow dispatch needs design-time attention (addressed in existing PITFALLS.md CRIT-1).

---

## Files Created/Updated

| File | Purpose |
|------|---------|
| `.planning/research/SUMMARY.md` | This file -- executive summary with roadmap implications |
| `.planning/research/STACK.md` | Technology recommendations: REST API, workflow orchestration, notifications, OpenAPI |
| `.planning/research/FEATURES.md` | Feature landscape (existing, from prior research session) |
| `.planning/research/ARCHITECTURE.md` | Architecture patterns (existing, from prior research session) |
| `.planning/research/PITFALLS.md` | Domain pitfalls (existing, from prior research session) |

---

## Sources (All Research)

### REST API Design
- [Postman: REST API Best Practices](https://blog.postman.com/rest-api-best-practices/)
- [Microsoft: Web API Design Best Practices](https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design)
- [RFC 9457: Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html)
- [Speakeasy: Pagination Best Practices](https://www.speakeasy.com/api-design/pagination)
- [Slack Engineering: Evolving API Pagination](https://slack.engineering/evolving-api-pagination-at-slack/)
- [Swagger: RFC 9457 Error Handling](https://swagger.io/blog/problem-details-rfc9457-api-error-handling/)

### Agent Orchestration
- [Convex Workflow Component](https://www.convex.dev/components/workflow)
- [Convex: Durable Workflows](https://stack.convex.dev/durable-workflows-and-strong-guarantees)
- [Convex Scheduling Documentation](https://docs.convex.dev/scheduling)
- [PracData: State of Workflow Orchestration 2025](https://www.pracdata.io/p/state-of-workflow-orchestration-ecosystem-2025)

### Notification Patterns
- [AlgoMaster: Polling vs SSE vs WebSockets vs Webhooks](https://blog.algomaster.io/p/polling-vs-long-polling-vs-sse-vs-websockets-webhooks)
- [Convex Realtime Documentation](https://docs.convex.dev/realtime)

### OpenAPI Documentation
- [samchungy/zod-openapi GitHub](https://github.com/samchungy/zod-openapi)
- [Speakeasy: Generate OpenAPI with Zod v4](https://www.speakeasy.com/openapi/frameworks/zod)
