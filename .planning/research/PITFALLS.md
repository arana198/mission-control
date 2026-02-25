# Pitfalls in Multi-Agent Orchestration Systems

**Research Target:** Mission Control v1 design decisions
**Focus:** What organizations get wrong when building multi-agent orchestration at scale
**Date:** 2026-02-25

---

## Executive Summary

Multi-agent orchestration systems fail in ways that are categorically different from traditional software failures. They fail *expensively*, *silently*, and *compoundingly*. A 98% per-agent reliability rate across a 5-agent pipeline yields only 90% overall success, and each unchecked hop multiplies both failure probability and cost. Research from 2024-2025 shows that over 80% of AI agent projects fail to reach production (RAND Corporation, ~2x the failure rate of typical IT projects), and enterprise teams report average cost overruns of 340% above initial estimates.

The four categories below represent the dominant failure modes. Each has early warning signs, a specific prevention strategy, and a clear phase ownership for Mission Control to address it.

---

## 1. Cost Control Failures

### 1.1 Runaway Agent Execution

**What Goes Wrong**

Agents with no hard execution ceiling will run indefinitely. A single misinterpreted task or an infinite self-correction loop converts a $0.02 inference call into hundreds of dollars. Production examples include:

- A Reflexion loop running 10 cycles consuming 50x the tokens of a single linear pass
- A mid-sized e-commerce deployment saw LLM spend spike to $15,000/month within 3 months due to unoptimized prompts and unlimited conversational depth
- One startup saw costs spike 1,700% during a provider outage as retry logic amplified instead of controlled spend

The core trap: unlike traditional software that fails fast and cheap, AI agents fail *expensive and slow*. Every token in every retry costs real money.

**Warning Signs**
- No per-agent token ceiling configured at workflow definition time
- Retry logic uses fixed counts without exponential backoff or circuit breakers
- No wall-clock timeout on task execution
- Cost per workflow is measured only after completion, not tracked in-flight

**Prevention Strategy for Mission Control**
- Hard token budget per agent per task, enforced at the orchestration layer before execution begins
- Wall-clock timeout per task (e.g., 5 minutes default, configurable per workflow)
- Real-time in-flight cost tracking with automatic halt when budget is exceeded
- Circuit breaker pattern: if an agent retries the same action 3 times without progress, halt and escalate to human review
- Dead letter queue for halted tasks — they must not silently disappear

**Phase Ownership:** Architecture (budget enforcement must be baked into the data model, not added as a UI feature later)

---

### 1.2 Token Attribution Gaps and Silent Cost Accumulation

**What Goes Wrong**

Different LLM providers tokenize differently. OpenAI, Anthropic, and Bedrock each use distinct tokenization strategies, and function/tool calls add hidden overhead that most cost dashboards do not capture. In multi-agent systems, this compounds because:

- Agent role definitions themselves consume tokens on every call
- Inter-agent communication messages add overhead invisible to individual agent metrics
- Parallel tool calls in a single agent turn are counted inconsistently across providers
- Retry tokens are not attributed to the task that caused the retry

The result: teams can see *total* spend but cannot trace tokens to a specific workflow, agent, task, or even feature. Billing pages tell you "how much" but not "who" or "why."

**Warning Signs**
- Token tracking captures only final output, not retries or tool calls
- Costs cannot be filtered by workflow, agent type, or time window
- No budget alert until end-of-month billing cycle
- Sampling used for cost estimation (sampling misses edge cases and burst events)

**Prevention Strategy for Mission Control**
- Log every LLM API call with a full metadata envelope: `{ taskId, workflowId, agentId, modelId, inputTokens, outputTokens, toolCallTokens, retryCount, timestamp }`
- Never use sampling for cost tracking — every call must be accounted for
- Attribute costs at the moment of the call, not at workflow completion
- Build a cost ledger in Convex that accumulates atomically, so cost totals are always current
- Provider-normalized token counts: abstract away provider differences at the gateway layer

