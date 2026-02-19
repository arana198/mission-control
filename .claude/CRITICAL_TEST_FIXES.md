# Critical Test Fixes - Action Plan

**Priority:** 🔴 HIGH - Must implement before production
**Estimated Effort:** 5-7 days
**Expected Impact:** Increases test coverage from 60% → 85%+

---

## Phase 1: Critical Fixes (1-2 days) ⚡

### 1. Message → Notification Auto-Trigger
**File:** `convex/__tests__/critical-interactions.test.ts` (NEW)
**Gap:** Message creation with mentions doesn't auto-create notifications in tests

**What needs testing:**
```typescript
describe("MESSAGE → NOTIFICATION SYNCHRONIZATION", () => {
  it("create message with single mention → notification created", async () => {
    const msgId = db.insert("messages", {
      taskId, fromId: agent1, content: "Check this", mentions: [agent2]
    });

    // MISSING: Verify notification was created
    const notif = db.query("notifications")
      .filter(n => n.messageId === msgId && n.recipientId === agent2)
      .first();

    expect(notif).toBeTruthy();
    expect(notif.type).toBe("mention");
    expect(notif.read).toBe(false);
  });

  it("create message with @all → notification created for ALL agents except sender", async () => {
    const agents = [agent1, agent2, agent3, agent4].map(a => db.createAgent(a));

    const msgId = db.insert("messages", {
      taskId, fromId: agents[0], content: "@all check", mentionAll: true
    });

    const notifs = db.query("notifications")
      .filter(n => n.messageId === msgId)
      .collect();

    // CRITICAL: Must have exactly 3 (all except sender)
    expect(notifs).toHaveLength(agents.length - 1);
    expect(notifs.map(n => n.recipientId)).not.toContain(agents[0]);
    expect(notifs.every(n => n.read === false)).toBe(true);
  });

  it("thread subscription auto-created when agent mentions/replies", async () => {
    const msgId = db.insert("messages", {
      taskId, fromId: agent1, content: "Starting thread"
    });

    // MISSING: Verify subscription created
    const sub = db.query("threadSubscriptions")
      .filter(s => s.agentId === agent1 && s.taskId === taskId)
      .first();

    expect(sub).toBeTruthy();
    expect(sub.level).toBe("all");
  });

  it("mentioned agents auto-subscribed to thread", async () => {
    const msgId = db.insert("messages", {
      taskId, fromId: agent1, content: "@agent2 check", mentions: [agent2]
    });

    const sub = db.query("threadSubscriptions")
      .filter(s => s.agentId === agent2 && s.taskId === taskId)
      .first();

    expect(sub).toBeTruthy();
  });

  it("thread subscribers (except sender & mentions) notified of new reply", async () => {
    // Setup: multiple subscribers on thread
    const msgId = db.insert("messages", {
      taskId, fromId: agent1, content: "Root"
    });

    // Auto-subscribe sender
    db.insert("threadSubscriptions", { agentId: agent1, taskId, level: "all" });

    // Agent2 also subscribed
    db.insert("threadSubscriptions", { agentId: agent2, taskId, level: "all" });

    // Agent3 mentioned and subscribed
    db.insert("threadSubscriptions", { agentId: agent3, taskId, level: "all" });

    // New message by agent1 mentions agent3
    const replyId = db.insert("messages", {
      taskId, fromId: agent1, content: "Reply", mentions: [agent3], parentId: msgId
    });

    // Notifications:
    // - Agent2 (subscriber but not sender/mentioned): gets notification
    // - Agent3 (mentioned): gets notification
    // - Agent1 (sender): does NOT get notification
    const notifs = db.query("notifications")
      .filter(n => n.messageId === replyId)
      .collect();

    expect(notifs.map(n => n.recipientId)).toContain(agent2);
    expect(notifs.map(n => n.recipientId)).toContain(agent3);
    expect(notifs.map(n => n.recipientId)).not.toContain(agent1);
  });

  it("activity logged when message created", async () => {
    const msgId = db.insert("messages", {
      taskId, fromId: agent1, content: "Comment"
    });

    const activity = db.query("activities")
      .filter(a => a.type === "comment_added" && a.agentId === agent1)
      .filter(a => a.message.includes(taskTitle))
      .first();

    expect(activity).toBeTruthy();
  });
});
```

