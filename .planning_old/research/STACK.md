# Technology Stack Research: Multi-Agent Orchestration Control Planes (2025)

**Research Date:** 2025-02-25
**Context:** Mission Control is a TypeScript-first, Next.js + Convex control plane for orchestrating multiple autonomous specialist agents. This research evaluates the 2025 landscape for each layer of the stack.

---

## 1. Orchestration Frameworks

Multi-agent orchestration in 2025 has bifurcated into two distinct archetypes: **agent runtimes** (low-level graph/actor primitives) and **application frameworks** (opinionated, full-featured toolkits). A third category — **custom DAG engines** — remains viable when control plane requirements diverge from what frameworks offer.

### Comparison Table

| Framework | Language | License | Maturity | Paradigm | TypeScript Quality | Best For |
|---|---|---|---|---|---|---|
| **LangGraph** | Python + JS/TS | MIT | High (v0.2+) | Graph / State Machine | Official TS SDK, feature-parity with Python | Production-grade agent runtimes needing fine-grained control |
| **Mastra** | TypeScript-first | Elastic v2 | Medium (v1 beta) | Application framework | First-class native | Full-stack TS teams shipping AI features fast |
| **AutoGen v0.4** | Python (TS extensions) | MIT | High (v0.4) | Actor model / Event-driven | Limited, Python-primary | Research / enterprise Python stacks |
| **CrewAI** | Python | MIT (core) | High (v0.80+) | Role-based crews | No official TS SDK | Python shops, role-based task decomposition |
| **Inngest** | TypeScript-first | Apache 2 | High (v3+) | Event-driven / Durable functions | First-class native | Serverless TypeScript, Next.js-native workflows |
| **Temporal** | Multi-language | MIT | Very High | Workflow engine / Actor | Official TS SDK | Long-running workflows, enterprise, distributed systems |
| **Hatchet** | TypeScript + Go + Python | MIT | Medium | Task queue / DAG / Durable exec | Official TS SDK | DAG orchestration on Postgres, self-hosted control |
| **Convex Workflow** | TypeScript (Convex-native) | Apache 2 | Medium (beta) | Durable function chains | Native (Convex schema) | Mission Control's existing Convex stack |
| **AWS Step Functions** | JSON DSL + multi-lang | Commercial | Very High | State machine / Visual | SDK wrappers | AWS-locked enterprises, visual workflow design |
| **Custom DAG** | Any | Internal | N/A | Pure code graph | Fully controlled | When framework abstractions are a liability |

### Framework Deep Dives

#### LangGraph
- **Current version:** v0.2.x (Python), LangGraph.js v0.2.x
- **Architecture:** Directed graph of nodes; each node is an agent or function; edges carry typed state. Supports cyclic graphs (unlike simple DAGs), enabling agent loops and retries.
- **Key capabilities:** Stateful checkpointing, time-travel debugging, human-in-the-loop interrupt/resume, parallel fan-out, sub-graphs, streaming token output.
- **Integration:** LangSmith for observability; LangChain ecosystem for LLM wrappers and tools.
- **Confidence:** HIGH — largest production adoption; LangSmith+LangGraph is the most mature observability+execution stack in the market.
- **Limitation for Mission Control:** Python-primary despite TS SDK; tightly coupled to LangChain ecosystem; harder to drop into an existing Convex/Next.js stack without additional adaptation work.

#### Mastra (v1 Beta)
- **Current version:** v1 beta (January 2025); stable release imminent as of research date.
- **Architecture:** TypeScript application framework. Agents have tools, memory (persistent via adapters), and workflows. Workflows are graph-based state machines supporting branches, loops, waiting, and parallel execution.
- **Key capabilities:** Model routing to 40+ providers via one interface (built on Vercel AI SDK v5), MCP integration, agent networks via `.network()`, evals built in, tracing, and Inngest-backed durable workflows.
- **Integration:** Pluggable memory adapters, OpenTelemetry tracing, and a `@convex-dev/mastra` npm package exists (experimental) that runs Mastra workflows on Convex.
- **Confidence:** HIGH for greenfield TypeScript stacks; MEDIUM for Mission Control specifically due to the `@convex-dev/mastra` package being experimental and the Elastic v2 license having commercial use restrictions.
- **Limitation:** Elastic v2 license means commercial restrictions at scale. Newer, smaller community vs. LangGraph.

