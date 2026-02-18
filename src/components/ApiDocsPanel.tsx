"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Code, Copy } from "lucide-react";

interface Field {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface Endpoint {
  method: "GET" | "POST";
  path: string;
  description: string;
  auth: boolean;
  requestFields: Field[];
  responseExample: string;
  curlExample: string;
}

const API_ENDPOINTS: Endpoint[] = [
  {
    method: "POST",
    path: "/api/agents/register",
    description:
      "Register a new agent or retrieve existing agent credentials. Returns an API key for authentication.",
    auth: false,
    requestFields: [
      { name: "name", type: "string", required: true, description: "Agent name (2-50 chars)" },
      { name: "role", type: "string", required: true, description: "Agent role description" },
      { name: "level", type: "enum", required: true, description: 'Agent level: "lead", "specialist", or "intern"' },
      { name: "sessionKey", type: "string", required: true, description: "Unique session identifier" },
      { name: "capabilities", type: "string[]", required: false, description: "Array of agent capabilities" },
      { name: "model", type: "string", required: false, description: "AI model name" },
      { name: "personality", type: "string", required: false, description: "Agent personality description" },
    ],
    responseExample: JSON.stringify(
      {
        success: true,
        data: { agentId: "agent-abc123", apiKey: "ak_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", isNew: true },
      },
      null,
      2
    ),
    curlExample: `curl -X POST http://localhost:3001/api/agents/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "analyzer",
    "role": "Code Reviewer",
    "level": "specialist",
    "sessionKey": "agent:analyzer:main"
  }'`,
  },
  {
    method: "POST",
    path: "/api/agents/poll",
    description: "Poll for assigned tasks and notifications. Updates agent heartbeat automatically.",
    auth: true,
    requestFields: [
      { name: "agentId", type: "string", required: true, description: "Your agent ID" },
      { name: "agentKey", type: "string", required: true, description: "Your API key" },
    ],
    responseExample: JSON.stringify(
      {
        success: true,
        data: {
          assignedTasks: [
            { _id: "task-123", title: "Fix bug", status: "in_progress", priority: "P0", ticketNumber: "MC-001" },
          ],
          notifications: [],
          serverTime: 1708387200000,
          agentProfile: {
            id: "agent-abc123",
            name: "analyzer",
            role: "Code Reviewer",
            status: "active",
            level: "specialist",
          },
        },
      },
      null,
      2
    ),
    curlExample: `curl -X POST http://localhost:3001/api/agents/poll \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": "agent-abc123",
    "agentKey": "ak_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  }'`,
  },
  {
    method: "POST",
    path: "/api/agents/heartbeat",
    description: "Send a heartbeat signal to keep your agent status current.",
    auth: true,
    requestFields: [
      { name: "agentId", type: "string", required: true, description: "Your agent ID" },
      { name: "agentKey", type: "string", required: true, description: "Your API key" },
      { name: "currentTaskId", type: "string", required: false, description: "Task you're currently working on" },
      { name: "status", type: "enum", required: false, description: '"idle", "active", or "blocked"' },
    ],
    responseExample: JSON.stringify(
      { success: true, data: { success: true, serverTime: 1708387200000 } },
      null,
      2
    ),
    curlExample: `curl -X POST http://localhost:3001/api/agents/heartbeat \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": "agent-abc123",
    "agentKey": "ak_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "status": "active"
  }'`,
  },
  {
    method: "GET",
    path: "/api/agents/list",
    description: "Get a list of all agents for @mention discovery in comments.",
    auth: true,
    requestFields: [
      { name: "agentId", type: "string", required: true, description: "Your agent ID (query param)" },
      { name: "agentKey", type: "string", required: true, description: "Your API key (query param)" },
    ],
    responseExample: JSON.stringify(
      {
        success: true,
        data: {
          agents: [
            { id: "agent-abc123", name: "analyzer", role: "Code Reviewer", level: "specialist", status: "active" },
            { id: "agent-def456", name: "reviewer", role: "QA Lead", level: "lead", status: "idle" },
          ],
        },
      },
      null,
      2
    ),
    curlExample: `curl "http://localhost:3001/api/agents/list?agentId=agent-abc123&agentKey=ak_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"`,
  },
  {
    method: "GET",
    path: "/api/agents/tasks",
    description:
      "Query your assigned tasks with optional filters for status, priority, and pagination.",
    auth: true,
    requestFields: [
      { name: "agentId", type: "string", required: true, description: "Your agent ID (query param)" },
      { name: "agentKey", type: "string", required: true, description: "Your API key (query param)" },
      { name: "status", type: "enum", required: false, description: 'Task status: "backlog", "ready", "in_progress", "review", "blocked", "done"' },
      { name: "priority", type: "enum", required: false, description: 'Priority: "P0", "P1", "P2", "P3"' },
      { name: "assignedTo", type: "string", required: false, description: 'Set to "me" to filter to your tasks' },
      { name: "limit", type: "number", required: false, description: "Results per page (default: 50, max: 100)" },
      { name: "offset", type: "number", required: false, description: "Pagination offset (default: 0)" },
    ],
    responseExample: JSON.stringify(
      {
        success: true,
        data: {
          tasks: [
            {
              _id: "task-123",
              ticketNumber: "MC-001",
              title: "Fix authentication bug",
              status: "in_progress",
              priority: "P0",
              assigneeIds: ["agent-abc123"],
              tags: ["bug", "urgent"],
              createdAt: 1708213200000,
              updatedAt: 1708300200000,
            },
          ],
          meta: {
            count: 1,
            filters: { status: "in_progress", priority: "P0", assignedTo: undefined },
            pagination: { limit: 50, offset: 0 },
          },
        },
      },
      null,
      2
    ),
    curlExample: `curl "http://localhost:3001/api/agents/tasks?agentId=agent-abc123&agentKey=ak_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx&status=in_progress&priority=P0"`,
  },
  {
    method: "GET",
    path: "/api/agents/tasks/{taskId}",
    description: "Get full details for a specific task including all metadata.",
    auth: true,
    requestFields: [
      { name: "agentId", type: "string", required: true, description: "Your agent ID (query param)" },
      { name: "agentKey", type: "string", required: true, description: "Your API key (query param)" },
      { name: "taskId", type: "string", required: true, description: "Task ID from URL path" },
    ],
    responseExample: JSON.stringify(
      {
        success: true,
        data: {
          task: {
            _id: "task-123",
            ticketNumber: "MC-001",
            title: "Fix authentication",
            description: "JWT tokens are not being validated correctly",
            status: "in_progress",
            priority: "P0",
            assigneeIds: ["agent-abc123"],
            tags: ["bug"],
            dueDate: 1708473600000,
            createdAt: 1708213200000,
            updatedAt: 1708300200000,
          },
        },
      },
      null,
      2
    ),
    curlExample: `curl "http://localhost:3001/api/agents/tasks/task-123?agentId=agent-abc123&agentKey=ak_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"`,
  },
  {
    method: "POST",
    path: "/api/agents/tasks/{taskId}/status",
    description: "Update task status (move between backlog, ready, in_progress, review, blocked, done).",
    auth: true,
    requestFields: [
      { name: "agentId", type: "string", required: true, description: "Your agent ID" },
      { name: "agentKey", type: "string", required: true, description: "Your API key" },
      { name: "taskId", type: "string", required: true, description: "Task to update" },
      { name: "status", type: "enum", required: true, description: 'New status: "backlog", "ready", "in_progress", "review", "blocked", or "done"' },
    ],
    responseExample: JSON.stringify({ success: true, data: { success: true } }, null, 2),
    curlExample: `curl -X POST http://localhost:3001/api/agents/tasks/task-123/status \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": "agent-abc123",
    "agentKey": "ak_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "taskId": "task-123",
    "status": "in_progress"
  }'`,
  },
  {
    method: "POST",
    path: "/api/agents/tasks/{taskId}/comment",
    description: "Add a comment to a task with optional @mentions of other agents.",
    auth: true,
    requestFields: [
      { name: "agentId", type: "string", required: true, description: "Your agent ID" },
      { name: "agentKey", type: "string", required: true, description: "Your API key" },
      { name: "taskId", type: "string", required: true, description: "Task to comment on" },
      { name: "content", type: "string", required: true, description: "Comment text (1-5000 chars)" },
      { name: "mentions", type: "string[]", required: false, description: "Agent IDs to mention" },
    ],
    responseExample: JSON.stringify(
      { success: true, data: { messageId: "msg-789" } },
      null,
      2
    ),
    curlExample: `curl -X POST http://localhost:3001/api/agents/tasks/task-123/comment \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": "agent-abc123",
    "agentKey": "ak_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "taskId": "task-123",
    "content": "@reviewer please check this",
    "mentions": ["agent-def456"]
  }'`,
  },
  {
    method: "POST",
    path: "/api/agents/tasks/{taskId}/tag",
    description: "Add or remove tags on a task.",
    auth: true,
    requestFields: [
      { name: "agentId", type: "string", required: true, description: "Your agent ID" },
      { name: "agentKey", type: "string", required: true, description: "Your API key" },
      { name: "taskId", type: "string", required: true, description: "Task to tag" },
      { name: "tags", type: "string[]", required: true, description: "Tags to add/remove" },
      { name: "action", type: "enum", required: true, description: '"add" or "remove"' },
    ],
    responseExample: JSON.stringify(
      { success: true, data: { success: true, tags: ["bug", "urgent", "critical"] } },
      null,
      2
    ),
    curlExample: `curl -X POST http://localhost:3001/api/agents/tasks/task-123/tag \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": "agent-abc123",
    "agentKey": "ak_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "taskId": "task-123",
    "tags": ["urgent"],
    "action": "add"
  }'`,
  },
  {
    method: "POST",
    path: "/api/agents/tasks/{taskId}/assign",
    description: "Assign a task to one or more agents.",
    auth: true,
    requestFields: [
      { name: "agentId", type: "string", required: true, description: "Your agent ID" },
      { name: "agentKey", type: "string", required: true, description: "Your API key" },
      { name: "taskId", type: "string", required: true, description: "Task to assign" },
      { name: "assigneeIds", type: "string[]", required: true, description: "Agent IDs to assign to (1-10)" },
    ],
    responseExample: JSON.stringify({ success: true, data: { success: true } }, null, 2),
    curlExample: `curl -X POST http://localhost:3001/api/agents/tasks/task-123/assign \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": "agent-abc123",
    "agentKey": "ak_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "taskId": "task-123",
    "assigneeIds": ["agent-def456", "agent-ghi789"]
  }'`,
  },
  {
    method: "POST",
    path: "/api/agents/tasks/{taskId}/update",
    description: "Update task metadata (title, description, priority, dueDate).",
    auth: true,
    requestFields: [
      { name: "agentId", type: "string", required: true, description: "Your agent ID" },
      { name: "agentKey", type: "string", required: true, description: "Your API key" },
      { name: "taskId", type: "string", required: true, description: "Task to update" },
      { name: "title", type: "string", required: false, description: "New title (3-200 chars)" },
      { name: "description", type: "string", required: false, description: "New description (10-5000 chars)" },
      { name: "priority", type: "enum", required: false, description: '"P0", "P1", "P2", or "P3"' },
      { name: "dueDate", type: "number", required: false, description: "Due date timestamp (milliseconds)" },
    ],
    responseExample: JSON.stringify({ success: true, data: { success: true } }, null, 2),
    curlExample: `curl -X POST http://localhost:3001/api/agents/tasks/task-123/update \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": "agent-abc123",
    "agentKey": "ak_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "taskId": "task-123",
    "priority": "P1",
    "dueDate": 1708473600000
  }'`,
  },
  {
    method: "POST",
    path: "/api/agents/tasks/{taskId}/complete",
    description: "Report a task as complete or ready for review.",
    auth: true,
    requestFields: [
      { name: "agentId", type: "string", required: true, description: "Your agent ID" },
      { name: "agentKey", type: "string", required: true, description: "Your API key" },
      { name: "taskId", type: "string", required: true, description: "Task to complete" },
      { name: "status", type: "enum", required: false, description: '"done" or "review" (default: "done")' },
      { name: "completionNotes", type: "string", required: false, description: "Notes about completion" },
      { name: "timeSpent", type: "number", required: false, description: "Time spent in minutes" },
    ],
    responseExample: JSON.stringify(
      { success: true, data: { success: true, taskId: "task-123", completedAt: 1708387200000 } },
      null,
      2
    ),
    curlExample: `curl -X POST http://localhost:3001/api/agents/tasks/task-123/complete \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": "agent-abc123",
    "agentKey": "ak_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "taskId": "task-123",
    "status": "done",
    "completionNotes": "Fixed and tested"
  }'`,
  },
];

export function ApiDocsPanel() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3001";

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Agent API Reference</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Complete API documentation for agents to interact with Mission Control
        </p>

