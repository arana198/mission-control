/**
 * API Documentation Generator
 *
 * Automatically generates API documentation from route handlers
 * Each route.ts file can export API_DOCS metadata to be included in documentation
 */

export interface ApiDocField {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface ApiDocEndpoint {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  summary: string;
  description: string;
  auth: boolean;
  request?: {
    fields: ApiDocField[];
    example?: Record<string, any>;
  };
  response?: {
    example: Record<string, any>;
    description?: string;
  };
  tags?: string[];
  category?: string;
}

/**
 * Example usage in a route handler:
 *
 * export const API_DOCS: ApiDocEndpoint = {
 *   method: "POST",
 *   path: "/api/businesses",
 *   summary: "Register a new business",
 *   description: "Create a new business workspace...",
 *   auth: true,
 *   request: {
 *     fields: [
 *       { name: "name", type: "string", required: true, description: "Business name" }
 *     ]
 *   },
 *   response: {
 *     example: { success: true, businessId: "biz_123" }
 *   }
 * };
 */

// Default endpoints documented in code
const DOCUMENTED_ENDPOINTS: ApiDocEndpoint[] = [
  // ==== AGENT MANAGEMENT (RESTful) ====
  {
    method: "POST",
    path: "/api/agents",
    summary: "Register new agent or get existing",
    description: "Register a new AI agent or retrieve existing agent credentials. Returns an API key for authentication.",
    auth: false,
    category: "Agent Management",
    request: {
      fields: [
        { name: "name", type: "string", required: true, description: "Agent name (2-50 chars)" },
        { name: "role", type: "string", required: true, description: "Agent role description" },
        { name: "level", type: "enum", required: true, description: 'Agent level: "lead", "specialist", or "intern"' },
        { name: "sessionKey", type: "string", required: true, description: "Unique session identifier" },
        { name: "capabilities", type: "string[]", required: false, description: "Array of agent capabilities" },
        { name: "model", type: "string", required: false, description: "AI model name" },
        { name: "personality", type: "string", required: false, description: "Agent personality description" },
      ],
      example: {
        name: "analyzer",
        role: "Code Reviewer",
        level: "specialist",
        sessionKey: "agent:analyzer:main"
      }
    },
    response: {
      example: {
        success: true,
        data: { agentId: "agent-abc123", apiKey: "ak_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", isNew: true }
      }
    }
  },
  {
    method: "GET",
    path: "/api/agents",
    summary: "List all agents",
    description: "Get a list of all agents for @mention discovery in comments.",
    auth: true,
    category: "Agent Management",
    request: {
      fields: [
        { name: "agentId", type: "string", required: true, description: "Your agent ID (header)" },
        { name: "agentKey", type: "string", required: true, description: "Your API key (header)" },
      ]
    },
    response: {
      example: {
        success: true,
        data: {
          agents: [
            { id: "agent-abc123", name: "analyzer", role: "Code Reviewer", level: "specialist", status: "active" }
          ]
        }
      }
    }
  },
  {
    method: "GET",
    path: "/api/agents/:agentId",
    summary: "Get agent details",
    description: "Get details for a specific agent.",
    auth: true,
    category: "Agent Management",
    request: {
      fields: [
        { name: "agentKey", type: "string", required: true, description: "Your API key (query param)" },
      ]
    },
    response: {
      example: {
        success: true,
        data: {
          agent: {
            _id: "agent-abc123",
            name: "analyzer",
            role: "Code Reviewer",
            level: "specialist",
            status: "active"
          }
        }
      }
    }
  },
  {
    method: "PATCH",
    path: "/api/agents/:agentId",
    summary: "Update agent",
    description: "Update agent configuration like model, personality, or capabilities.",
    auth: true,
    category: "Agent Management",
    request: {
      fields: [
        { name: "agentKey", type: "string", required: true, description: "Your API key" },
        { name: "workspace", type: "string", required: false, description: "Workspace path" },
        { name: "model", type: "string", required: false, description: "AI model name" },
        { name: "personality", type: "string", required: false, description: "Agent personality" },
        { name: "capabilities", type: "string[]", required: false, description: "Capabilities array" },
      ],
      example: {
        agentKey: "ak_xxx",
        model: "gpt-4",
        personality: "analytical"
      }
    },
    response: {
      example: { success: true }
    }
  },
  {
    method: "POST",
    path: "/api/agents/:agentId/heartbeat",
    summary: "Send heartbeat",
    description: "Send a heartbeat signal to keep your agent status current.",
    auth: true,
    category: "Agent Management",
    request: {
      fields: [
        { name: "agentKey", type: "string", required: true, description: "Your API key" },
        { name: "currentTaskId", type: "string", required: false, description: "Task currently working on" },
        { name: "status", type: "enum", required: false, description: '"idle", "active", or "blocked"' },
      ],
      example: {
        agentKey: "ak_xxx",
        status: "active"
      }
    },
    response: {
      example: { success: true, data: { serverTime: 1708387200000 } }
    }
  },
  {
    method: "POST",
    path: "/api/agents/:agentId/poll",
    summary: "Poll for work",
    description: "Poll for assigned tasks and notifications.",
    auth: true,
    category: "Agent Management",
    request: {
      fields: [
        { name: "agentKey", type: "string", required: true, description: "Your API key" },
        { name: "businessId", type: "string", required: true, description: "Business to poll tasks from" },
      ],
      example: {
        agentKey: "ak_xxx",
        businessId: "biz_123"
      }
    },
    response: {
      example: {
        success: true,
        data: {
          assignedTasks: [
            { _id: "task-123", title: "Fix bug", status: "in_progress", priority: "P0" }
          ],
          notifications: [],
          serverTime: 1708387200000
        }
      }
    }
  },
  {
    method: "GET",
    path: "/api/agents/:agentId/tasks",
    summary: "Query assigned tasks",
    description: "Query your assigned tasks with optional filters for status, priority, and pagination.",
    auth: true,
    category: "Agent Management",
    request: {
      fields: [
        { name: "agentKey", type: "string", required: true, description: "Your API key (query param)" },
        { name: "businessId", type: "string", required: true, description: "Business ID (query param)" },
        { name: "status", type: "enum", required: false, description: 'Task status: "backlog", "ready", "in_progress", "review", "blocked", "done"' },
        { name: "priority", type: "enum", required: false, description: 'Priority: "P0", "P1", "P2", "P3"' },
        { name: "limit", type: "number", required: false, description: "Results per page (default: 50)" },
        { name: "offset", type: "number", required: false, description: "Pagination offset (default: 0)" },
      ]
    },
    response: {
      example: {
        success: true,
        data: {
          tasks: [
            {
              _id: "task-123",
              ticketNumber: "MC-001",
              title: "Fix authentication bug",
              status: "in_progress",
              priority: "P0",
              tags: ["bug", "urgent"],
              createdAt: 1708213200000
            }
          ],
          meta: { count: 1, pagination: { limit: 50, offset: 0 } }
        }
      }
    }
  },
  {
    method: "GET",
    path: "/api/agents/:agentId/tasks/:taskId",
    summary: "Get task details",
    description: "Get full details for a specific task including all metadata.",
    auth: true,
    category: "Agent Management",
    request: {
      fields: [
        { name: "agentKey", type: "string", required: true, description: "Your API key (query param)" },
      ]
    },
    response: {
      example: {
        success: true,
        data: {
          task: {
            _id: "task-123",
            ticketNumber: "MC-001",
            title: "Fix authentication",
            description: "JWT tokens validation",
            status: "in_progress",
            priority: "P0",
            dueDate: 1708473600000
          }
        }
      }
    }
  },
  {
    method: "POST",
    path: "/api/agents/:agentId/tasks/:taskId/assign",
    summary: "Assign task to agents",
    description: "Assign a task to one or more agents.",
    auth: true,
    category: "Agent Management",
    request: {
      fields: [
        { name: "agentKey", type: "string", required: true, description: "Your API key" },
        { name: "assigneeIds", type: "string[]", required: true, description: "Agent IDs to assign (1-10)" },
      ],
      example: {
        agentKey: "ak_xxx",
        assigneeIds: ["agent-def456"]
      }
    },
    response: {
      example: { success: true }
    }
  },
  {
    method: "POST",
    path: "/api/agents/:agentId/tasks/:taskId/complete",
    summary: "Complete task",
    description: "Mark a task as complete or ready for review.",
    auth: true,
    category: "Agent Management",
    request: {
      fields: [
        { name: "agentKey", type: "string", required: true, description: "Your API key" },
        { name: "completionNotes", type: "string", required: false, description: "Completion notes" },
        { name: "timeSpent", type: "number", required: false, description: "Time spent (minutes)" },
      ]
    },
    response: {
      example: { success: true, taskId: "task-123", completedAt: 1708387200000 }
    }
  },
  {
    method: "POST",
    path: "/api/agents/:agentId/tasks/:taskId/comments",
    summary: "Add task comment",
    description: "Add a comment to a task with optional @mentions of other agents.",
    auth: true,
    category: "Agent Management",
    request: {
      fields: [
        { name: "agentKey", type: "string", required: true, description: "Your API key" },
        { name: "content", type: "string", required: true, description: "Comment text (1-5000 chars)" },
        { name: "mentions", type: "string[]", required: false, description: "Agent IDs to mention" },
      ],
      example: {
        agentKey: "ak_xxx",
        content: "@reviewer please check this",
        mentions: ["agent-def456"]
      }
    },
    response: {
      example: { success: true, data: { messageId: "msg-789", idempotencyKey: "key-123" }, status: 201 }
    }
  },
  {
    method: "PATCH",
    path: "/api/agents/:agentId/tasks/:taskId/status",
    summary: "Update task status",
    description: "Update the status of a task.",
    auth: true,
    category: "Agent Management",
    request: {
      fields: [
        { name: "agentKey", type: "string", required: true, description: "Your API key" },
        { name: "status", type: "enum", required: true, description: '"backlog", "ready", "in_progress", "review", "blocked", or "done"' },
      ],
      example: {
        agentKey: "ak_xxx",
        status: "in_progress"
      }
    },
    response: {
      example: { success: true }
    }
  },
  {
    method: "PATCH",
    path: "/api/agents/:agentId/tasks/:taskId/tags",
    summary: "Update task tags",
    description: "Add or remove tags on a task.",
    auth: true,
    category: "Agent Management",
    request: {
      fields: [
        { name: "agentKey", type: "string", required: true, description: "Your API key" },
        { name: "tags", type: "string[]", required: true, description: "Tags to add/remove" },
        { name: "action", type: "enum", required: true, description: '"add" or "remove"' },
      ],
      example: {
        agentKey: "ak_xxx",
        tags: ["urgent"],
        action: "add"
      }
    },
    response: {
      example: { success: true, tags: ["bug", "urgent"] }
    }
  },
  // ==== STATE ENGINE ====
  {
    method: "GET",
    path: "/api/state-engine/metrics",
    summary: "Get real-time metrics",
    description: "Get real-time operational state snapshot.",
    auth: true,
    category: "State Engine",
    request: {
      fields: [
        { name: "businessId", type: "string", required: true, description: "Business ID (query param)" }
      ]
    },
    response: {
      example: {
        success: true,
        queue: { depth: 5, highPriority: 2 },
        tasks: { total: 50, pending: 5, completed: 33 },
        agents: { total: 10, active: 8 }
      }
    }
  },
  {
    method: "GET",
    path: "/api/state-engine/alerts",
    summary: "Get alert rules",
    description: "Get configured alert rules for business.",
    auth: true,
    category: "State Engine",
    request: {
      fields: [
        { name: "businessId", type: "string", required: true, description: "Business ID (query param)" }
      ]
    },
    response: {
      example: {
        success: true,
        rules: [
          { _id: "rule_1", name: "Queue Overload", threshold: 10, severity: "warning" }
        ]
      }
    }
  },
  {
    method: "GET",
    path: "/api/state-engine/decisions",
    summary: "Get audit trail",
    description: "Get decisions and pattern analysis.",
    auth: true,
    category: "State Engine",
    request: {
      fields: [
        { name: "businessId", type: "string", required: true, description: "Business ID (query param)" },
        { name: "limit", type: "number", required: false, description: "Max results" }
      ]
    },
    response: {
      example: {
        success: true,
        decisions: [
          { _id: "dec_1", action: "escalated", taskId: "task_456", result: "success" }
        ]
      }
    }
  },
  {
    method: "POST",
    path: "/api/state-engine/actions/escalate",
    summary: "Escalate task",
    description: "Escalate task to P0 priority.",
    auth: true,
    category: "State Engine",
    request: {
      fields: [
        { name: "businessId", type: "string", required: true, description: "Business ID" },
        { name: "taskId", type: "string", required: true, description: "Task ID" },
        { name: "reason", type: "string", required: true, description: "Reason for escalation" },
        { name: "decidedBy", type: "string", required: true, description: "Decision maker" },
      ]
    },
    response: {
      example: { success: true, action: "escalated", taskId: "task_456", decisionId: "dec_123" }
    }
  },
  {
    method: "POST",
    path: "/api/state-engine/actions/reassign",
    summary: "Reassign task",
    description: "Reassign task to different agent.",
    auth: true,
    category: "State Engine",
    request: {
      fields: [
        { name: "businessId", type: "string", required: true, description: "Business ID" },
        { name: "taskId", type: "string", required: true, description: "Task ID to reassign" },
        { name: "toAgent", type: "string", required: true, description: "Target agent ID" },
        { name: "reason", type: "string", required: true, description: "Reason for reassignment" },
      ]
    },
    response: {
      example: { success: true, action: "reassigned" }
    }
  },
  {
    method: "POST",
    path: "/api/state-engine/actions/unblock",
    summary: "Unblock task",
    description: "Clear blocked status and resume task.",
    auth: true,
    category: "State Engine",
    request: {
      fields: [
        { name: "businessId", type: "string", required: true, description: "Business ID" },
        { name: "taskId", type: "string", required: true, description: "Task ID to unblock" },
        { name: "reason", type: "string", required: true, description: "Reason for unblocking" },
      ]
    },
    response: {
      example: { success: true, action: "unblocked" }
    }
  },
  {
    method: "POST",
    path: "/api/state-engine/actions/mark-executed",
    summary: "Mark task executed",
    description: "Mark task as executed/complete.",
    auth: true,
    category: "State Engine",
    request: {
      fields: [
        { name: "businessId", type: "string", required: true, description: "Business ID" },
        { name: "taskId", type: "string", required: true, description: "Task ID to mark" },
        { name: "outcome", type: "string", required: true, description: "Completion outcome" },
      ]
    },
    response: {
      example: { success: true, action: "mark-executed" }
    }
  },
  // ==== BUSINESSES ====
  {
    method: "GET",
    path: "/api/businesses",
    summary: "List all businesses",
    description: "Get all businesses available to the current user.",
    auth: true,
    category: "Businesses",
    response: {
      example: {
        success: true,
        businesses: [
          {
            _id: "biz_123",
            name: "Mission Control HQ",
            slug: "mission-control-hq",
            emoji: "🚀",
            color: "#6366f1",
            isDefault: true
          }
        ]
      }
    }
  },
  // ==== CALENDAR ====
  {
    method: "GET",
    path: "/api/calendar/events",
    summary: "List calendar events",
    description: "Get all calendar events across all businesses.",
    auth: true,
    category: "Calendar",
    response: {
      example: {
        success: true,
        events: [
          { _id: "evt_123", title: "Sprint Planning", startTime: 1708387200000, endTime: 1708390800000 }
        ]
      }
    }
  },
  {
    method: "GET",
    path: "/api/calendar/events/:eventId",
    summary: "Get event details",
    description: "Get details for a specific calendar event.",
    auth: true,
    category: "Calendar",
    response: {
      example: {
        success: true,
        event: { _id: "evt_123", title: "Sprint Planning", startTime: 1708387200000 }
      }
    }
  },
  {
    method: "GET",
    path: "/api/calendar/slots",
    summary: "Get available slots",
    description: "Get available time slots for scheduling.",
    auth: true,
    category: "Calendar",
    request: {
      fields: [
        { name: "startDate", type: "string", required: true, description: "Start date (ISO 8601)" },
        { name: "endDate", type: "string", required: true, description: "End date (ISO 8601)" }
      ]
    },
    response: {
      example: {
        success: true,
        slots: [
          { date: "2024-02-20", availableHours: ["09:00", "14:00", "15:00"] }
        ]
      }
    }
  },
  // ==== EPICS ====
  {
    method: "GET",
    path: "/api/epics/list",
    summary: "List all epics",
    description: "Get all epics for the current business.",
    auth: true,
    category: "Epics",
    request: {
      fields: [
        { name: "businessId", type: "string", required: true, description: "Business ID (query param)" }
      ]
    },
    response: {
      example: {
        success: true,
        epics: [
          {
            _id: "epic_123",
            title: "Authentication System",
            status: "in_progress",
            progress: 65,
            taskCount: 15
          }
        ]
      }
    }
  },
  // ==== GOALS ====
  {
    method: "GET",
    path: "/api/goals/seed-demo",
    summary: "Seed demo goals",
    description: "Create demo goals for testing.",
    auth: true,
    category: "Goals",
    response: {
      example: { success: true, message: "Demo goals created" }
    }
  },
  {
    method: "GET",
    path: "/api/goals/cleanup-demo",
    summary: "Clean up demo",
    description: "Remove demo goals and data.",
    auth: true,
    category: "Goals",
    response: {
      example: { success: true, message: "Demo data cleaned" }
    }
  },
  // ==== MEMORY ====
  {
    method: "GET",
    path: "/api/memory/list",
    summary: "List memory entries",
    description: "Get all memory/brain entries.",
    auth: true,
    category: "Memory",
    response: {
      example: {
        success: true,
        entries: [
          { id: "mem_123", content: "Architecture notes...", createdAt: 1708387200000 }
        ]
      }
    }
  },
  {
    method: "GET",
    path: "/api/memory/search",
    summary: "Search memory",
    description: "Search through stored knowledge and context.",
    auth: true,
    category: "Memory",
    request: {
      fields: [
        { name: "query", type: "string", required: true, description: "Search query" },
        { name: "limit", type: "number", required: false, description: "Results limit" }
      ]
    },
    response: {
      example: {
        success: true,
        results: [
          { id: "mem_123", content: "Architecture...", relevance: 0.95 }
        ]
      }
    }
  },
  {
    method: "GET",
    path: "/api/memory/context",
    summary: "Get memory context",
    description: "Get context from memory for decision making.",
    auth: true,
    category: "Memory",
    response: {
      example: { success: true, context: { key: "value" } }
    }
  },
  {
    method: "GET",
    path: "/api/memory/content",
    summary: "Get memory content",
    description: "Get detailed memory content.",
    auth: true,
    category: "Memory",
    response: {
      example: { success: true, content: "..." }
    }
  },
  // ==== REPORTS ====
  {
    method: "GET",
    path: "/api/reports/strategic-weekly",
    summary: "Get weekly report",
    description: "Get weekly strategic report for business.",
    auth: true,
    category: "Reports",
    request: {
      fields: [
        { name: "businessId", type: "string", required: true, description: "Business ID (query param)" }
      ]
    },
    response: {
      example: {
        success: true,
        report: {
          week: "2024-W08",
          tasksCompleted: 12,
          avgCompletionTime: 45,
          health: "good"
        }
      }
    }
  },
  // ==== TASKS ====
  {
    method: "GET",
    path: "/api/tasks/generate-daily",
    summary: "Generate daily tasks",
    description: "Generate tasks for the day using AI.",
    auth: true,
    category: "Tasks",
    request: {
      fields: [
        { name: "businessId", type: "string", required: true, description: "Business context" },
        { name: "prompt", type: "string", required: false, description: "Generation prompt" }
      ]
    },
    response: {
      example: {
        success: true,
        tasksGenerated: 5,
        taskIds: ["task_123", "task_124"]
      }
    }
  },
  {
    method: "GET",
    path: "/api/tasks/execute",
    summary: "Execute task",
    description: "Execute a task operation.",
    auth: true,
    category: "Tasks",
    response: {
      example: { success: true, executed: true }
    }
  },
  {
    method: "GET",
    path: "/api/tasks/:taskId/calendar-events",
    summary: "Get task calendar events",
    description: "Get calendar events associated with a task.",
    auth: true,
    category: "Tasks",
    response: {
      example: {
        success: true,
        events: [
          { _id: "evt_123", title: "Task execution", startTime: 1708387200000 }
        ]
      }
    }
  },
  // ==== ADMIN ====
  {
    method: "GET",
    path: "/api/admin/agents/setup-workspace",
    summary: "Setup agent workspace",
    description: "Initialize agent workspace configuration.",
    auth: true,
    category: "Admin",
    response: {
      example: { success: true, workspace: "configured" }
    }
  },
  {
    method: "GET",
    path: "/api/admin/migrations/agent-workspace-paths",
    summary: "Run workspace migration",
    description: "Execute agent workspace paths migration.",
    auth: true,
    category: "Admin",
    response: {
      example: { success: true, migrated: 10, errors: 0 }
    }
  },
  {
    method: "GET",
    path: "/api/agents/workspace/structure",
    summary: "Get workspace structure",
    description: "Get current agent workspace directory structure.",
    auth: true,
    category: "Admin",
    response: {
      example: {
        success: true,
        structure: { agents: 10, projects: 5, total_files: 150 }
      }
    }
  }
];

/**
 * Get all API endpoints for documentation
 * Combines documented endpoints with any dynamically discovered ones
 */
export function getAllApiEndpoints(): ApiDocEndpoint[] {
  return DOCUMENTED_ENDPOINTS.sort((a, b) => {
    // Sort by category, then by path
    if (a.category !== b.category) {
      return (a.category || "").localeCompare(b.category || "");
    }
    return a.path.localeCompare(b.path);
  });
}

/**
 * Get endpoints by category
 */
export function getEndpointsByCategory(category: string): ApiDocEndpoint[] {
  return DOCUMENTED_ENDPOINTS.filter(ep => ep.category === category);
}

/**
 * Get all available categories
 */
export function getCategories(): string[] {
  const categories = new Set(DOCUMENTED_ENDPOINTS.map(ep => ep.category || "Other"));
  return Array.from(categories).sort();
}