#### AutoGen v0.4
- **Current version:** v0.4 (January 2025), major redesign.
- **Architecture:** Actor model. Three layers: Core (async message exchange), AgentChat (high-level API), Extensions (integrations). Supports OpenTelemetry natively.
- **Confidence:** LOW for Mission Control — Python-primary; no meaningful TypeScript path; best for research-grade Python multi-agent systems.

#### CrewAI
- **Current version:** v0.80+
- **Architecture:** Role-based crews where agents have defined roles, goals, and tools. CrewAI Flows adds event-driven control for production.
- **Confidence:** LOW for Mission Control — Python-only; enterprise features (AMP suite) are commercial.

#### Inngest
- **Current version:** v3.x; Checkpointing feature in developer preview (December 2025).
- **Architecture:** Event-driven durable workflow engine. Works natively inside Next.js API routes with zero infrastructure. Steps are checkpointed; workflows survive restarts. `step.ai.infer` proxies LLM calls with telemetry.
- **Key capabilities:** Near-zero inter-step latency via Checkpointing, AgentKit for agent orchestration, built-in token usage insights via SQL queries, AI workflow tracing, pause/resume.
- **Integration:** First-class Next.js support; Mastra uses Inngest as its durable workflow backend.
- **Confidence:** HIGH for Mission Control's Next.js deployment layer. Inngest can serve as the durable workflow engine while Convex owns state/data.

#### Temporal
- **Current version:** v1.x (very mature)
- **Architecture:** Workflow engine with code-as-workflow model. Workflows are deterministic TypeScript functions. Activities are the side-effectful units. DAG execution via `Promise.all`.
- **Confidence:** MEDIUM for Mission Control — Very mature but heavyweight; requires a separate Temporal server (or Temporal Cloud). Overkill for v1 scope; strong candidate for v2 if requirements grow significantly.

#### Hatchet
- **Current version:** v1.x
- **Architecture:** Task queue + DAG orchestrator + durable execution built on Postgres. TypeScript SDK available. Fan-out workflows, conditional triggering, streaming. Self-hostable.
- **Confidence:** MEDIUM — Interesting because it runs on Postgres (which Convex uses internally), but adds another service to manage. Better fit if Mission Control ever needs an independent scheduler.

#### Convex Workflow Component
- **Current version:** `@convex-dev/workflow` (out of beta 2025)
- **Architecture:** Durable workflow execution living entirely within Convex. Workflows are sequences of Convex mutations/actions with retry semantics. Supports parallel steps, delays, and observability via Convex subscriptions.
- **Confidence:** HIGH for Mission Control's architecture — Zero new infrastructure; survives server restarts; reactive observability already built into Convex's subscription model.

---

## 2. Workflow / DAG Libraries

Table stakes for a control plane DAG layer in 2025:

### Sequential Pipelines
- Chain Convex actions where each step writes its result as an immutable record before the next step reads it.
- The `@convex-dev/workflow` component provides exactly this semantics natively on the existing stack.

### Parallel Execution
- Convex Workflow supports parallel steps via concurrent action scheduling.
- At the DAG level, implement topological sort + dependency tracking: steps with no pending dependencies are dispatched simultaneously.
- Pattern: store a `WorkflowStep` table with `{ workflowId, stepId, dependsOn: string[], status, result }`. A scheduler mutation queries for `status = 'pending'` with all dependencies `status = 'completed'` and dispatches them.