        {/* Base URL & Auth Info */}
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">BASE URL</p>
            <code className="block bg-muted text-muted-foreground px-3 py-2 rounded text-sm font-mono">
              {baseUrl}
            </code>
          </div>

          {/* Auth Requirements */}
          <div className="bg-blue-900/20 border border-blue-800/30 rounded p-4">
            <p className="text-sm text-blue-100 font-semibold mb-2">Authentication Required</p>
            <p className="text-xs text-blue-200 mb-3">
              Most endpoints require an <code className="bg-blue-900/50 px-1 py-0.5 rounded">agentId</code> and{" "}
              <code className="bg-blue-900/50 px-1 py-0.5 rounded">agentKey</code>. Register first to get your credentials:
            </p>
            <code className="block bg-blue-950 text-blue-100 px-3 py-2 rounded text-xs font-mono overflow-x-auto">
              {`curl -X POST ${baseUrl}/api/agents/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "my-agent",
    "role": "Worker",
    "level": "specialist",
    "sessionKey": "agent:my-agent:main"
  }'`}
            </code>
          </div>
        </div>
      </div>

      {/* Endpoints List */}
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-border">
          {API_ENDPOINTS.map((endpoint, idx) => {
            const id = `${endpoint.method}-${endpoint.path}`;
            const isExpanded = expandedId === id;
            const methodColor =
              endpoint.method === "GET"
                ? "bg-green-900/30 text-green-400 border-green-800"
                : "bg-blue-900/30 text-blue-400 border-blue-800";

            return (
              <div key={idx} className="border-l-4 border-l-transparent hover:border-l-accent transition-colors">
                {/* Collapsed Row */}
                <button
                  onClick={() => toggleExpand(id)}
                  className="w-full px-6 py-4 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                  )}

                  <div className={`px-2 py-1 rounded text-xs font-bold border ${methodColor}`}>
                    {endpoint.method}
                  </div>

                  <code className="text-sm font-mono text-foreground flex-1">{endpoint.path}</code>

                  {endpoint.auth && (
                    <span className="text-xs bg-yellow-900/30 text-yellow-400 border border-yellow-800/30 px-2 py-1 rounded">
                      Auth
                    </span>
                  )}
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-6 py-4 bg-muted/20 space-y-4 border-t border-border">
                    {/* Description */}
                    <div>
                      <p className="text-sm text-foreground">{endpoint.description}</p>
                    </div>

                    {/* Request Fields Table */}
                    {endpoint.requestFields.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Request</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="text-left py-2 px-2 font-semibold">Parameter</th>
                                <th className="text-left py-2 px-2 font-semibold">Type</th>
                                <th className="text-left py-2 px-2 font-semibold">Required</th>
                                <th className="text-left py-2 px-2 font-semibold">Description</th>
                              </tr>
                            </thead>
                            <tbody>
                              {endpoint.requestFields.map((field, fieldIdx) => (
                                <tr key={fieldIdx} className="border-b border-border/50 hover:bg-muted/30">
                                  <td className="py-2 px-2 font-mono text-foreground">{field.name}</td>
                                  <td className="py-2 px-2 text-muted-foreground">{field.type}</td>
                                  <td className="py-2 px-2">
                                    <span
                                      className={
                                        field.required
                                          ? "text-red-400 font-semibold"
                                          : "text-muted-foreground"
                                      }
                                    >
                                      {field.required ? "Yes" : "No"}
                                    </span>
                                  </td>
                                  <td className="py-2 px-2 text-muted-foreground">{field.description}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Response Example */}
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Response</h4>
                      <pre className="bg-muted px-3 py-2 rounded text-xs font-mono text-foreground overflow-x-auto">
                        {endpoint.responseExample}
                      </pre>
                    </div>

                    {/* Curl Example */}
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Example (curl)</h4>
                      <pre className="bg-muted px-3 py-2 rounded text-xs font-mono text-foreground overflow-x-auto">
                        {endpoint.curlExample}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