**Phase Ownership:** Architecture (data model) + Execution (per-call logging in gateway handler)

---

### 1.3 Quadratic Context Growth Billing Trap

**What Goes Wrong**

As agent conversations grow longer, context window consumption grows non-linearly. Agents that pass full conversation history to sub-agents, or sub-agents that return full output instead of summaries, generate quadratic token growth. At scale with 10,000 daily users and a 5-agent pipeline, a 2% per-agent context inefficiency produces thousands of wasted dollars per day.

**Warning Signs**
- Sub-agents receive full parent context instead of task-scoped context
- No summarization step between agents passing control
- Context size is not monitored as a metric
- No per-call context budget enforced

**Prevention Strategy for Mission Control**
- Enforce context isolation by default: sub-agents receive only the information required for their task, not full parent history
- Mandate a structured handoff schema: agents pass `{ taskId, inputs, constraints, parentSummary }` — never raw conversation history
- Monitor context window utilization per agent call as a first-class metric
- Set a per-call context size alert threshold (e.g., warn at 60%, halt at 90%)

**Phase Ownership:** Architecture (handoff schema design) + Monitoring (context utilization metrics)

---

## 2. Auditability Failures

### 2.1 Insufficient Logging Depth

**What Goes Wrong**

Most observability tools capture only the LLM layer — the final prompt and the final response. This leaves five other critical layers unlogged:

1. **Trigger layer** — what event or user action started the workflow
2. **Orchestration layer** — which agents were selected and why
3. **Tool execution layer** — what external APIs were called, with what parameters, and what they returned
4. **Inter-agent communication layer** — what was passed from one agent to another
5. **Side-effect layer** — what the agent actually *did* (files written, APIs mutated, data changed)

Without these layers, when something goes wrong (and it will), engineers cannot answer: "What decision caused this outcome?" This makes debugging nearly impossible and compliance audits unpassable.

**Warning Signs**
- Logs show LLM responses but not tool call inputs/outputs
- No unique execution trace ID that spans the entire workflow
- Cannot reconstruct the sequence of events from logs alone
- Log retention is shorter than compliance requirements (90 days minimum)

**Prevention Strategy for Mission Control**
- Assign a globally unique `executionId` at workflow start; all downstream events carry it
- Log at all six layers with structured JSON: `{ executionId, timestamp, layer, agentId, action, inputs, outputs, durationMs, cost }`
- Tool call logs must capture the exact API request and response, not just a summary
- Inter-agent handoff logs must capture the full structured payload in both directions
- Audit logs must be immutable — write-once, append-only storage with no delete capability in the application layer

**Phase Ownership:** Architecture (log schema design must be defined before any agent is implemented)

---

### 2.2 Lost State and Non-Reproducible Runs

**What Goes Wrong**

Multi-agent runs are often non-deterministic by design (LLMs sample from a probability distribution). However, the *conditions* of a run — the prompts, tool versions, model versions, context passed, and configuration — must be deterministically reconstructable. Without this, failures cannot be reproduced, fixes cannot be verified, and regression testing is impossible.

The most common failure: state is held in-memory during execution and lost if the process crashes, the WebSocket disconnects, or the container restarts. There is no checkpoint to resume from, so the workflow either silently stalls or restarts from scratch (re-incurring full cost with potential duplicate side effects).

**Warning Signs**
- Workflow state exists only in process memory during execution
- A WebSocket disconnect causes task state loss
- No checkpoint/resume capability for long-running workflows
- Cannot replay a past execution with the same inputs and configuration

**Prevention Strategy for Mission Control**
- Persist workflow state in Convex at every meaningful transition, not just at completion
- State machine model: every task has an explicit status (`pending`, `running`, `waiting_for_tool`, `completed`, `failed`, `halted`) persisted to the database, never inferred from in-memory state
- Snapshot the full execution context at each agent handoff: model version, prompt template version, configuration hash
- Provide a "replay from checkpoint" capability: given an `executionId`, reconstruct and re-run from any saved checkpoint
- The audit log IS the state — if the log is complete, the execution can be replayed

