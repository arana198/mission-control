/**
 * API Documentation Page
 * Complete reference for Mission Control State Engine APIs
 */

export default function APIDocs() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-2">Mission Control API</h1>
        <p className="text-slate-400 mb-8">
          Complete API reference for Agent Management and State Engine APIs serving OpenClaw autonomous agents
        </p>

        {/* Overview Section */}
        <section className="bg-slate-800 rounded-lg p-6 mb-8 border border-slate-700">
          <h2 className="text-2xl font-bold text-white mb-4">Overview</h2>
          <p className="text-slate-300 mb-4">
            Mission Control provides a comprehensive state engine API that serves as external memory
            for OpenClaw, a stateless AI agent that runs every 30 minutes in heartbeat cycles.
          </p>
          <div className="bg-slate-900 rounded p-4 text-slate-300 text-sm">
            <p className="mb-2"><strong>Base URL:</strong> <code>http://localhost:3000/api</code></p>
            <p className="mb-2"><strong>Authentication:</strong> API Key in Authorization header (future)</p>
            <p><strong>Response Format:</strong> JSON</p>
          </div>
        </section>

        {/* Metrics API */}
        <section className="bg-slate-800 rounded-lg p-6 mb-8 border border-slate-700">
          <h2 className="text-2xl font-bold text-white mb-4">📊 Metrics API</h2>
          <p className="text-slate-300 mb-4">
            Get real-time operational state snapshot. This is the primary API OpenClaw queries to understand
            current system state: queue depth, blocked tasks, agent availability, throughput metrics, and health status.
          </p>

          <div className="bg-slate-900 rounded p-4 mb-6">
            <p className="text-slate-200 font-mono">GET /state-engine/metrics</p>
            <p className="text-slate-400 text-sm mt-2">Get current operational metrics snapshot</p>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-slate-200 font-semibold mb-2">Query Parameters</h4>
              <div className="bg-slate-900 rounded p-4 text-sm text-slate-300 font-mono">
                <p><span className="text-red-400">*</span> businessId (string) - Required. ID of business</p>
              </div>
            </div>

            <div>
              <h4 className="text-slate-200 font-semibold mb-2">Response (200 OK)</h4>
              <div className="bg-slate-900 rounded p-4 text-sm text-slate-300 font-mono overflow-x-auto">
                <pre>{`{
  "timestamp": 1644854400000,
  "businessId": "biz_123",
  "agents": {
    "total": 10,
    "active": 8,
    "idle": 2,
    "blocked": 0
  },
  "queue": {
    "depth": 5,          // Total pending tasks
    "highPriority": 2    // P0 or P1 priority
  },
  "tasks": {
    "total": 50,
    "pending": 5,        // In backlog status
    "inProgress": 12,
    "completed": 33,
    "blocked": 0,        // In progress >20min
    "overdue": 1
  },
  "throughput": {
    "tasksPerHour": 2,
    "avgCompletionTimeMinutes": 45
  },
  "health": {
    "queueHealthy": true,      // < 10 pending
    "blockedHealthy": true,    // 0 blocked tasks
    "throughputHealthy": true, // > 0 tasks/hour
    "agentHealthy": true       // > 0 active agents
  },
  "blockedTasksDetail": [
    {
      "id": "task_456",
      "title": "Review PR",
      "blockedForMinutes": 45,
      "assignedTo": "agent_1",
      "priority": "P0"
    }
  ],
  "overdueTasksDetail": [
    {
      "id": "task_789",
      "title": "Deploy to prod",
      "dueDate": 1644854300000,
      "overdueDays": 1,
      "assignedTo": "agent_2",
      "priority": "P1"
    }
  ]
}`}</pre>
              </div>
            </div>

            <div>
              <h4 className="text-slate-200 font-semibold mb-2">Usage Example</h4>
              <div className="bg-slate-900 rounded p-4 text-sm text-slate-300 font-mono overflow-x-auto">
                <pre>{`curl "http://localhost:3000/api/state-engine/metrics?businessId=biz_123"

// OpenClaw pseudocode
async function openclawHeartbeat() {
  const metrics = await fetch(
    "/api/state-engine/metrics?businessId=current_business"
  ).then(r => r.json());

  if (metrics.queue.depth > 10) {
    // Queue overload! Escalate high-priority items
  }
  if (metrics.tasks.blocked > 0) {
    // Blocked tasks exist, investigate and unblock
  }
}`}</pre>
              </div>
            </div>
          </div>
        </section>

        {/* Alerts API */}
        <section className="bg-slate-800 rounded-lg p-6 mb-8 border border-slate-700">
          <h2 className="text-2xl font-bold text-white mb-4">🚨 Alerts API</h2>
          <p className="text-slate-300 mb-4">
            Get configured alert rules that define when system conditions should trigger notifications.
            Rules have thresholds, cooldown periods, and delivery channels (in-app, Slack, email).
          </p>

          <div className="bg-slate-900 rounded p-4 mb-6">
            <p className="text-slate-200 font-mono">GET /state-engine/alerts</p>
            <p className="text-slate-400 text-sm mt-2">Get enabled alert rules for business</p>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-slate-200 font-semibold mb-2">Query Parameters</h4>
              <div className="bg-slate-900 rounded p-4 text-sm text-slate-300 font-mono">
                <p><span className="text-red-400">*</span> businessId (string) - Required</p>
              </div>
            </div>

            <div>
              <h4 className="text-slate-200 font-semibold mb-2">Response (200 OK)</h4>
              <div className="bg-slate-900 rounded p-4 text-sm text-slate-300 font-mono overflow-x-auto">
                <pre>{`{
  "businessId": "biz_123",
  "rules": [
    {
      "_id": "rule_1",
      "name": "Queue Overload",
      "condition": "queueDepth > threshold",
      "threshold": 10,
      "severity": "warning",
      "cooldownSeconds": 300,
      "channels": ["in-app", "slack"],
      "enabled": true,
      "createdAt": 1644854400000
    },
    {
      "_id": "rule_2",
      "name": "Task Blocked Too Long",
      "condition": "taskBlocked > Xmin",
      "threshold": 20,
      "severity": "critical",
      "cooldownSeconds": 600,
      "channels": ["in-app", "slack"],
      "slackMention": "@openclaw",
      "enabled": true
    }
  ],
  "count": 2
}`}</pre>
              </div>
            </div>
          </div>
        </section>

        {/* Decisions API */}
        <section className="bg-slate-800 rounded-lg p-6 mb-8 border border-slate-700">
          <h2 className="text-2xl font-bold text-white mb-4">📋 Decisions API</h2>
          <p className="text-slate-300 mb-4">
            Get audit trail of all management decisions OpenClaw made: escalations, reassignments, unblocks,
            etc. Includes pattern analysis to help OpenClaw learn what decisions lead to good outcomes.
          </p>

          <div className="bg-slate-900 rounded p-4 mb-6">
            <p className="text-slate-200 font-mono">GET /state-engine/decisions</p>
            <p className="text-slate-400 text-sm mt-2">Get decisions and pattern analysis</p>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-slate-200 font-semibold mb-2">Query Parameters</h4>
              <div className="bg-slate-900 rounded p-4 text-sm text-slate-300 font-mono space-y-1">
                <p><span className="text-red-400">*</span> businessId (string) - Required</p>
                <p>since (number) - Timestamp in ms, get decisions after this time</p>
                <p>action (string) - Filter by action type (escalated, reassigned, unblocked, marked_executed, deprioritized)</p>
                <p>limit (number) - Max results (default: 50)</p>
              </div>
            </div>

            <div>
              <h4 className="text-slate-200 font-semibold mb-2">Response (200 OK)</h4>
              <div className="bg-slate-900 rounded p-4 text-sm text-slate-300 font-mono overflow-x-auto">
                <pre>{`{
  "businessId": "biz_123",
  "decisions": [
    {
      "_id": "dec_1",
      "action": "escalated",
      "taskId": "task_456",
      "reason": "blocking_others",
      "result": "success",
      "decidedBy": "openclaw",
      "decidedAt": 1644854400000,
      "outcome": "task_completed",
      "outcomeAt": 1644854500000,
      "createdAt": 1644854400000
    },
    {
      "_id": "dec_2",
      "action": "reassigned",
      "taskId": "task_789",
      "fromAgent": "agent_1",
      "toAgent": "agent_2",
      "reason": "agent_overloaded",
      "result": "success",
      "decidedBy": "openclaw",
      "decidedAt": 1644854450000
    }
  ],
  "patterns": {
    "totalDecisions": 42,
    "successRate": 95,
    "byAction": {
      "escalated": { "count": 12, "successful": 11 },
      "reassigned": { "count": 18, "successful": 18 },
      "unblocked": { "count": 12, "successful": 12 }
    },
    "byReason": {
      "blocking_others": { "count": 5, "successful": 5 },
      "agent_overloaded": { "count": 12, "successful": 12 }
    }
  },
  "count": 42
}`}</pre>
              </div>
            </div>
          </div>
        </section>

        {/* Actions API */}
        <section className="bg-slate-800 rounded-lg p-6 mb-8 border border-slate-700">
          <h2 className="text-2xl font-bold text-white mb-4">⚙️ Actions API</h2>
          <p className="text-slate-300 mb-4">
            Execute management decisions. OpenClaw uses these to escalate tasks, reassign agents,
            unblock dependencies, and mark tasks as completed.
          </p>

          {/* Unified Task Actions */}
          <div className="bg-slate-900 rounded p-4 mb-6">
            <p className="text-slate-200 font-mono mb-2">PATCH /api/tasks/:taskId</p>
            <p className="text-slate-400 text-sm">Execute task action (escalate, reassign, unblock, mark-executed, etc.)</p>
            <div className="mt-3 bg-slate-800 rounded p-3 text-sm text-slate-300 font-mono">
              <p className="mb-2 text-slate-400">Escalate task to P0:</p>
              <pre>{`{
  "action": "escalate",
  "businessId": "biz_123",
  "reason": "blocking_other_tasks",
  "decidedBy": "openclaw"
}`}</pre>
              <p className="mb-2 text-slate-400 mt-3">Reassign task:</p>
              <pre>{`{
  "action": "reassign",
  "toAgent": "agent_2",
  "reason": "current_agent_overloaded",
  "decidedBy": "openclaw"
}`}</pre>
              <p className="mb-2 text-slate-400 mt-3">Unblock task:</p>
              <pre>{`{
  "action": "unblock",
  "reason": "dependency_resolved",
  "decidedBy": "openclaw"
}`}</pre>
              <p className="mb-2 text-slate-400 mt-3">Mark executed:</p>
              <pre>{`{
  "action": "mark-executed",
  "outcome": "Successfully deployed to production",
  "decidedBy": "openclaw"
}`}</pre>
            </div>
          </div>

          <div>
            <h4 className="text-slate-200 font-semibold mb-2">Standard Response (200 OK)</h4>
            <div className="bg-slate-900 rounded p-4 text-sm text-slate-300 font-mono overflow-x-auto">
              <pre>{`{
  "success": true,
  "action": "escalated",
  "taskId": "task_456",
  "decisionId": "dec_123",
  "message": "Task escalated to high priority"
}`}</pre>
            </div>
          </div>
        </section>

        {/* Architecture Section */}
        <section className="bg-slate-800 rounded-lg p-6 mb-8 border border-slate-700">
          <h2 className="text-2xl font-bold text-white mb-4">🏗️ Architecture</h2>
          <p className="text-slate-300 mb-4">
            Mission Control follows a stateless agent pattern:
          </p>
          <div className="bg-slate-900 rounded p-4 text-sm text-slate-300 space-y-2">
            <p>
              <strong className="text-slate-200">OpenClaw (Agent)</strong> →
              <span className="text-slate-400"> Stateless, wakes every 30 minutes</span>
            </p>
            <p>
              <strong className="text-slate-200">Mission Control (State Engine)</strong> →
              <span className="text-slate-400"> Remembers everything, serves as external memory</span>
            </p>
            <p className="mt-4">
              <strong className="text-slate-200">Heartbeat Cycle:</strong>
            </p>
            <ol className="list-decimal list-inside ml-4 space-y-1 text-slate-400">
              <li>Wake up, ask for metrics (queue depth, blocked tasks, health)</li>
              <li>Analyze alerts and past decisions to understand patterns</li>
              <li>Make management decisions (escalate, reassign, unblock)</li>
              <li>Record decisions in audit trail</li>
              <li>Shut down (forget state until next cycle)</li>
            </ol>
          </div>
        </section>

        {/* Complete Endpoint Reference */}
        <section className="bg-slate-800 rounded-lg p-6 mb-8 border border-slate-700">
          <h2 className="text-2xl font-bold text-white mb-4">📚 Complete Endpoint Reference</h2>
          <p className="text-slate-300 mb-6">
            Full list of all Mission Control API endpoints organized by category.
          </p>

          {/* Businesses */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-slate-200 mb-3">🏢 Businesses</h3>
            <div className="space-y-2">
              <div className="bg-slate-900 rounded p-3 text-sm">
                <p className="text-slate-200 font-mono">GET /api/businesses</p>
                <p className="text-slate-400">List all businesses</p>
              </div>
            </div>
          </div>

          {/* Calendar */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-slate-200 mb-3">📅 Calendar</h3>
            <div className="space-y-2">
              <div className="bg-slate-900 rounded p-3 text-sm">
                <p className="text-slate-200 font-mono">GET /api/calendar/events</p>
                <p className="text-slate-400">List calendar events</p>
              </div>
              <div className="bg-slate-900 rounded p-3 text-sm">
                <p className="text-slate-200 font-mono">GET /api/calendar/events/:eventId</p>
                <p className="text-slate-400">Get event details</p>
              </div>
              <div className="bg-slate-900 rounded p-3 text-sm">
                <p className="text-slate-200 font-mono">GET /api/calendar/slots</p>
                <p className="text-slate-400">Get available time slots</p>
              </div>
            </div>
          </div>

          {/* Epics */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-slate-200 mb-3">🎯 Epics</h3>
            <div className="space-y-2">
              <div className="bg-slate-900 rounded p-3 text-sm">
                <p className="text-slate-200 font-mono">GET /api/epics</p>
                <p className="text-slate-400">List all epics</p>
              </div>
            </div>
          </div>

          {/* Admin */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-slate-200 mb-3">⚡ Admin Operations</h3>
            <div className="space-y-2">
              <div className="bg-slate-900 rounded p-3 text-sm">
                <p className="text-slate-200 font-mono">POST /api/admin/goals/seed</p>
                <p className="text-slate-400">Seed demo goals</p>
              </div>
              <div className="bg-slate-900 rounded p-3 text-sm">
                <p className="text-slate-200 font-mono">DELETE /api/admin/goals/demo</p>
                <p className="text-slate-400">Clean up demo goals</p>
              </div>
            </div>
          </div>

          {/* Memory (Brain) */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-slate-200 mb-3">🧠 Memory (Brain)</h3>
            <div className="space-y-2">
              <div className="bg-slate-900 rounded p-3 text-sm">
                <p className="text-slate-200 font-mono">GET /api/memory</p>
                <p className="text-slate-400">List memory files</p>
              </div>
              <div className="bg-slate-900 rounded p-3 text-sm">
                <p className="text-slate-200 font-mono">GET /api/memory/files?path=...</p>
                <p className="text-slate-400">Get memory file content</p>
              </div>
              <div className="bg-slate-900 rounded p-3 text-sm">
                <p className="text-slate-200 font-mono">POST /api/memory/search</p>
                <p className="text-slate-400">Search memory</p>
              </div>
              <div className="bg-slate-900 rounded p-3 text-sm">
                <p className="text-slate-200 font-mono">GET /api/memory/context?entity=...&type=...</p>
                <p className="text-slate-400">Get context from memory</p>
              </div>
            </div>
          </div>

          {/* Reports */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-slate-200 mb-3">📊 Reports</h3>
            <div className="space-y-2">
              <div className="bg-slate-900 rounded p-3 text-sm">
                <p className="text-slate-200 font-mono">GET|POST /api/reports?type=strategic-weekly</p>
                <p className="text-slate-400">Get or generate weekly strategic report</p>
              </div>
            </div>
          </div>

          {/* Tasks */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-slate-200 mb-3">✅ Tasks</h3>
            <div className="space-y-2">
              <div className="bg-slate-900 rounded p-3 text-sm">
                <p className="text-slate-200 font-mono">GET /api/tasks/generate-daily</p>
                <p className="text-slate-400">Generate daily tasks</p>
              </div>
              <div className="bg-slate-900 rounded p-3 text-sm">
                <p className="text-slate-200 font-mono">GET /api/tasks/execute</p>
                <p className="text-slate-400">Execute task</p>
              </div>
              <div className="bg-slate-900 rounded p-3 text-sm">
                <p className="text-slate-200 font-mono">GET /api/tasks/:taskId/calendar-events</p>
                <p className="text-slate-400">Get calendar events for task</p>
              </div>
            </div>
          </div>

          {/* Admin */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-slate-200 mb-3">⚙️ Admin</h3>
            <div className="space-y-2">
              <div className="bg-slate-900 rounded p-3 text-sm">
                <p className="text-slate-200 font-mono">GET /api/admin/agents/setup-workspace</p>
                <p className="text-slate-400">Setup agent workspace</p>
              </div>
              <div className="bg-slate-900 rounded p-3 text-sm">
                <p className="text-slate-200 font-mono">GET /api/admin/migrations/agent-workspace-paths</p>
                <p className="text-slate-400">Run migration: agent workspace paths</p>
              </div>
              <div className="bg-slate-900 rounded p-3 text-sm">
                <p className="text-slate-200 font-mono">GET /api/agents/workspace/structure</p>
                <p className="text-slate-400">Get agent workspace structure</p>
              </div>
            </div>
          </div>
        </section>

        {/* Status and Health Section */}
        <section className="bg-slate-800 rounded-lg p-6 mb-8 border border-slate-700">
          <h2 className="text-2xl font-bold text-white mb-4">✅ Implementation Status</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              <span className="text-slate-300">Metrics API - Real-time state snapshot</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              <span className="text-slate-300">Alerts API - Configured alert rules</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              <span className="text-slate-300">Decisions API - Audit trail with patterns</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              <span className="text-slate-300">Actions API - Escalate, reassign, unblock, mark-executed</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              <span className="text-slate-300">Agent Management API - RESTful endpoints</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              <span className="text-slate-300">35+ endpoints fully operational</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              <span className="text-slate-300">1321/1321 tests passing (100%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-yellow-400">→</span>
              <span className="text-slate-300">E2E tests for complete heartbeat cycles</span>
            </div>
          </div>
        </section>

        {/* Agent Management API */}
        <section className="bg-slate-800 rounded-lg p-6 mb-8 border border-slate-700">
          <h2 className="text-2xl font-bold text-white mb-4">👥 Agent Management API</h2>
          <p className="text-slate-300 mb-4">
            RESTful API for managing agents, their lifecycle, and task operations. Follows REST best practices with hierarchical resource URLs.
          </p>

          {/* Agent Registration */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-white mb-3">Register / List Agents</h3>
            <div className="space-y-3">
              <div className="bg-slate-900 rounded p-4">
                <p className="text-slate-200 font-mono text-sm">POST /api/agents</p>
                <p className="text-slate-400 text-xs mt-1">Register new agent or get existing agent's API key</p>
              </div>
              <div className="bg-slate-900 rounded p-4">
                <p className="text-slate-200 font-mono text-sm">GET /api/agents</p>
                <p className="text-slate-400 text-xs mt-1">List all agents (requires agentId, agentKey headers)</p>
              </div>
            </div>
          </div>

          {/* Agent Details */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-white mb-3">Agent Details & Updates</h3>
            <div className="space-y-3">
              <div className="bg-slate-900 rounded p-4">
                <p className="text-slate-200 font-mono text-sm">GET /api/agents/:agentId</p>
                <p className="text-slate-400 text-xs mt-1">Get agent details (requires agentKey query param)</p>
              </div>
              <div className="bg-slate-900 rounded p-4">
                <p className="text-slate-200 font-mono text-sm">PATCH /api/agents/:agentId</p>
                <p className="text-slate-400 text-xs mt-1">Update agent details (workspace, model, capabilities)</p>
              </div>
            </div>
          </div>

          {/* Agent Lifecycle */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-white mb-3">Agent Lifecycle</h3>
            <div className="space-y-3">
              <div className="bg-slate-900 rounded p-4">
                <p className="text-slate-200 font-mono text-sm">POST /api/agents/:agentId/heartbeat</p>
                <p className="text-slate-400 text-xs mt-1">Send agent heartbeat and optional status update</p>
              </div>
              <div className="bg-slate-900 rounded p-4">
                <p className="text-slate-200 font-mono text-sm">POST /api/agents/:agentId/poll</p>
                <p className="text-slate-400 text-xs mt-1">Poll for work queue and get notifications</p>
              </div>
            </div>
          </div>

          {/* Task Management */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-white mb-3">Task Management</h3>
            <div className="space-y-3">
              <div className="bg-slate-900 rounded p-4">
                <p className="text-slate-200 font-mono text-sm">GET /api/agents/:agentId/tasks</p>
                <p className="text-slate-400 text-xs mt-1">List agent's tasks (requires agentKey, businessId query params)</p>
              </div>
              <div className="bg-slate-900 rounded p-4">
                <p className="text-slate-200 font-mono text-sm">GET /api/agents/:agentId/tasks/:taskId</p>
                <p className="text-slate-400 text-xs mt-1">Get task details (requires agentKey query param)</p>
              </div>
            </div>
          </div>

          {/* Task Operations */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-white mb-3">Task Operations (RESTful)</h3>
            <p className="text-slate-400 text-xs mb-3">All task operations use a unified PATCH endpoint with action discriminator</p>
            <div className="space-y-3">
              <div className="bg-slate-900 rounded p-4">
                <p className="text-slate-200 font-mono text-sm">PATCH /api/tasks/:taskId</p>
                <p className="text-slate-400 text-xs mt-1">Execute task action (assign, complete, update-status, update-tags, escalate, reassign, unblock, mark-executed)</p>
                <div className="mt-2 bg-slate-800 rounded p-2 text-xs text-slate-300 font-mono">
                  <p className="text-slate-400 mb-1">Example - Assign task:</p>
                  <pre>{`{ action: "assign", agentId, agentKey, assigneeIds }`}</pre>
                  <p className="text-slate-400 mt-2 mb-1">Example - Complete task:</p>
                  <pre>{`{ action: "complete", agentId, agentKey, completionNotes }`}</pre>
                </div>
              </div>
              <div className="bg-slate-900 rounded p-4">
                <p className="text-slate-200 font-mono text-sm">POST /api/agents/:agentId/tasks/:taskId/comments</p>
                <p className="text-slate-400 text-xs mt-1">Add comment to task</p>
              </div>
            </div>
          </div>

          {/* HTTP Status Codes */}
          <div className="bg-slate-900 rounded p-4 mb-6">
            <h4 className="text-slate-200 font-semibold mb-2">HTTP Status Codes</h4>
            <div className="text-sm text-slate-300 space-y-1 font-mono">
              <p><span className="text-green-400">200</span> - OK / Success</p>
              <p><span className="text-blue-400">201</span> - Created (new resource)</p>
              <p><span className="text-yellow-400">400</span> - Bad Request (validation error)</p>
              <p><span className="text-orange-400">401</span> - Unauthorized (invalid credentials)</p>
              <p><span className="text-red-400">404</span> - Not Found</p>
              <p><span className="text-red-500">500</span> - Server Error</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