**Effort:** 2-3 hours
**Impact:** High - catches notification sync failures

---

### 2. Task Completion → Agent Metrics Cascade
**File:** `convex/__tests__/critical-interactions.test.ts`
**Gap:** Task status changes don't trigger metrics updates in tests

**What needs testing:**
```typescript
describe("TASK COMPLETION → AGENT METRICS CASCADE", () => {
  it("when task marked done, agent tasksCompleted incremented", async () => {
    const agent = db.createAgent("solver-1");
    const task = db.createTask("Implementation");

    db.patch(task, { assigneeIds: [agent], status: "in_progress" });

    // Initial metrics
    let metrics = db.getMetricsForAgent(agent);
    const initialCompleted = metrics[0]?.tasksCompleted || 0;

    // Task completed
    db.patch(task, { status: "done" });

    // MISSING: Trigger metrics update
    // Simulate what the mutation would do:
    db.insert("agentMetrics", {
      agentId: agent,
      period: getCurrentMonth(),
      tasksCompleted: initialCompleted + 1
    });

    metrics = db.getMetricsForAgent(agent);
    expect(metrics[metrics.length - 1].tasksCompleted).toBe(initialCompleted + 1);
  });

  it("when task blocked, agent tasksBlocked incremented", async () => {
    // Similar pattern for blocked status
  });

  it("leaderboard position changes with metrics update", async () => {
    const agents = Array.from({length: 3}, (_, i) => db.createAgent(`agent-${i}`));

    // Create initial metrics
    agents.forEach((agent, i) => {
      db.insert("agentMetrics", {
        agentId: agent,
        period: "2026-02",
        tasksCompleted: i * 5 // [0, 5, 10]
      });
    });

    let leaderboard = db.getLeaderboardForPeriod("2026-02", 3);
    expect(leaderboard[0].agentId).toBe(agents[2]); // Highest is first

    // Agent 0 completes 12 tasks
    db.patch(db.getMetricsForAgent(agents[0])[0]._id, {
      tasksCompleted: 12
    });

    leaderboard = db.getLeaderboardForPeriod("2026-02", 3);
    expect(leaderboard[0].agentId).toBe(agents[0]); // Now first
  });

  it("averageCompletionTime calculated on task done", async () => {
    const agent = db.createAgent("solver-1");

    // First task: 30 minutes
    db.insert("executionLog", {
      taskId: "task-1", agentId: agent, timeSpent: 30, status: "success"
    });

    // Second task: 45 minutes
    db.insert("executionLog", {
      taskId: "task-2", agentId: agent, timeSpent: 45, status: "success"
    });

    // MISSING: Verify average is recalculated
    // Average should be (30 + 45) / 2 = 37.5
  });
});
```

**Effort:** 2-3 hours
**Impact:** High - catches metrics desync

---

### 3. Concurrent Mutations - Race Condition Testing
**File:** `convex/__tests__/concurrency.test.ts` (NEW)
**Gap:** No testing of simultaneous operations

