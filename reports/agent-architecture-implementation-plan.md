# Agent Swarm Architecture Implementation Plan

**Objective:** Implement the agent orchestration system described by @elvissun  
**Source:** https://x.com/elvissun/status/2025920521871716562  
**Proof Points:** 94 commits/day, 7 PRs in 30 minutes  
**Framework:** Mission Control + OpenClaw compatible  
**Date:** 2026-02-23

---

## 1. Concept Breakdown

### Core Idea (from @elvissun)
Build a two-tier AI system where:
- **Orchestrator (Zoe)** - Holds business context, makes high-level decisions, writes prompts, picks models
- **Coding Agents (Codex/Claude)** - Stay focused on code, have no business context

### Why This Works
```
Context windows are zero-sum:
├── Fill with code → no room for business context
└── Fill with business → no room for code

Two-tier solution:
├── Orchestrator → Business context (customers, meetings, history)
└── Coding agents → Code context only (specialized, efficient)
```

### Proof Points
- 94 commits in one day (most productive)
- Average ~50 commits/day
- 7 PRs in 30 minutes (idea to production)
- Real B2B SaaS with same-day feature delivery

### Key Design Assumptions
- Agents run locally on developer's machine
- Git worktrees provide branch isolation
- JSON registry tracks active tasks
- Telegram for human notifications

---

## 2. The Full 8-Step Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                      ELVISSUN'S WORKFLOW                             │
└─────────────────────────────────────────────────────────────────────┘

  Step 1: Customer Request
           │
           ▼
  Step 2: Zoe (Orchestrator) Scopes & Spawns Agent
           │  - Tops up credits
           │  - Pulls customer data
           │  - Writes detailed prompt
           ▼
  Step 3: Spawn Agent (Codex/Claude) in tmux worktree
           │  - Isolated git branch
           │  - Full context in prompt
           ▼
  Step 4: Cron Monitoring (every 10 min)
           │  - Check tmux sessions
           │  - Check PR status
           │  - Auto-respawn if failed
           ▼
  Step 5: Agent Creates PR
           │  - Commits → pushes → gh pr create
           │  - Definition of done: PR + CI + 3 AI reviews
           ▼
  Step 6: Automated Code Review (3 AI reviewers)
           │  - Codex: Edge cases, logic errors
           │  - Gemini: Security, scalability
           │  - Claude: Validates others' findings
           ▼
  Step 7: Human Review (Telegram notification)
           │  - CI passed
           │  - 3 AI approved
           │  - Screenshots (if UI)
           ▼
  Step 8: Merge → Daily cleanup cron
```

---

## 3. Agent-Based Architecture Design

### Agent Roles

```
┌─────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR (Zoe)                            │
│  - Holds ALL business context                                   │
│  - Spawns coding agents                                         │
│  - Writes prompts with context                                   │
│  - Picks right model (Codex vs Claude vs Gemini)               │
│  - Monitors progress                                            │
│  - Notifies on Telegram when PRs ready                          │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   CODEX       │   │ CLAUDE CODE   │   │   GEMINI      │
│   AGENT       │   │    AGENT      │   │   DESIGNER    │
│               │   │               │   │               │
│ - Backend     │   │ - Frontend    │   │ - UI specs    │
│ - Complex bugs│   │ - Git ops     │   │ - HTML/CSS    │
│ - Multi-file  │   │ - Fast changes│   │ - Design sens │
│   refactors   │   │               │   │               │
│ - Reasoning   │   │               │   │               │
└───────────────┘   └───────────────┘   └───────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ▼
                    ┌───────────────┐
                    │  REVIEWERS    │
                    │               │
                    │ - Codex       │
                    │ - Gemini      │
                    │ - Claude      │
                    └───────────────┘
```

### Task Registry (JSON)

```json
// .clawdbot/active-tasks.json
{
  "id": "feat-custom-templates",
  "tmuxSession": "codex-templates",
  "agent": "codex",
  "model": "gpt-5.3-codex",
  "description": "Custom email templates for agency customer",
  "repo": "medialyst",
  "worktree": "feat-custom-templates",
  "branch": "feat/custom-templates",
  "startedAt": 1740268800000,
  "status": "running",
  "notifyOnComplete": true,
  "definitionOfDone": {
    "prCreated": true,
    "ciPassed": true,
    "codexReview": "passed",
    "claudeReview": "passed",
    "geminiReview": "passed"
  }
}
```

### Agent Spawning

```bash
# Create worktree + spawn agent
git worktree add ../feat-custom-templates -b feat/custom-templates origin/main
cd ../feat-custom-templates && pnpm install

# Launch in tmux with full logging
tmux new-session -d -s "codex-templates" \
  -c "/Users/elvis/Documents/GitHub/medialyst-worktrees/feat-custom-templates" \
  "$HOME/.codex-agent/run-agent.sh templates gpt-5.3-codex high"

