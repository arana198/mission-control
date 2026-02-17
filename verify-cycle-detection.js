#!/usr/bin/env node

/**
 * Cycle Detection Verification Script
 *
 * This script tests the cycle detection algorithm locally without needing
 * the full testing framework. It simulates the DFS algorithm and validates
 * that cycles are correctly detected.
 *
 * Usage: node verify-cycle-detection.js
 */

// Color output for better visibility
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.cyan}${msg}${colors.reset}`),
};

/**
 * Simulated database of tasks
 */
class MockDatabase {
  constructor() {
    this.tasks = new Map();
  }

  addTask(id, task) {
    this.tasks.set(id, task);
  }

  getTask(id) {
    return this.tasks.get(id) || null;
  }

  async get(id) {
    return this.getTask(id);
  }
}

/**
 * Cycle detection algorithm (matches convex implementation)
 */
async function detectCycle(db, taskId, blockedByTaskId) {
  const visited = new Set();
  const stack = [blockedByTaskId];

  while (stack.length > 0) {
    const currentId = stack.pop();

    // Found a path from blockedByTaskId back to taskId - cycle detected
    if (currentId === taskId) {
      return true;
    }

    // Skip if already visited
    if (visited.has(currentId)) {
      continue;
    }
    visited.add(currentId);

    // Get current task's dependencies
    const currentTask = await db.get(currentId);
    if (!currentTask) {
      continue;
    }

    // Add all tasks that currentTask is blocked by to the stack
    if (currentTask.blockedBy && currentTask.blockedBy.length > 0) {
      for (const depId of currentTask.blockedBy) {
        stack.push(depId);
      }
    }
  }

  return false;
}

/**
 * Test runner
 */
async function runTests() {
  let passed = 0;
  let failed = 0;

  log.header('Testing Cycle Detection Algorithm');

  // Test 1: Self-reference
  {
    log.info('Test 1: Self-reference (A → A)');
    const db = new MockDatabase();
    db.addTask('A', { _id: 'A', title: 'Task A', blockedBy: [], blocks: [] });

    const hasCycle = await detectCycle(db, 'A', 'A');
    if (hasCycle) {
      log.success('Self-reference correctly detected as cycle');
      passed++;
    } else {
      log.error('Self-reference NOT detected (should be detected)');
      failed++;
    }
  }

  // Test 2: Simple cycle A → B → A
  {
    log.info('Test 2: Simple 2-node cycle (A ← B, try B ← A)');
    const db = new MockDatabase();
    db.addTask('A', { _id: 'A', title: 'Task A', blockedBy: ['B'], blocks: [] });
    db.addTask('B', { _id: 'B', title: 'Task B', blockedBy: [], blocks: ['A'] });

    // Try to add B ← A (which would create B ← A ← B cycle)
    const hasCycle = await detectCycle(db, 'B', 'A');
    if (hasCycle) {
      log.success('2-node cycle correctly detected');
      passed++;
    } else {
      log.error('2-node cycle NOT detected (should be detected)');
      failed++;
    }
  }

  // Test 3: Transitive cycle A → B → C → A
  {
    log.info('Test 3: Transitive 3-node cycle (A → B → C → A)');
    const db = new MockDatabase();
    db.addTask('A', { _id: 'A', blockedBy: [], blocks: ['B'] });
    db.addTask('B', { _id: 'B', blockedBy: ['A'], blocks: ['C'] });
    db.addTask('C', { _id: 'C', blockedBy: ['B'], blocks: [] });

    // Try to add C → A (completing the cycle)
    const hasCycle = await detectCycle(db, 'A', 'C');
    if (hasCycle) {
      log.success('3-node cycle correctly detected');
      passed++;
    } else {
      log.error('3-node cycle NOT detected (should be detected)');
      failed++;
    }
  }

  // Test 4: Valid linear chain (no cycle)
  {
    log.info('Test 4: Valid linear chain (A ← B ← C, extend to D)');
    const db = new MockDatabase();
    db.addTask('A', { _id: 'A', blockedBy: ['B'], blocks: [] });
    db.addTask('B', { _id: 'B', blockedBy: ['C'], blocks: ['A'] });
    db.addTask('C', { _id: 'C', blockedBy: [], blocks: ['B'] });
    db.addTask('D', { _id: 'D', blockedBy: [], blocks: [] });

    // Try to add A ← D (extending chain: A ← B ← C; adding D ← A is valid)
    const hasCycle = await detectCycle(db, 'A', 'D');
    if (!hasCycle) {
      log.success('Valid linear chain extension correctly identified (no cycle)');
      passed++;
    } else {
      log.error('Valid chain extension incorrectly flagged as cycle');
      failed++;
    }
  }

  // Test 5: Diamond dependency (no cycle)
  {
    log.info('Test 5: Diamond dependency (A ← B, A ← C, D ← B, D ← C, no cycle)');
    const db = new MockDatabase();
    db.addTask('A', { _id: 'A', blockedBy: ['B', 'C'], blocks: [] });
    db.addTask('B', { _id: 'B', blockedBy: ['D'], blocks: ['A'] });
    db.addTask('C', { _id: 'C', blockedBy: ['D'], blocks: ['A'] });
    db.addTask('D', { _id: 'D', blockedBy: [], blocks: ['B', 'C'] });

    // Try to add B ← C (would this create a cycle?)
    // Current: D → B → A, D → C → A
    // Adding: C → B would make: D → C → B → A (valid)
    const hasCycle = await detectCycle(db, 'B', 'C');
    if (!hasCycle) {
      log.success('Diamond dependency correctly identified (no cycle)');
      passed++;
    } else {
      log.error('Diamond dependency incorrectly flagged as cycle');
      failed++;
    }
  }

  // Test 6: Multiple independent chains
  {
    log.info('Test 6: Multiple independent chains (no cross-dependency)');
    const db = new MockDatabase();
    // Chain 1: A ← B ← C
    db.addTask('A', { _id: 'A', blockedBy: ['B'], blocks: [] });
    db.addTask('B', { _id: 'B', blockedBy: ['C'], blocks: ['A'] });
    db.addTask('C', { _id: 'C', blockedBy: [], blocks: ['B'] });

    // Chain 2: D ← E ← F (independent)
    db.addTask('D', { _id: 'D', blockedBy: ['E'], blocks: [] });
    db.addTask('E', { _id: 'E', blockedBy: ['F'], blocks: ['D'] });
    db.addTask('F', { _id: 'F', blockedBy: [], blocks: ['E'] });

    // Try to add D ← A (connecting chains, should be valid)
    const hasCycle = await detectCycle(db, 'D', 'A');
    if (!hasCycle) {
      log.success('Independent chains can be connected without cycle');
      passed++;
    } else {
      log.error('Chain connection incorrectly flagged as cycle');
      failed++;
    }
  }

  // Test 7: Reverse dependency (try to block the blocker)
  {
    log.info('Test 7: Reverse dependency (A ← B, try B ← A)');
    const db = new MockDatabase();
    db.addTask('A', { _id: 'A', blockedBy: ['B'], blocks: [] });
    db.addTask('B', { _id: 'B', blockedBy: [], blocks: ['A'] });

    // Try to add B ← A (creating the reverse, which cycles)
    const hasCycle = await detectCycle(db, 'B', 'A');
    if (hasCycle) {
      log.success('Reverse dependency correctly detected as cycle');
      passed++;
    } else {
      log.error('Reverse dependency NOT detected (should create cycle)');
      failed++;
    }
  }

  // Test 8: Long chain with cycle attempt
  {
    log.info('Test 8: Long chain (A ← B ← C ← D ← E, try E ← A)');
    const db = new MockDatabase();
    db.addTask('A', { _id: 'A', blockedBy: ['B'], blocks: [] });
    db.addTask('B', { _id: 'B', blockedBy: ['C'], blocks: ['A'] });
    db.addTask('C', { _id: 'C', blockedBy: ['D'], blocks: ['B'] });
    db.addTask('D', { _id: 'D', blockedBy: ['E'], blocks: ['C'] });
    db.addTask('E', { _id: 'E', blockedBy: [], blocks: ['D'] });

    // Try to add E ← A (would create E → D → C → B → A → E cycle)
    const hasCycle = await detectCycle(db, 'E', 'A');
    if (hasCycle) {
      log.success('Long transitive cycle correctly detected');
      passed++;
    } else {
      log.error('Long transitive cycle NOT detected');
      failed++;
    }
  }

  // Test 9: Non-existent task
  {
    log.info('Test 9: Non-existent task handling');
    const db = new MockDatabase();
    db.addTask('A', { _id: 'A', blockedBy: [], blocks: [] });
    // Don't add B

    // Try to add A ← B (B doesn't exist)
    const hasCycle = await detectCycle(db, 'A', 'B');
    if (!hasCycle) {
      log.success('Non-existent task handled gracefully (no crash)');
      passed++;
    } else {
      log.error('Non-existent task caused incorrect cycle detection');
      failed++;
    }
  }

  // Test 10: Empty dependency list
  {
    log.info('Test 10: Tasks with no dependencies');
    const db = new MockDatabase();
    db.addTask('A', { _id: 'A', blockedBy: [], blocks: [] });
    db.addTask('B', { _id: 'B', blockedBy: [], blocks: [] });

    // Try to add A ← B (should be valid)
    const hasCycle = await detectCycle(db, 'A', 'B');
    if (!hasCycle) {
      log.success('Independent tasks can be linked without cycle');
      passed++;
    } else {
      log.error('Independent task linking incorrectly flagged as cycle');
      failed++;
    }
  }

  // Results
  log.header('Test Results');
  console.log(`\n${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
  console.log(`Total: ${passed + failed}\n`);

  if (failed === 0) {
    log.success('All cycle detection tests passed! ✨');
    process.exit(0);
  } else {
    log.error(`${failed} test(s) failed`);
    process.exit(1);
  }
}

// Run tests
runTests().catch((err) => {
  log.error(`Test execution failed: ${err.message}`);
  process.exit(1);
});