### DAG Representation
- **Lightweight in-process option:** Store workflow definition as JSON in Convex (`{ nodes: Node[], edges: Edge[] }`). Validate for cycles at definition time using DFS (Kahn's algorithm).
- **Library option:** `graphlib` (npm, MIT, stable) — well-maintained graph algorithm library for TypeScript. Handles cycle detection, topological sort, connected component analysis.
- **Avoid:** Heavy frameworks (Apache Airflow, Prefect) that bring Python runtimes and separate servers.

### Composition
- Workflows compose by nesting: a `WorkflowStep` can be itself a sub-workflow ID (hierarchical execution).
- Versioning: store `workflowDefinitionVersion` integer on the workflow record; schema migrations handle evolution.

### Key Table-Stakes Capabilities

| Capability | Implementation Path | Confidence |
|---|---|---|
| Sequential steps | `@convex-dev/workflow` chains | HIGH |
| Parallel fan-out | Parallel Convex action dispatch | HIGH |
| Cycle detection | Kahn's algorithm on JSON DAG at save time | HIGH |
| Retry on failure | `@convex-dev/workflow` built-in retry config | HIGH |
| Long-running (months) | Convex Workflow survives restarts | HIGH |
| Human-in-the-loop | Convex mutation to set step status to `waiting_approval` | MEDIUM |
| Sub-workflows | Hierarchical workflow step type | MEDIUM |

---

## 3. Token Tracking and Cost Solutions

Token economics is a first-class concern for control planes in 2025. The industry has converged on two layers: **instrumentation at the LLM call level** and **accounting in the data layer**.

### 3.1 Instrumentation Layer: OpenTelemetry GenAI Semantic Conventions

The OpenTelemetry GenAI Semantic Conventions (v1.37+, 2025) define a standard schema for all LLM telemetry:

```
gen_ai.system                    # "anthropic" | "openai" | etc.
gen_ai.request.model             # "claude-opus-4-6"
gen_ai.usage.input_tokens        # prompt tokens consumed
gen_ai.usage.output_tokens       # completion tokens generated
gen_ai.usage.reasoning_tokens    # OpenAI reasoning tokens
gen_ai.response.finish_reason    # "stop" | "max_tokens" etc.
```

These conventions are now supported natively by Datadog (v1.37+), Grafana, Honeycomb, and New Relic.

**OpenLLMetry-JS** (`@traceloop/node-server-sdk`, MIT) is the TypeScript implementation of these conventions. It auto-instruments OpenAI, Anthropic, LangChain, and vector DBs with zero code changes. 6,600+ GitHub stars; actively maintained.

### 3.2 Accounting Layer: Where Token Data Lives

Options from lightest to most comprehensive:

| Solution | Type | Strengths | Weaknesses | Fit for Mission Control |
|---|---|---|---|---|
| **Convex `executions` table** (existing) | In-app accounting | Zero new infra; queryable via Convex; real-time | Not purpose-built for cost analytics at massive scale | HIGH — already exists, extend it |
| **Langfuse** (self-hosted or cloud) | Dedicated LLM observability | Per-trace cost breakdown, model pricing registry 300+ models, open source | Separate service to run; PostgreSQL dependency | MEDIUM — overkill for v1, good for v2 |
| **Helicone** | LLM Gateway + observability | Request-level cost tracking, caching, rate limiting, budget enforcement at gateway | Requires routing all LLM calls through proxy | MEDIUM — consider for multi-provider cost normalization |
| **LiteLLM** | LLM proxy | Per-key/user/team budgets with hard enforcement; 100+ provider normalization | Another service; Python-primary | LOW for v1; consider for gateway layer if multi-provider |

### 3.3 Budget Enforcement Pattern

The recommended pattern for Mission Control v1, using only Convex:

1. **Budget definition:** Each `Workflow` record stores `{ tokenBudget: number, tokensConsumed: number }`.
2. **Pre-execution check:** Before dispatching any agent step, a Convex mutation reads `tokensConsumed` against `tokenBudget`. If exceeded, halt the step and set workflow status to `budget_exceeded`.
3. **Token reporting:** Each agent execution reports back `{ inputTokens, outputTokens, model }` via a Convex mutation. The `executions` table (already exists in schema) records this. A rollup mutation aggregates per workflow.
4. **Real-time visibility:** Convex subscriptions on the `executions` table provide live token burn rate to the UI.

This is a **pull model** (agents report after execution) vs. a **gateway model** (proxy intercepts before). The pull model is simpler for v1 and avoids routing all LLM traffic through a proxy service.

For v2+, consider adding a LiteLLM or Helicone gateway layer that enforces hard stops before the model call completes.

### 3.4 Cost Calculation

Model pricing changes frequently. Best practice:

- Store a `modelPricing` table in Convex: `{ model, inputCostPerMToken, outputCostPerMToken, updatedAt }`.
- Reference: Helicone's open-source pricing repository (300+ models, regularly updated).
- Compute `estimatedCost = (inputTokens / 1M) * inputCostPerMToken + (outputTokens / 1M) * outputCostPerMToken` at recording time.

---

## 4. Audit Logging Infrastructure

### 4.1 Requirements for Mission Control

- **Immutability:** Once written, execution records cannot be altered.
- **Completeness:** Every agent action, tool call, decision, input, output, token count, and cost is captured.
- **Replay capability:** Any past execution can be reconstructed from the log alone.
- **Retention:** 90 days minimum (per PROJECT.md constraints).
- **Searchability:** Engineers and operators must be able to filter by workflow, agent, time range, status.

### 4.2 Architectural Approach: Event Sourcing on Convex

Mission Control already has an `executions` table (schema.ts) that functions as an append-only ledger. The recommended approach is to **treat every execution record as an immutable event** following event sourcing semantics:

**Immutability enforcement:**
- No `UPDATE` or `DELETE` on `executions` records — only `INSERT` (Convex `ctx.db.insert`).
- Status changes are new records, not patches. A completed execution is a separate record linked to the initiating record via `correlationId`.
- If a correction is needed (e.g., cost recalculation), write a new `correction` event referencing the original, never overwrite.

**Event schema (extend existing `executions` table):**

```typescript
executions: defineTable({
  // Identity
  workflowId: v.optional(v.id("workflows")),
  workflowStepId: v.optional(v.string()),
  agentId: v.id("agents"),
  agentName: v.string(),
  correlationId: v.string(),         // Traces a causal chain across events

  // Action
  eventType: v.union(
    v.literal("step_started"),
    v.literal("tool_called"),
    v.literal("llm_request"),
    v.literal("llm_response"),
    v.literal("step_completed"),
    v.literal("step_failed"),
    v.literal("budget_exceeded"),
    v.literal("workflow_halted"),
  ),

  // Payload (model-specific data)
  inputPayload: v.optional(v.any()),    // Prompt, tool args, etc.
  outputPayload: v.optional(v.any()),   // Response, tool result, etc.

  // Economics
  model: v.optional(v.string()),
  inputTokens: v.optional(v.number()),
  outputTokens: v.optional(v.number()),
  estimatedCostUsd: v.optional(v.number()),

  // Timing
  startedAt: v.number(),               // Unix ms
  completedAt: v.optional(v.number()),
  durationMs: v.optional(v.number()),

  // Provenance
  triggeredBy: v.optional(v.string()), // "user:abc" | "cron" | "agent:xyz"
  createdAt: v.number(),               // Immutable insert timestamp
})
```

**Replay capability:** Because every state transition is a discrete event with full payload capture, any execution can be replayed by streaming its events in order by `createdAt`. A `replayWorkflow` function would read all events for a `workflowId` sorted by timestamp and return the ordered event stream.

### 4.3 Scale Considerations

At Mission Control v1 scale (10 agents, single operator), Convex is fully sufficient for audit log storage and query. The existing `executions` table with proper indexes (`by_workflowId`, `by_agentId`, `by_createdAt`) handles this easily.

If the system scales to multi-tenant enterprise (v2+), consider a **dual-write pattern**:
- Convex `executions`: Hot store for recent 7-day lookback and real-time UI.
- **ClickHouse** (append-only, columnar, 6x compression vs. Postgres): Cold store for 90-day compliance retention and analytical queries. ClickHouse's MergeTree engine is designed for exactly this use case — high-volume, append-only telemetry with fast time-range queries.

For v1, this complexity is not justified. Convex is the right choice.

### 4.4 Audit Log Best Practices

| Practice | Rationale |
|---|---|
| Append-only via code convention (no UPDATE/DELETE) | Immutability without needing DB-level enforcement |
| `correlationId` ties causal chain | Enables full trace reconstruction from any event |
| Store raw input/output payloads | Required for replay; compliance needs original prompts |
| Capture `triggeredBy` provenance | Audit requires who initiated an action |
| Separate `eventType` enum from `status` | Events describe what happened; status describes outcome |
| Index by `(workflowId, createdAt)` | Primary access pattern for replay and timeline view |
| Index by `(agentId, createdAt)` | Per-agent history view |

---

## 5. Off-the-Shelf vs. Custom-Built Tradeoffs

### Decision Framework

| Criterion | Off-the-Shelf | Custom |
|---|---|---|
| Time to first working prototype | Fast (days) | Slow (weeks) |
| Control plane semantics match | Often imperfect; requires adaptation | Exact fit by definition |
| Lock-in risk | High (vendor API changes break you) | Low |
| Integration depth with Convex | Varies; often requires adapters | Native |
| Observability | Framework provides it, but may not match UI needs | Build exactly what's needed |
| Maintenance burden | Upstream manages; you absorb breaking changes | You own it fully |
| Community + ecosystem | Larger pool of solutions | Internal knowledge only |

### Recommendation Matrix for Mission Control

| Layer | Off-the-Shelf | Custom | Verdict |
|---|---|---|---|
| Workflow execution engine | `@convex-dev/workflow` | — | **Use off-the-shelf** — It runs on existing Convex infra, zero ops overhead |
| DAG representation + validation | `graphlib` for cycle detection | Simple JSON schema | **Hybrid** — Use `graphlib` for validation logic; custom JSON schema for storage |
| Agent orchestration (step dispatch) | `@convex-dev/workflow` | Custom Convex mutations | **Use off-the-shelf for durability; custom for business logic** |
| Token instrumentation | `@traceloop/node-server-sdk` (OpenLLMetry-JS) | Manual span creation | **Use off-the-shelf** — Standard OTel conventions; minimal code |
| Cost accounting | Custom Convex `executions` table extension | — | **Custom** — Existing schema fits; no new service needed |
| Budget enforcement | — | Convex pre-execution check mutation | **Custom** — Simple enough; avoids gateway complexity |
| Audit log storage | Convex (existing) | — | **Use existing** — Append-only semantics enforceable in code |
| LLM observability dashboard | Langfuse (v2+) | Extend Mission Control UI | **Custom for v1; off-the-shelf for v2** |
| LLM gateway / cost enforcement | LiteLLM or Helicone (v2+) | — | **Defer to v2** — Pull model sufficient for single-operator v1 |

---

## 6. Recommended 2025 Tech Stack for Mission Control

### Stack Summary

```
Control Plane Layer          Technology                   Version        Confidence
─────────────────────────────────────────────────────────────────────────────────
Workflow execution engine   @convex-dev/workflow          stable 2025    HIGH
DAG cycle validation        graphlib                      ^3.0.0         HIGH
Token instrumentation       @traceloop/node-server-sdk    latest         HIGH
Cost accounting             Convex executions table       (custom)       HIGH
Budget enforcement          Convex pre-step mutation      (custom)       HIGH
Audit log storage           Convex executions table       (custom)       HIGH
Agent orchestration         Custom Convex mutations       (custom)       HIGH
Workflow DSL/schema         TypeScript + Zod + Convex     (custom)       HIGH
Observability UI            Mission Control Next.js UI    (custom)       HIGH
```

**Deferred to v2+:**
- Langfuse (standalone LLM observability) — when multi-user or multi-model analytics needed
- LiteLLM / Helicone (LLM gateway with hard budget enforcement) — when pre-call enforcement required
- ClickHouse (cold audit log store) — when retention exceeds Convex cost/performance tradeoffs
- Temporal or Hatchet (advanced workflow engine) — when workflow complexity exceeds Convex capabilities

### 6.1 Core Rationale

**Why `@convex-dev/workflow` instead of Inngest/Temporal/Mastra:**
- Zero new infrastructure. Mission Control already runs Convex. Adding a workflow engine means adding zero new servers, no separate deployment, no new auth tokens.
- Reactive by default. Convex subscriptions already power the real-time UI; workflow state changes flow to the dashboard automatically.
- Already typed and schema-safe. Convex's strong typing prevents the data corruption that plagues loosely typed workflow engines.
- The constraint in PROJECT.md is explicit: "Must use existing Next.js + Convex architecture. No new languages or frameworks."
- Risk: `@convex-dev/workflow` is newer and has a smaller community than Temporal. Mitigated by Convex's track record and the fact that this is a first-party Convex component.

**Why custom budget enforcement instead of LiteLLM:**
- LiteLLM requires routing all LLM API calls through a proxy service. This adds network latency, a new deployment target, and a potential single point of failure.
- For v1 (single operator, 10 agents), the risk profile doesn't justify the infrastructure addition.
- A Convex pre-execution check is deterministic, observable, and testable with existing Jest infrastructure.
- Tradeoff: No pre-call enforcement (agents can still initiate a call that slightly exceeds budget before the check is recorded). Acceptable for v1; mitigate with a small buffer (e.g., enforce at 90% of budget).

**Why extend `executions` table instead of Langfuse:**
- Langfuse is excellent but requires a separate PostgreSQL database, a separate server process, and a new auth context. This doubles operational complexity.
- The existing `executions` table already captures agent actions. Extending it to capture `inputTokens`, `outputTokens`, `estimatedCostUsd`, `eventType`, and `correlationId` gives audit trail capability without new infrastructure.
- Mission Control's own UI can render this data better than Langfuse's generic views for this specific use case.
- Tradeoff: Less sophisticated analytics than Langfuse out of the box (no funnel analysis, no A/B prompt comparison). Acceptable for v1.

**Why OpenLLMetry-JS for instrumentation:**
- Zero-infrastructure token capture. Wraps Anthropic/OpenAI SDK calls and emits OTel spans with `gen_ai.usage.*` attributes.
- Standard conventions: these spans are directly compatible with any OTel-native backend (Langfuse, Grafana, Datadog) if Mission Control upgrades its observability stack later.
- The instrumentation data feeds directly into the custom cost accounting layer via span processors.

**Why custom DAG representation + `graphlib` for validation:**
- `graphlib` is a 15-year-old, MIT-licensed, battle-tested graph library (used in Webpack's build pipeline). Adding it for cycle detection and topological sort is 50 lines of code, not a framework dependency.
- The workflow DAG itself should be a first-class Convex document (JSON structure), queryable and observable like any other Convex data. Third-party workflow DSLs (Mastra's workflow syntax, LangGraph's state graph API) embed logic that should live in Convex.

---

## 7. Risks and Tradeoffs

### Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `@convex-dev/workflow` API changes (still relatively new) | MEDIUM | HIGH | Pin to specific version; write integration tests against the workflow component interface; monitor Convex changelog |
| Custom budget enforcement has a race window (agent starts call before halt) | HIGH | LOW | Enforce at 90% of budget threshold to create a safety buffer; log enforcement decisions for audit |
| Token reporting depends on agents self-reporting (pull model) | MEDIUM | MEDIUM | Make token reporting non-optional in the gateway protocol; validate in agent provisioning tests |
| Convex `executions` table grows unbounded over 90-day retention window | MEDIUM | MEDIUM | Implement a scheduled `pruneOldExecutions` cron that deletes records older than 90 days; document retention policy |
| `graphlib` not maintained for modern TypeScript (check in 2026) | LOW | LOW | Cycle detection is simple enough to inline if library becomes unmaintained; 50 lines of code |
| OpenLLMetry-JS instrumentation misses token counts for streaming responses | MEDIUM | MEDIUM | Some providers don't emit token counts in streaming mode; implement a fallback estimator (chars/4 heuristic) as a floor |
| Mastra license (Elastic v2) restricts commercial use if considered later | LOW | HIGH | Noted for awareness; Mission Control v1 does not use Mastra; if adopted in v2, legal review required |
| LangGraph JS SDK lags Python in features | LOW | LOW | Not using LangGraph; noted for context if evaluation is revisited |

### Fundamental Architecture Tradeoffs

**Control plane as Convex-native vs. independent orchestration service:**

Keeping the workflow engine inside Convex (via `@convex-dev/workflow`) creates tight coupling between the data layer and the execution layer. The benefit is operational simplicity and reactive observability. The cost is that if Convex's pricing, reliability, or feature trajectory changes, migrating the workflow engine is a significant refactor.

For a single-operator v1 system, this coupling is a net positive. If Mission Control ever becomes multi-tenant or cloud-deployable by third parties, an independent orchestration service (Temporal Cloud, Inngest) provides better portability.

**Pull model for token accounting vs. gateway model:**

The pull model (agents report tokens after execution) is simpler but cannot enforce hard stops before a model call completes. If an agent enters a runaway loop and makes thousands of calls before the halt mutation fires, significant overspend is possible.

For v1 (human-triggered workflows, 10 agents, single operator), this is manageable. For fully autonomous scheduling (v2+), a gateway model that intercepts calls before they are sent to the model provider is strongly recommended.

**Custom audit log vs. event sourcing pattern:**

Pure event sourcing (every state change is an immutable event; current state is derived by replaying events) provides the strongest audit and replay guarantees but adds query complexity. The recommended approach uses event sourcing semantics (append-only events) without a full CQRS/read-model separation, which is a pragmatic compromise.

If replay is exercised frequently in production, a materialized view (a snapshot table updated by Convex scheduled functions) will be needed to avoid replaying thousands of events on every query. Implement snapshotting when replay queries exceed 500ms.

---

## 8. Sources

- [LangGraph Official Site](https://www.langchain.com/langgraph)
- [Mastra TypeScript AI Framework](https://mastra.ai/)
- [Mastra Improved Agent Orchestration with AI SDK v5](https://mastra.ai/blog/announcing-mastra-improved-agent-orchestration-ai-sdk-v5-support)
- [AutoGen v0.4 Announcement](https://devblogs.microsoft.com/autogen/autogen-reimagined-launching-autogen-0-4/)
- [AutoGen v0.4 Microsoft Research](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/)
- [CrewAI Framework 2025](https://latenode.com/blog/ai-frameworks-technical-infrastructure/crewai-framework/crewai-framework-2025-complete-review-of-the-open-source-multi-agent-ai-platform)
- [CrewAI Enterprise Evolution](https://www.crewai.com/blog/how-crewai-is-evolving-beyond-orchestration-to-create-the-most-powerful-agentic-ai-platform)
- [Inngest Checkpointing](https://www.inngest.com/changelog/2025-12-10-checkpointing)
- [Inngest AgentKit and step.ai](https://www.inngest.com/blog/ai-orchestration-with-agentkit-step-ai)
- [Temporal TypeScript Building Bulletproof AI Workflows](https://medium.com/@sylvesterranjithfrancis/temporal-typescript-building-bulletproof-ai-agent-workflows-4863317144ce)
- [Hatchet Documentation](https://docs.hatchet.run/home)
- [Convex Workflow Component](https://www.convex.dev/components/workflow)
- [Convex Durable Agents Component](https://www.convex.dev/components/durable-agents)
- [Convex Agents Need Durable Workflows](https://stack.convex.dev/durable-workflows-and-strong-guarantees)
- [Convex + Mastra Component](https://github.com/get-convex/mastra)
- [OpenTelemetry GenAI Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
- [OpenTelemetry GenAI Spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/)
- [OpenLLMetry GitHub (Traceloop)](https://github.com/traceloop/openllmetry)
- [OpenLLMetry-JS GitHub](https://github.com/traceloop/openllmetry-js)
- [How to Track Token Usage with OpenTelemetry](https://oneuptime.com/blog/post/2026-02-06-track-token-usage-prompt-costs-model-latency-opentelemetry/view)
- [Langfuse Token and Cost Tracking](https://langfuse.com/docs/observability/features/token-and-cost-tracking)
- [Helicone Cost Tracking](https://docs.helicone.ai/guides/cookbooks/cost-tracking)
- [LiteLLM Spend Tracking](https://docs.litellm.ai/docs/proxy/cost_tracking)
- [Top LLM Gateways 2025](https://agenta.ai/blog/top-llm-gateways)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [MCP One Year Anniversary](https://blog.modelcontextprotocol.io/posts/2025-11-25-first-mcp-anniversary/)
- [Mastra vs LangGraph Comparison](https://www.objectwire.org/mastre-ai-vs-langgraph-choosing-the-right-framework-for-building-ai-agents-in-2025)
- [TypeScript Rising: Replacing Python in Multi-Agent AI Systems](https://visiononedge.com/typescript-replacing-python-in-multiagent-systems/)
- [DAG-Based LLM Workflow Orchestration](https://dev.to/ivan_holovach_f2abf13a514/a-dag-based-approach-to-llm-workflow-orchestration-1i98)
- [Postgres + ClickHouse for Agentic AI Scale](https://thenewstack.io/postgres-clickhouse-the-oss-stack-to-handle-agentic-ai-scale/)
- [ClickHouse for Scalable Audit Logs](https://dev.to/epilot/building-a-scalable-audit-log-system-with-aws-and-clickhouse-jn5)
- [Event Sourcing vs Audit Log](https://www.kurrent.io/blog/event-sourcing-audit)
- [Cost Guardrails for Agent Fleets](https://medium.com/@Micheal-Lanham/cost-guardrails-for-agent-fleets-how-to-prevent-your-ai-agents-from-burning-through-your-budget-ea68722af3fe)
- [Forrester Announces Evaluation of Agent Control Plane Market](https://www.forrester.com/blogs/announcing-our-evaluation-of-the-agent-control-plane-market/)
- [The Agent Control Plane: Architecting Guardrails](https://www.cio.com/article/4130922/the-agent-control-plane-architecting-guardrails-for-a-new-digital-workforce.html)
- [Audit Trails in CI/CD for AI Agents](https://prefactor.tech/blog/audit-trails-in-ci-cd-best-practices-for-ai-agents)
- [Zero-Trust for Agents: Immutable Logs](https://www.breakthroughpursuit.com/zero-trust-for-agents/)
- [Building Scalable Systems with CQRS and Event Sourcing](https://www.javacodegeeks.com/2025/10/cqrs-and-event-sourcing-in-practice-building-scalable-systems.html)
- [AWS Multi-Agent Orchestration Guidance](https://aws.amazon.com/solutions/guidance/multi-agent-orchestration-on-aws/)

---

*Research conducted 2025-02-25. Framework versions and feature claims should be verified against official documentation before implementation, as this space evolves rapidly.*