**Phase Ownership:** Architecture (state machine in Convex schema) + Execution (checkpoint writes at every transition)

---

### 2.3 Hallucination Propagation Through Agent Chains

**What Goes Wrong**

In a multi-agent pipeline, Agent A's hallucinated output enters Agent B's context as if it were ground truth. Agent B's conclusions — now built on a false foundation — propagate to Agent C. Each hop amplifies the original error. By the time the failure is visible, the source is three agents upstream and the audit trail (if it exists) is the only way to find it.

This is compounded by context poisoning: if agents share memory or a shared context store, one agent's confidently wrong assertion can contaminate subsequent reasoning across the entire system.

**Warning Signs**
- No validation step between agents in the pipeline
- Agents pass raw LLM output to next agent without schema enforcement
- Agents trust outputs from other agents at the same level as ground truth external data
- No confidence or uncertainty signal passed alongside outputs

**Prevention Strategy for Mission Control**
- Treat inter-agent messages like untrusted API responses: validate against a schema before passing downstream
- Structural output enforcement: agents must return structured outputs (JSON with defined schemas), not freeform text, when handing off to another agent
- Add a lightweight validation gate between agents: check required fields, type correctness, and range constraints before forwarding
- Log the originating agent on every piece of data so downstream agents can apply appropriate trust levels
- For high-stakes workflows, add an explicit verification agent as a pipeline step after any agent whose output will trigger irreversible side effects

**Phase Ownership:** Architecture (inter-agent contract schema) + Execution (validation gates)

---

## 3. Workflow Reliability Failures

### 3.1 Implicit Dependencies and Hidden Ordering Assumptions

**What Goes Wrong**

This is the most common mistake in workflow composition, accounting for approximately 42% of multi-agent failures (per Berkeley AI research). Agents begin making implicit assumptions about state, ordering, and validation that are never formalized. A planner may assign steps in YAML while the executor expects JSON. Agent A assumes Agent B has already run. Agent C assumes a shared resource is available.

These assumptions work in development (where the happy path is always tested) but break in production when timing, ordering, or data shape varies. The failures are often intermittent and nearly impossible to reproduce without a complete audit trail.

**Warning Signs**
- Workflow dependencies are documented in comments or READMEs, not enforced in code
- Changing agent A requires manually knowing to also update agent B
- Data format mismatches only surface at runtime, not at workflow definition time
- Agents access shared mutable state without coordination

**Prevention Strategy for Mission Control**
- Explicit dependency graphs: every workflow node must declare its inputs, outputs, and dependencies at definition time, not at runtime
- Schema-validated handoffs: define the data contract between every pair of agents as a typed schema; workflow composition fails at definition time if contracts don't match
- No implicit shared state: agents communicate through defined message channels, not shared mutable objects
- Dependency graph validation at workflow save time: detect cycles, missing outputs, and type mismatches before the workflow ever runs

**Phase Ownership:** Architecture (workflow definition data model with typed contracts)

---

### 3.2 Missing Error Handling and Silent Failure Modes

**What Goes Wrong**

Agent systems fail quietly. Most agent failures don't throw clear exceptions — they produce subtly wrong outputs, silently skip steps, or return partial results that look plausible. At scale with 10,000 daily executions, even a 1% silent failure rate produces 100 corrupted outputs per day that nobody notices.

The specific failure modes:
- **Tool call failures** — an agent calls an external API that fails; the agent either halts silently or invents a plausible result
- **Partial completion** — an agent completes 3 of 5 sub-tasks and marks itself done
- **Graceful degradation that shouldn't be graceful** — agent catches an exception, logs it internally, and continues with stale/wrong data
- **Missing fallbacks** — no alternative path exists when the primary agent approach fails