**What needs testing:**
```typescript
describe("CONCURRENCY & RACE CONDITIONS", () => {
  it("two agents simultaneously claim same ready task", async () => {
    const task = db.createTask("Feature");
    db.patch(task, { status: "ready" });

    const agent1 = db.createAgent("solver-1");
    const agent2 = db.createAgent("solver-2");

    // Simulate simultaneous assignment attempt
    const update1 = { assigneeIds: [agent1], status: "in_progress" };
    const update2 = { assigneeIds: [agent2], status: "in_progress" };

    db.patch(task, update1);
    db.patch(task, update2); // Second overwrites

    const result = db.get(task);

    // Expected behavior: Last write wins OR system detects conflict
    // This determines if we need optimistic locking
    expect([update1.assigneeIds[0], update2.assigneeIds[0]])
      .toContain(result.assigneeIds[0]);
  });

  it("concurrent message creation on same task", async () => {
    const task = db.createTask("Feature");
    const agents = [db.createAgent("a1"), db.createAgent("a2"), db.createAgent("a3")];

    // Simulate 3 agents posting messages simultaneously
    const messages = agents.map(agent =>
      db.insert("messages", {
        taskId: task,
        fromId: agent,
        content: `Message from ${agent}`,
        replyIds: [],
        mentions: []
      })
    );

    const taskMessages = db.query("messages")
      .filter(m => m.taskId === task)
      .collect();

    // All should be preserved
    expect(taskMessages).toHaveLength(3);
  });

  it("concurrent task status changes", async () => {
    const task = db.createTask("Feature");
    db.patch(task, { status: "in_progress" });

    // Agent1: tries to mark done
    // Agent2: tries to reassign simultaneously

    const final = db.get(task);

    // What's the final state? This defines our concurrency model
    // Option 1: Last write wins (simple, lossy)
    // Option 2: Conflict detected and rejected
    // Current: Undefined - RISK
  });

  it("concurrent metric updates for same agent", async () => {
    const agent = db.createAgent("solver-1");
    const period = "2026-02";

    // Task1 completes
    db.insert("agentMetrics", {
      agentId: agent,
      period,
      tasksCompleted: 1
    });

    // Task2 completes simultaneously
    db.insert("agentMetrics", {
      agentId: agent,
      period,
      tasksCompleted: 1
    });

    const metrics = db.getMetricsForAgent(agent);

    // MISSING: Should we accumulate to 2, or is metrics structure wrong?
    // Current implementation suggests metrics should have ONE entry per agent+period
  });

  it("concurrent goal progress recalculation", async () => {
    const goal = db.createGoal("Q1 Goals");
    const tasks = [db.createTask("T1"), db.createTask("T2")];

    db.patch(goal, { relatedTaskIds: tasks });

    // Task1 completes
    db.patch(tasks[0], { status: "done" });

    // Task2 completes simultaneously
    db.patch(tasks[1], { status: "done" });

    const updatedGoal = db.get(goal);

    // Progress should be 100% (both done)
    // But if updates are concurrent and unsynchronized, could be 50%
  });
});
```

**Effort:** 3-4 hours
**Impact:** Critical - undefined behavior in production

---

### 4. Circular Dependency Detection Across Mutations
**File:** `convex/__tests__/critical-interactions.test.ts`
**Gap:** Cycle detection only tested in isolation

**What needs testing:**
```typescript
describe("CIRCULAR DEPENDENCY PREVENTION", () => {
  it("prevents creating cycle: A→B→C→A", async () => {
    const taskA = db.createTask("A");
    const taskB = db.createTask("B");
    const taskC = db.createTask("C");

    // Create chain
    db.patch(taskB, { dependencies: [taskA] }); // B depends on A
    db.patch(taskC, { dependencies: [taskB] }); // C depends on B

    // MISSING: Try to create cycle
    const shouldFail = () => {
      db.patch(taskA, { dependencies: [taskC] }); // A depends on C (cycle!)
    };

    expect(shouldFail).toThrow("Circular dependency");
  });

  it("prevents self-dependency", async () => {
    const task = db.createTask("Task");

    expect(() => {
      db.patch(task, { dependencies: [task] });
    }).toThrow("Self-dependency");
  });

  it("prevents indirect cycle through multiple steps", async () => {
    const tasks = Array.from({length: 5}, () => db.createTask("Task"));

    // Create chain: 0→1→2→3→4
    tasks.forEach((task, i) => {
      if (i > 0) {
        db.patch(task, { dependencies: [tasks[i-1]] });
      }
    });

    // Try to create cycle: 0 depends on 4
    expect(() => {
      db.patch(tasks[0], { dependencies: [tasks[4]] });
    }).toThrow("Circular dependency");
  });

  it("allows complex DAG that isn't circular", async () => {
    // Multiple parents (DAG structure)
    const tasks = Array.from({length: 4}, () => db.createTask("Task"));

    db.patch(tasks[2], { dependencies: [tasks[0], tasks[1]] }); // 2 depends on both
    db.patch(tasks[3], { dependencies: [tasks[2]] }); // 3 depends on 2

    // This is valid DAG, should not throw
    expect(() => {
      db.patch(tasks[0], { dependencies: [tasks[1]] }); // 0 depends on 1
    }).not.toThrow();
  });
});
```