# Codex launch
codex --model gpt-5.3-codex \
  -c "model_reasoning_effort=high" \
  --dangerously-bypass-approvals-and-sandbox \
  "Your detailed prompt here"

# Claude Code launch
claude --model claude-opus-4.5 \
  --dangerously-skip-permissions \
  -p "Your detailed prompt here"
```

### Mid-Task Redirection (tmux Power)

```bash
# Redirect agent going wrong direction
tmux send-keys -t codex-templates "Stop. Focus on the API layer first, not the UI." Enter

# Give more context
tmux send-keys -t codex-templates "The schema is in src/types/template.ts. Use that." Enter

# Kill if needed
tmux kill-session -t codex-templates
```

---

## 4. Communication Protocol

### Orchestrator → Agent Prompt Structure

```
SYSTEM: You are an expert backend developer...
CONTEXT:
- Customer: ACME Corp
- Request: Reuse configurations across team
- Existing setup: [pulled from DB]
- Constraints: Must work with existing auth system
- Files to modify: src/config/*, src/api/*
TASK: Build a template system that lets users save/edit configs
DEFINITION OF DONE:
- [ ] PR created
- [ ] CI passing
- [ ] Tests included
- [ ] Documentation updated
```

### Agent → Orchestrator Updates

```json
{
  "taskId": "feat-custom-templates",
  "status": "in_progress",
  "currentStep": "Implementing template CRUD API",
  "filesModified": ["src/config/templates.ts", "src/api/templates.ts"],
  "blocks": [],
  "estimatedCompletion": "10 minutes"
}
```

### Review Results → PR Comments

```json
{
  "reviewer": "codex",
  "result": "approved",
  "comments": [
    { "file": "src/config/templates.ts", "line": 45, "type": "edge_case", "message": "Consider handling null config..." }
  ]
}
```

---

## 5. Orchestration Model

### Mission Control Integration

```
┌────────────────────────────────────────────────────────────────┐
│                    OPENCLAW + MISSION CONTROL                   │
│                                                                 │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐       │
│  │   ZOE        │   │   AGENT      │   │   TASK      │       │
│  │ (Orchestrator)│◄──│   SPAWNER    │◄──│   QUEUE     │       │
│  └──────────────┘   └──────────────┘   └──────────────┘       │
│         │                                    │                  │
│         ▼                                    ▼                  │
│  ┌──────────────────────────────────────────────────────┐      │
│  │              CONVEX (Backend)                         │      │
│  │  - Agent registry    - Task tracking   - Activity log  │      │
│  └──────────────────────────────────────────────────────┘      │
└────────────────────────────────────────────────────────────────┘
```

### Task Assignment Flow

```
USER/BOT
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  1. REQUEST RECEIVED                                        │
│     - Customer feature request                             │
│     - Bug report from Sentry                               │
│     - Meeting note → feature                               │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  2. ZOE SCOPES TASK                                         │
│     - Determines scope                                      │
│     - Picks model (Codex/Claude/Gemini)                     │
│     - Writes detailed prompt with context                   │
│     - Sets definition of done                               │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  3. SPAWN AGENT                                             │
│     - Create git worktree                                   │
│     - Launch in tmux session                                │
│     - Register in task.json                                 │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  4. CRON BABYSITTER (every 10 min)                          │
│     - Check tmux sessions alive                             │
│     - Check PR status via gh cli                           │
│     - Check CI status                                      │
│     - Auto-respawn if failed (max 3)                       │
│     - Only alert if human needed                            │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  5. PR CREATED                                              │
│     - Agent commits, pushes, gh pr create                   │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  6. AI CODE REVIEW (3 reviewers)                            │
│     - Codex: Edge cases, logic errors                       │
│     - Gemini: Security, scalability                         │
│     - Claude: Validate others' findings                     │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  7. TELEGRAM NOTIFICATION                                   │
│     - "PR #341 ready for review"                           │
│     - CI passed, 3 AI approved                             │
│     - Screenshots (if UI)                                   │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  8. HUMAN REVIEW + MERGE                                   │
│     - 5-10 min review (often just screenshots)              │
│     - Merge                                                 │
│     - Daily: cleanup orphaned worktrees                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Monitoring & Babysitter Cron

### The Ralph Loop V2

```bash
#!/bin/bash
# .clawdbot/check-agents.sh

# 1. Check tmux sessions alive
for session in $(tmux list-sessions -F '#{session_name}' 2>/dev/null); do
  if ! tmux has-session -t "$session" 2>/dev/null; then
    echo "Session $session died"
    # Read task from registry
    TASK=$(jq -r ".[] | select(.tmuxSession==\"$session\")" active-tasks.json)
    # Auto-respawn (max 3 attempts)
    RESPAWN_COUNT=$(echo "$TASK" | jq -r '.respawnCount // 0')
    if [ "$RESPAWN_COUNT" -lt 3 ]; then
      echo "Respawning $session (attempt $((RESPAWN_COUNT+1)))"
      # Re-spawn with same prompt
    fi
  fi
done

# 2. Check for open PRs
gh pr list --state open --json number,title,headRefName

# 3. Check CI status
for pr in $(gh pr list --state open --json number --jq '.[].number'); do
  gh pr checks "$pr" --json conclusion
done

# 4. Only alert if human attention needed
if [ "$HUMAN_NEEDED" = "true" ]; then
  curl -X POST "TELEGRAM_WEBHOOK" -d "message=Attention needed: $ISSUE"
fi
```

### Cron Schedule

| Cron | Frequency | Purpose |
|------|-----------|---------|
| Agent Check | Every 10 min | Monitor + respawn |
| Sentry Scan | Every 1 hr | Find new errors |
| Meeting Notes | After meetings | Flag features |
| Git Log Scan | Daily evening | Update docs/changelog |
| Cleanup | Daily | Remove orphaned worktrees |

### Auto-Babysitter Capabilities

```
┌─────────────────────────────────────────────────────────────┐
│                    ZOE BABYSITTER LOGIC                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Agent ran out of context?                                  │
│    → "Focus only on these three files."                     │
│                                                              │
│  Agent went wrong direction?                                 │
│    → "Stop. Customer wanted X, not Y.                       │
│       Here's what they said in the meeting."                │
│                                                              │
│  Agent needs clarification?                                 │
│    → "Here's customer's email and what their company does."│
│                                                              │
│  Agent succeeds?                                            │
│    → Log pattern: "This prompt structure works for billing"│
│    → Log: "Codex needs type definitions upfront"           │
│                                                              │
│  Reward signals:                                            │
│    - CI passing                                             │
│    - All 3 AI reviews passing                               │
│    - Human merge                                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Choosing the Right Agent

| Task Type | Agent | Model | Why |
|-----------|-------|-------|-----|
| Backend logic | Codex | gpt-5.3-codex | Thorough reasoning, edge cases |
| Complex bugs | Codex | gpt-5.3-codex | Multi-file context |
| Refactors | Codex | gpt-5.3-codex | Careful, comprehensive |
| Frontend work | Claude Code | claude-opus-4.5 | Fast, fewer permission issues |
| Git operations | Claude Code | claude-opus-4.5 | Better permissions |
| UI design | Gemini | gemini-2.5 | Design sensibility |
| UI implementation | Claude Code | claude-opus-4.5 | Component system expert |

### Model Selection Logic

```typescript
function selectModel(task: Task): string {
  if (task.type === 'backend' || task.type === 'refactor') {
    return 'gpt-5.3-codex'; // Codex for complexity
  }
  
  if (task.type === 'frontend' || task.type === 'css') {
    if (task.requiresDesign) {
      // Spawn Gemini first for spec, then Claude for implementation
      return 'gemini-2.5-thought';
    }
    return 'claude-opus-4.5'; // Claude for frontend
  }
  
  if (task.type === 'quick-fix') {
    return 'claude-sonnet-4.0'; // Fast and efficient
  }
  
  return 'gpt-5.3-codex'; // Default to thorough
}
```

---

## 8. Kanban Integration

### Board Structure

```
┌──────────┬──────────┬──────────┬──────────┬──────────┬─────────────┐
│ BACKLOG  │  READY   │ IN PROG  │  REVIEW  │   DONE   │   MERGED    │
├──────────┼──────────┼──────────┼──────────┼──────────┼─────────────┤
│ Sentry   │ Feature  │ Codex    │ 3 AI     │ CI pass  │ In main    │
│ errors   │ requests │ working  │ reviews  │ + merged │             │
│          │          │          │          │          │             │
│          │          │          │          │          │             │
├──────────┴──────────┴──────────┴──────────┴──────────┴─────────────┤
│                         AGENT SWIMLANES                         │
│  [codex-main] ████████████░░░ 85%  |  [claude-ui] ██████░░░░░░ 50%  │
└────────────────────────────────────────────────────────────────┘
```

### Automation Triggers

| Event | Trigger | Action |
|-------|---------|--------|
| Sentry error | New error alert | Create task → Assign to Codex |
| Meeting note | "feature" keyword | Create task → Ready for scoping |
| Agent starts | tmux session created | Move to In Progress |
| PR created | gh pr create | Move to Review + spawn reviewers |
| CI passes | GitHub Actions success | Update status |
| 3 reviews pass | All reviewers approved | Notify on Telegram |
| Merged | PR merged | Move to Merged + cleanup worktree |

---

## 9. Scalability Plan

### Current Bottleneck (from article)
> RAM. Each agent needs its own worktree. Each worktree needs its own `node_modules`. Five agents = five parallel TypeScript compilers, five test runners.

### Solution: Tiered Resource Management

```
┌─────────────────────────────────────────────────────────────────┐
│                    SCALABILITY ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  16GB RAM (Current Mac Mini)                                    │
│  ───────────────────────────                                    │
│  Max 3-4 agents simultaneously                                 │
│  Risk: Parallel builds cause swapping                           │
│                                                                  │
│  128GB RAM (Mac Studio M4 Max)                                  │
│  ─────────────────────────────────                              │
│  Max 8-10 agents simultaneously                                │
│  Parallel builds, type checks, tests all OK                    │
│                                                                  │
│  Scaling Strategy:                                              │
│  ────────────────                                               │
│  1. MVP: 2-3 agents, sequential builds                         │
│  2. v1: 5 agents, staggered build windows                      │
│  3. v2: 8-10 agents, parallel build clusters                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Resource Limits

| Resource | Limit per Agent | Total Pool |
|----------|----------------|------------|
| RAM | 4GB | 16GB (4 agents) |
| CPU | 2 cores | 8 cores |
| Concurrent builds | 1 | 4 |
| API calls/min | 60 | 240 |

---

## 10. Implementation Roadmap

### Phase 1: MVP (Week 1-2)
```
□ Task registry JSON file
□ Basic tmux spawn script
□ Simple cron (every 10 min)
□ Manual prompt writing
□ Telegram webhook for notifications
```

### Phase 2: Agent Pool (Week 3-4)
```
□ Codex + Claude Code agents
□ Worktree creation automation
□ Definition of done tracking
□ Basic CI status checking
```

### Phase 3: Multi-Review (Week 5-6)
```
□ Codex reviewer integration
□ Gemini reviewer integration
□ Claude reviewer integration
□ Auto-comment on PRs
```

### Phase 4: Intelligence (Week 7-8)
```
□ Prompt pattern library
□ Auto-retry with better prompts
□ Smart model selection
□ Success/failure pattern logging
```

### Phase 5: Scale (Week 9-12)
```
□ 5-10 concurrent agents
□ Workload balancing
□ Resource monitoring
□ Auto-scale decisions
```

---

## 11. Key Scripts to Create

### Agent Spawner
```bash
#!/bin/bash
# scripts/spawn-agent.sh

AGENT_TYPE=$1
TASK_PROMPT=$2
BRANCH_NAME=$3

# Create worktree
git worktree add ../$BRANCH_NAME -b $BRANCH_NAME origin/main
cd ../$BRANCH_NAME && pnpm install

# Launch in tmux
tmux new-session -d -s "$AGENT_TYPE-$BRANCH_NAME" \
  -c "$(pwd)" \
  "$HOME/.agents/run-$AGENT_TYPE.sh '$TASK_PROMPT'"

# Register task
echo '{"id":"'$BRANCH_NAME'","tmuxSession":"'$AGENT_TYPE-$BRANCH_NAME'","status":"running"}' \
  >> .clawdbot/active-tasks.json
```

### Agent Monitor
```bash
#!/bin/bash
# scripts/monitor-agents.sh

# Check each registered task
for task in $(jq -r '.[].id' .clawdbot/active-tasks.json); do
  SESSION=$(jq -r ".[] | select(.id==\"$task\").tmuxSession" .clawdbot/active-tasks.json)
  
  if ! tmux has-session -t "$SESSION" 2>/dev/null; then
    # Agent died - check if PR exists
    PR=$(gh pr list --head $task --json number --jq '.[].number')
    if [ -z "$PR" ]; then
      # No PR - respawn with same prompt
      echo "Agent $task died without PR - respawning"
    fi
  fi
done
```

---

## 12. Success Metrics

| Metric | Target | Actual (from article) |
|--------|--------|----------------------|
| Commits/day | 50+ | 94 (best day) |
| PRs/hour | 10+ | 7 in 30 min |
| Same-day features | 80% | Most features |
| AI review pass rate | 90%+ | High |
| Manual intervention | <10% | Very low |

---

## Summary

This architecture from @elvissun is proven:
- **94 commits/day** with only 3 client calls
- **7 PRs in 30 minutes** from idea to ready
- **Same-day feature delivery** converting leads to customers

The key insight: **Context separation**
- Orchestrator = Business context (what customer wants, what failed before)
- Agents = Code context only (focused, efficient)

Implementation is straightforward:
1. JSON task registry
2. tmux session management  
3. 10-minute cron babysitter
4. 3-AI code review pipeline
5. Telegram notifications

The bottleneck is RAM - plan for 128GB to run 8+ agents.

**Report generated:** agent-architecture-implementation-plan.md