**Warning Signs**
- Error handling is `try/catch` with a generic log, no escalation
- Workflow status is `completed` even when some steps failed
- No distinction between "task completed" and "task completed successfully"
- No dead letter queue — failed tasks disappear

**Prevention Strategy for Mission Control**
- Explicit task status enum: `completed_success`, `completed_partial`, `completed_with_errors`, `failed` — never collapse these into a single "done" state
- Dead letter queue: every failed task must land somewhere observable, never be silently dropped
- Failure modes must be defined at workflow authoring time: for each agent step, define what happens on failure (retry, escalate, fallback to alternative agent, halt workflow)
- Error payloads must be first-class objects persisted to the audit log: `{ errorCode, agentId, toolCallId, errorMessage, retryCount, finalStatus }`
- Downstream agents must be able to detect when their input came from a degraded upstream step

**Phase Ownership:** Architecture (status enum in schema, dead letter queue) + Execution (failure routing in orchestrator)

---

### 3.3 Cascading Failures from Shared Resources

**What Goes Wrong**

When multiple agents share a resource — a database, an external API, a rate-limited service — a single agent's retry storm can exhaust the resource for all concurrent agents. This is the multi-agent equivalent of a thundering herd. A provider outage that triggers aggressive retry logic across 20 concurrent agents can generate 20x the API traffic, causing the outage to cascade.

Race conditions in shared state are equally dangerous: simultaneous state updates cause data corruption that is difficult to trace because the bug only manifests under concurrent load.

**Warning Signs**
- Retry logic is not coordinated across agents sharing the same external resource
- No rate limiting at the orchestration layer (only at the individual agent layer)
- Shared mutable state accessed by concurrent agents without locking or optimistic concurrency
- No isolation between workflows — a runaway workflow can starve a healthy one

**Prevention Strategy for Mission Control**
- Orchestrator-level rate limiting: budget API call quotas across all concurrent agents, not just per-agent
- Resource isolation between workflows: each workflow execution gets its own resource allocation
- Optimistic concurrency control for shared Convex state: use transactions with version checks, fail fast on conflict rather than silently overwriting
- Jitter in retry backoff: never retry all agents at the same moment
- Circuit breaker at the orchestration layer: if an external service failure rate exceeds a threshold, halt all new requests to that service and queue them for retry

**Phase Ownership:** Execution (orchestrator resource management) + Architecture (Convex transaction design)

---

## 4. Governance Failures

### 4.1 Approval Exhaustion and Governance Bypass

**What Goes Wrong**

Governance systems that rely primarily on human approval gates fail through approval fatigue. When users are prompted to approve agent actions repeatedly, they begin approving destructive commands with minimal review. This is not a hypothetical — it is the documented failure mode of systems like traditional RBAC combined with high-frequency autonomous agents.

The opposite failure is equally dangerous: governance so coarse-grained that a single approval covers a broad class of actions, meaning a single mistaken approval authorizes far more than intended.

**Warning Signs**
- Human approval required for every minor agent action
- Approval UI shows action type without showing exact parameters or downstream effects
- "Approve all similar" shortcuts exist and are commonly used
- Budget approval is a one-time gate, not a per-workflow check

**Prevention Strategy for Mission Control**
- Risk-stratified approvals: define action risk tiers (read, write, irreversible, financial) and require approval only for high-risk tiers
- Approval requests must show exact parameters and estimated cost, not just action type — "write 3 files in /src/components" is approvable; "write files" is not
- Budget approval is enforced at the orchestration layer independently of action approval — they are separate gates
- Hard policy rules that cannot be approved away: certain action classes (e.g., production database deletes, external payments) require a mandatory review period regardless of approval
- Time-bound approvals: approvals expire and cannot be reused across workflow runs

**Phase Ownership:** Architecture (risk tier classification in workflow definition) + Execution (policy engine at orchestrator)

---

### 4.2 Permission Scope Creep and Least Privilege Violations

**What Goes Wrong**