**Effort:** 2-3 hours
**Impact:** High - prevents system deadlocks

---

## Phase 2: High-Value Fixes (2-3 days)

### 5. Query Result Verification
```typescript
describe("QUERY RESULT CORRECTNESS", () => {
  it("getLeaderboard tie-breaking works correctly", async () => {
    // Agents with same tasksCompleted should sort by commentsMade
  });

  it("getByAgent returns chronological DESC order", async () => {
    // Newest first
  });

  it("findFreeSlots returns results ranked by score", async () => {
    // Best slots first
  });

  it("calendar events in range include boundary cases", async () => {
    // Event starting at exactly startTime
    // Event ending at exactly endTime
  });
});
```

**Effort:** 2-3 hours
**Impact:** High - query correctness

---

### 6. API Layer Integration Tests
```typescript
describe("API LAYER VALIDATION", () => {
  it("POST /api/messages/create validates parameters", async () => {
    // Empty content rejected
    // Invalid taskId rejected
    // Invalid senderId rejected
  });

  it("DELETE /api/messages/{id} checks authorization", async () => {
    // Sender can delete
    // Non-sender cannot delete
    // Returns 403 Forbidden
  });

  it("API response error messages are helpful", async () => {
    // Not just "error"
    // Tells user what's wrong
  });
});
```

**Effort:** 3-4 hours
**Impact:** High - production readiness

---

### 7. Calendar Conflict Detection
```typescript
describe("CALENDAR CONFLICT DETECTION", () => {
  it("overlapping events detected", async () => {
    // Prevent 9-10am overlap with 9:30-10:30
  });

  it("findFreeSlots scoring prefers specified times", async () => {
    // preferBefore/preferAfter affects ranking
  });

  it("gap detection is accurate", async () => {
    // No false positives
    // No missed gaps
  });
});
```

**Effort:** 2-3 hours
**Impact:** Medium - prevents schedule conflicts

---

## Phase 3: Completeness (2-3 days)

### 8. Transaction Semantics
### 9. Time-Based Logic
### 10. Performance Baseline

---

## Implementation Strategy

### File Structure
```
convex/__tests__/
├── critical-interactions.test.ts    (NEW - 40 tests)
├── concurrency.test.ts              (NEW - 15 tests)
├── api-validation.test.ts           (NEW - 25 tests)
├── query-correctness.test.ts        (NEW - 20 tests)
├── supporting-systems.test.ts       (EXISTING - 83 tests)
└── advanced-systems.test.ts         (EXISTING - 39 tests)
```

### Test Execution Plan
```bash
# Run critical fixes only
npm test -- convex/__tests__/critical-interactions.test.ts
npm test -- convex/__tests__/concurrency.test.ts

# Run all new tests
npm test -- convex/__tests__/{critical,concurrency,api,query}

# Verify no regressions
npm test
```

---

## Success Criteria

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Total Tests | 966 | 1050+ | ✓ |
| Cross-mutation tests | 5 | 40+ | ✓ |
| Concurrency tests | 0 | 15+ | ✓ |
| API tests | 0 | 25+ | ✓ |
| Query validation | 10 | 30+ | ✓ |
| Pass Rate | 100% | 100% | ✓ |
| Production Ready | 60% | 80%+ | ✓ |

---

## Timeline

**Week 1:**
- Day 1-2: Message → Notification sync tests
- Day 2-3: Task completion → Metrics cascade
- Day 3-4: Concurrency tests
- Day 4: Circular dependency detection

**Week 2:**
- Day 1-2: Query result verification
- Day 2-3: API layer integration
- Day 3-4: Calendar conflict detection
- Day 5: Cleanup + integration

---

*Priority: 🔴 CRITICAL*
*Estimated Effort: 5-7 days*
*Expected Impact: +85 tests, production readiness 60% → 80%+*