Agents are granted broad permissions for convenience during development and those permissions are never narrowed for production. According to OWASP's MCP Top 10 (2025), privilege escalation via scope creep is a top-2 vulnerability. Unlike human users, agents do not experience permission fatigue — they use every permission they have, every time, without hesitation.

The specific failure in multi-agent systems: an agent provisioned to create pull requests also has merge permissions; it uses them when the orchestrator fails to specify otherwise. A developer productivity agent meant to read code ends up able to write to production branches.

**Warning Signs**
- Agent permissions are defined once at provisioning time and never reviewed
- Permission grants use wildcards (`repo:write:*`) where scoped grants would suffice
- No audit log of what permissions each agent actually exercised (vs. what it was granted)
- Agent permissions are not scoped to a specific workflow execution — they persist across runs

**Prevention Strategy for Mission Control**
- Least-privilege by default: define the minimum required permissions for each workflow step at workflow authoring time, not at agent provisioning time
- Session-scoped credentials: each workflow execution receives a short-lived, scoped credential that expires when the execution completes
- Permission audit logging: log what each agent actually *did* with its permissions, not just what it was granted
- Regular permission reviews surfaced in the Mission Control UI: "Agent X was granted Y but has never used it in 30 days"
- Policy-enforced permission ceiling: no agent can be granted permissions that exceed its workflow's defined scope, regardless of what the provisioning system allows

**Phase Ownership:** Architecture (session-scoped credential model) + Governance (permission review UI)

---

### 4.3 Policy Drift and Behavioral Divergence Over Time

**What Goes Wrong**

Agent behavior drifts. Model updates from providers change output characteristics without changing the API contract. Prompt templates that worked under model version N produce different (worse) behavior under model version N+1. Agents operating within a feedback loop gradually expand their interpretation of their mandate.

The insidious aspect: policy drift is slow and hard to detect. The system continues working well enough that alarms don't fire, but the delta between intended behavior and actual behavior accumulates. By the time the drift is visible, it has been happening for weeks.

**Warning Signs**
- No baseline behavioral tests that run on a schedule (only run when changes are deployed)
- Model version is not pinned — agents use "latest" implicitly
- No mechanism to detect when an agent's output distribution has shifted
- Governance policies are defined in documentation, not enforced at runtime

**Prevention Strategy for Mission Control**
- Pin model versions at the workflow level: a workflow definition specifies the exact model and version, and upgrades are explicit decisions logged to the audit trail
- Scheduled behavioral regression tests: run a suite of representative inputs weekly against live agents and alert on output distribution shifts
- Policy enforcement at runtime, not just at design time: governance rules must be checked on every execution, not assumed from the workflow definition
- Behavioral drift metrics: track aggregate output characteristics (length, schema conformance, confidence scores) as time-series metrics; alert on statistical anomalies
- Explicit model upgrade workflow: upgrading a model version requires a workflow change, a test run, and an approval, not just a configuration update

**Phase Ownership:** Architecture (model version pinning in workflow schema) + Monitoring (behavioral drift detection)

---

### 4.4 Compliance Gaps from Insufficient Governance Depth

**What Goes Wrong**

Organizations treat governance as a checkbox: they add an approval UI, call it "human-in-the-loop," and consider the compliance requirement satisfied. Actual compliance requirements for autonomous systems in enterprise contexts (SOC 2, GDPR, financial services regulation) require:

- Complete records of every decision made and by whom (or what)
- The ability to explain any output
- Evidence that policies were enforced, not just that they existed
- Retention of records for a defined period (commonly 2-7 years, not 90 days)

**Warning Signs**
- Audit logs capture high-level workflow outcomes but not intermediate decisions
- Compliance audit relies on manual review of logs rather than structured queries
- No evidence that governance policies were actually enforced (only that they were defined)
- Log retention policy is driven by storage cost, not compliance requirements

**Prevention Strategy for Mission Control**
- Compliance-first audit log design: define log structure against the requirements of the most demanding likely compliance framework, not against current convenience
- Decision provenance: every output the system produces must be traceable to specific inputs, agent versions, model versions, and prompts — stored immutably
- Policy enforcement receipts: when a governance policy is evaluated, log the evaluation result alongside the policy version that was checked — not just that the policy existed
- Long-term log archival: separate operational logs (short TTL, high query speed) from compliance archives (long retention, immutable, cold storage)
- Structured compliance queries: the audit log must be queryable by time, agent, workflow, action type, and cost — not just searchable as raw text

**Phase Ownership:** Architecture (compliance log schema) + Monitoring (retention and archival policy)

---

## 5. Observability vs. Speed Tradeoff Failures

### 5.1 Prioritizing Speed Over Observability

**What Goes Wrong**

Teams ship the first version of an agent system without observability infrastructure, intending to "add logging later." This is the most consequential technical debt in multi-agent systems because observability cannot be effectively retrofitted. The data that should have been captured during early runs — the ground truth of how the system actually behaves — is permanently lost.

The consequences show up at the worst possible time: when a production incident occurs, there is no audit trail; when a compliance audit arrives, there are no records; when costs spike, there is no attribution data.

Real production example: systems that work in demos fail on live data because demos never surface pagination issues, rate limits, auth quirks, or $47-per-conversation edge cases.

**Warning Signs**
- Observability is treated as an operational concern, not an architectural one
- Logging is added reactively after the first production incident
- The team can see that something failed but not what or why
- There is no definition of "a successful run" that is measurable and logged

**Prevention Strategy for Mission Control**
- Observability is a prerequisite, not an enhancement: no workflow can be executed without a logging destination configured
- Define "success" at workflow authoring time as a structured, measurable criterion — not just "no errors thrown"
- The system must be able to answer these questions from logs alone, without access to running processes: (a) what did this agent do, (b) what did it cost, (c) why did it make each decision, (d) what were the side effects
- Observability architecture must be designed before the first agent is implemented

**Phase Ownership:** Architecture (observability as a mandatory system layer, not an optional feature)

---

## Summary Table

| Category | Pitfall | Phase | Warning Sign | Mission Control Must... |
|---|---|---|---|---|
| Cost | Runaway execution | Architecture | No token ceiling | Enforce hard budget per task at orchestration layer |
| Cost | Token attribution gaps | Architecture + Execution | Can't trace cost to workflow | Log every call with full metadata envelope |
| Cost | Quadratic context growth | Architecture + Monitoring | Context size not monitored | Enforce context isolation; pass structured summaries not full history |
| Auditability | Insufficient logging depth | Architecture | Tool calls not logged | Log all 6 layers with unified trace ID |
| Auditability | Lost state and non-reproducibility | Architecture + Execution | State in memory only | Persist state machine in Convex at every transition |
| Auditability | Hallucination propagation | Architecture + Execution | No inter-agent validation | Schema-validate all inter-agent handoffs |
| Reliability | Implicit dependencies | Architecture | Deps in comments not code | Typed dependency graph at workflow definition time |
| Reliability | Silent failure modes | Architecture + Execution | No dead letter queue | Explicit status enum; dead letter queue mandatory |
| Reliability | Cascading resource failures | Execution + Architecture | Per-agent retry only | Orchestrator-level rate limiting and circuit breakers |
| Governance | Approval exhaustion | Architecture + Execution | No risk stratification | Risk-tiered approvals with exact parameter visibility |
| Governance | Permission scope creep | Architecture | Permissions never narrowed | Session-scoped least-privilege credentials |
| Governance | Policy drift | Architecture + Monitoring | No behavioral regression tests | Pin model versions; scheduled behavioral tests |
| Governance | Compliance gaps | Architecture + Monitoring | Logs not queryable | Compliance-first audit schema with immutable retention |
| Observability | Speed over observability | Architecture | Logging added reactively | Observability is a prerequisite for execution, not a feature |

---

## Sources

- [Why Multi-Agent AI Systems Fail and How to Fix Them — Galileo](https://galileo.ai/blog/multi-agent-ai-failures-prevention)
- [Why Do Multi-Agent LLM Systems Fail? — arXiv (Berkeley/MIT research)](https://arxiv.org/html/2503.13657v1)
- [Why Your Multi-Agent System is Failing: The 17x Error Trap — Towards Data Science](https://towardsdatascience.com/why-your-multi-agent-system-is-failing-escaping-the-17x-error-trap-of-the-bag-of-agents/)
- [QCon SF 2024: Ten Reasons Your Multi-Agent Workflows Fail — InfoQ](https://www.infoq.com/news/2024/11/qconsf-multiagent-fail/)
- [The AI Agent Cost Crisis: 73% of Teams Are One Prompt Away from Budget Disaster — AICosts.ai](https://www.aicosts.ai/blog/ai-agent-cost-crisis-budget-disaster-prevention-guide/)
- [12 Failure Patterns of Agentic AI Systems — Concentrix](https://www.concentrix.com/insights/blog/12-failure-patterns-of-agentic-ai-systems/)
- [Multi-Agent System Reliability: Failure Patterns, Root Causes, and Production Validation Strategies — Maxim.ai](https://www.getmaxim.ai/articles/multi-agent-system-reliability-failure-patterns-root-causes-and-production-validation-strategies/)
- [The Hidden Cost of Agentic Failure — O'Reilly](https://www.oreilly.com/radar/the-hidden-cost-of-agentic-failure/)
- [Multi-Agent Workflows Often Fail. Here's How to Engineer Ones That Don't — GitHub Blog](https://github.blog/ai-and-ml/generative-ai/multi-agent-workflows-often-fail-heres-how-to-engineer-ones-that-dont/)
- [OWASP MCP Top 10 2025: Privilege Escalation via Scope Creep](https://owasp.org/www-project-mcp-top-10/2025/MCP02-2025%E2%80%93Privilege-Escalation-via-Scope-Creep)
- [The Growing Challenge of Auditing Agentic AI — ISACA](https://www.isaca.org/resources/news-and-trends/industry-news/2025/the-growing-challenge-of-auditing-agentic-ai)
- [Risks and Governance for AI Agents in the Enterprise — Skywork](https://skywork.ai/blog/ai-agent-risk-governance-best-practices-2025-enterprise/)
- [Agentic AI Systems Don't Fail Suddenly — They Drift Over Time — CIO](https://www.cio.com/article/4134051/agentic-ai-systems-dont-fail-suddenly-they-drift-over-time.html)
- [Tracking LLM Token Usage Across Providers, Teams and Workloads — Portkey](https://portkey.ai/blog/tracking-llm-token-usage-across-providers-teams-and-workloads/)
- [Trustworthy AI Agents: Kill Switches and Circuit Breakers — Sakura Sky](https://www.sakurasky.com/blog/missing-primitives-for-trustworthy-ai-part-6/)
- [Building Trustworthy AI Agents for Compliance — IBM](https://www.ibm.com/think/insights/building-trustworthy-ai-agents-compliance-auditability-explainability)
- [When AI Agents Trust Each Other: The Multi-Agent Security Problem — DEV Community](https://dev.to/mkdelta221/when-ai-agents-trust-each-other-the-multi-agent-security-problem-nobody-s-solving-1m6)
- [Why Multi-Agent Systems Need Memory Engineering — MongoDB/O'Reilly](https://www.mongodb.com/company/blog/technical/why-multi-agent-systems-need-memory-engineering)
- [Evaluating AI Agents: Real-World Lessons from Amazon — AWS Blog](https://aws.amazon.com/blogs/machine-learning/evaluating-ai-agents-real-world-lessons-from-building-agentic-systems-at-amazon/)
- [AI Agent Orchestration for Production Systems — Redis](https://redis.io/blog/ai-agent-orchestration/)
