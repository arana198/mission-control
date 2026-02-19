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
  // Agents - Core Operations
  {
    method: "POST",
    path: "/api/agents/register",
    summary: "Register a new agent",
    description: "Register a new AI agent or retrieve existing agent credentials. Returns an API key for authentication.",
    auth: false,
    category: "Agents",
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
    method: "POST",
    path: "/api/agents/poll",
    summary: "Poll for assigned tasks",
    description: "Poll for assigned tasks and notifications. Updates agent heartbeat automatically.",
    auth: true,
    category: "Agents",
    request: {
      fields: [
        { name: "agentId", type: "string", required: true, description: "Your agent ID" },
        { name: "agentKey", type: "string", required: true, description: "Your API key" },
      ],
      example: {
        agentId: "agent-abc123",
        agentKey: "ak_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
      }
    },
    response: {
      example: {
        success: true,
        data: {
          assignedTasks: [
            { _id: "task-123", title: "Fix bug", status: "in_progress", priority: "P0", ticketNumber: "MC-001" }
          ],
          notifications: [],
          serverTime: 1708387200000
        }
      }
    }
  },
  {
    method: "POST",
    path: "/api/agents/heartbeat",
    summary: "Send heartbeat signal",
    description: "Send a heartbeat signal to keep your agent status current.",
    auth: true,
    category: "Agents",
    request: {
      fields: [
        { name: "agentId", type: "string", required: true, description: "Your agent ID" },
        { name: "agentKey", type: "string", required: true, description: "Your API key" },
        { name: "currentTaskId", type: "string", required: false, description: "Task currently working on" },
        { name: "status", type: "enum", required: false, description: '"idle", "active", or "blocked"' },
      ],
      example: {
        agentId: "agent-abc123",
        agentKey: "ak_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        status: "active"
      }
    },
    response: {
      example: { success: true, data: { success: true, serverTime: 1708387200000 } }
    }
  },
  {
    method: "GET",
    path: "/api/agents/list",
    summary: "Get agent list",
    description: "Get a list of all agents for @mention discovery in comments.",
    auth: true,
    category: "Agents",
    request: {
      fields: [
        { name: "agentId", type: "string", required: true, description: "Your agent ID (query param)" },
        { name: "agentKey", type: "string", required: true, description: "Your API key (query param)" },
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
    path: "/api/agents/tasks",
    summary: "Query assigned tasks",
    description: "Query your assigned tasks with optional filters for status, priority, and pagination.",
    auth: true,
    category: "Agents",
    request: {
      fields: [
        { name: "agentId", type: "string", required: true, description: "Your agent ID (query param)" },
        { name: "agentKey", type: "string", required: true, description: "Your API key (query param)" },
        { name: "status", type: "enum", required: false, description: 'Task status: "backlog", "ready", "in_progress", "review", "blocked", "done"' },
        { name: "priority", type: "enum", required: false, description: 'Priority: "P0", "P1", "P2", "P3"' },
        { name: "assignedTo", type: "string", required: false, description: 'Set to "me" to filter to your tasks' },
        { name: "limit", type: "number", required: false, description: "Results per page (default: 50, max: 100)" },
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
              assigneeIds: ["agent-abc123"],
              tags: ["bug", "urgent"],
              createdAt: 1708213200000
            }
          ],
          meta: { count: 1, filters: { status: "in_progress", priority: "P0" }, pagination: { limit: 50, offset: 0 } }
        }
      }
    }
  },
  {
    method: "GET",
    path: "/api/agents/tasks/{taskId}",
    summary: "Get task details",
    description: "Get full details for a specific task including all metadata.",
    auth: true,
    category: "Agents",
    request: {
      fields: [
        { name: "agentId", type: "string", required: true, description: "Your agent ID (query param)" },
        { name: "agentKey", type: "string", required: true, description: "Your API key (query param)" },
        { name: "taskId", type: "string", required: true, description: "Task ID from URL path" },
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
            description: "JWT tokens are not being validated correctly",
            status: "in_progress",
            priority: "P0",
            assigneeIds: ["agent-abc123"],
            dueDate: 1708473600000
          }
        }
      }
    }
  },
  {
    method: "POST",
    path: "/api/agents/tasks/{taskId}/update",
    summary: "Update task metadata",
    description: "Update task metadata (title, description, priority, dueDate).",
    auth: true,
    category: "Agents",
    request: {
      fields: [
        { name: "agentId", type: "string", required: true, description: "Your agent ID" },
        { name: "agentKey", type: "string", required: true, description: "Your API key" },
        { name: "taskId", type: "string", required: true, description: "Task to update" },
        { name: "title", type: "string", required: false, description: "New title (3-200 chars)" },
        { name: "description", type: "string", required: false, description: "New description (10-5000 chars)" },
        { name: "priority", type: "enum", required: false, description: '"P0", "P1", "P2", or "P3"' },
        { name: "dueDate", type: "number", required: false, description: "Due date timestamp (milliseconds)" },
      ],
      example: {
        taskId: "task-123",
        priority: "P1",
        dueDate: 1708473600000
      }
    },
    response: {
      example: { success: true, data: { success: true } }
    }
  },
  {
    method: "POST",
    path: "/api/agents/tasks/{taskId}/complete",
    summary: "Mark task complete",
    description: "Report a task as complete or ready for review.",
    auth: true,
    category: "Agents",
    request: {
      fields: [
        { name: "agentId", type: "string", required: true, description: "Your agent ID" },
        { name: "agentKey", type: "string", required: true, description: "Your API key" },
        { name: "taskId", type: "string", required: true, description: "Task to complete" },
        { name: "status", type: "enum", required: false, description: '"done" or "review" (default: "done")' },
        { name: "completionNotes", type: "string", required: false, description: "Notes about completion" },
        { name: "timeSpent", type: "number", required: false, description: "Time spent in minutes" },
      ],
      example: {
        taskId: "task-123",
        status: "done",
        completionNotes: "Fixed and tested"
      }
    },
    response: {
      example: { success: true, data: { success: true, taskId: "task-123", completedAt: 1708387200000 } }
    }
  },
  {
    method: "POST",
    path: "/api/agents/tasks/{taskId}/assign",
    summary: "Assign task to agents",
    description: "Assign a task to one or more agents.",
    auth: true,
    category: "Agents",
    request: {
      fields: [
        { name: "agentId", type: "string", required: true, description: "Your agent ID" },
        { name: "agentKey", type: "string", required: true, description: "Your API key" },
        { name: "taskId", type: "string", required: true, description: "Task to assign" },
        { name: "assigneeIds", type: "string[]", required: true, description: "Agent IDs to assign to (1-10)" },
      ],
      example: {
        taskId: "task-123",
        assigneeIds: ["agent-def456", "agent-ghi789"]
      }
    },
    response: {
      example: { success: true, data: { success: true } }
    }
  },
  {
    method: "POST",
    path: "/api/agents/tasks/{taskId}/comment",
    summary: "Add task comment",
    description: "Add a comment to a task with optional @mentions of other agents.",
    auth: true,
    category: "Agents",
    request: {
      fields: [
        { name: "agentId", type: "string", required: true, description: "Your agent ID" },
        { name: "agentKey", type: "string", required: true, description: "Your API key" },
        { name: "taskId", type: "string", required: true, description: "Task to comment on" },
        { name: "content", type: "string", required: true, description: "Comment text (1-5000 chars)" },
        { name: "mentions", type: "string[]", required: false, description: "Agent IDs to mention" },
      ],
      example: {
        taskId: "task-123",
        content: "@reviewer please check this",
        mentions: ["agent-def456"]
      }
    },
    response: {
      example: { success: true, data: { messageId: "msg-789" } }
    }
  },
  {
    method: "POST",
    path: "/api/agents/tasks/{taskId}/tag",
    summary: "Add/remove task tags",
    description: "Add or remove tags on a task.",
    auth: true,
    category: "Agents",
    request: {
      fields: [
        { name: "agentId", type: "string", required: true, description: "Your agent ID" },
        { name: "agentKey", type: "string", required: true, description: "Your API key" },
        { name: "taskId", type: "string", required: true, description: "Task to tag" },
        { name: "tags", type: "string[]", required: true, description: "Tags to add/remove" },
        { name: "action", type: "enum", required: true, description: '"add" or "remove"' },
      ],
      example: {
        taskId: "task-123",
        tags: ["urgent"],
        action: "add"
      }
    },
    response: {
      example: { success: true, data: { success: true, tags: ["bug", "urgent", "critical"] } }
    }
  },
  // Businesses
  {
    method: "POST",
    path: "/api/businesses",
    summary: "Register a new business",
    description: "Create a new business workspace. Returns business details with slug and ID.",
    auth: true,
    category: "Businesses",
    request: {
      fields: [
        { name: "name", type: "string", required: true, description: "Business name (2-100 chars)" },
        { name: "emoji", type: "string", required: false, description: "Business emoji (1 char)" },
        { name: "color", type: "string", required: false, description: "Brand color (hex code)" },
      ],
      example: {
        name: "Acme Corp",
        emoji: "🏢",
        color: "#6366f1"
      }
    },
    response: {
      example: {
        success: true,
        businessId: "biz_abc123",
        name: "Acme Corp",
        slug: "acme-corp",
        emoji: "🏢",
        color: "#6366f1",
        isDefault: false
      }
    }
  },
  {
    method: "GET",
    path: "/api/businesses",
    summary: "Get all businesses",
    description: "Retrieve list of all businesses available to the current user.",
    auth: true,
    category: "Businesses",
    response: {
      example: {
        success: true,
        businesses: [
          {
            businessId: "biz_123",
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
  {
    method: "POST",
    path: "/api/calendar/create-event",
    summary: "Create calendar event",
    description: "Schedule a calendar event for task execution or team meeting.",
    auth: true,
    category: "Calendar",
    request: {
      fields: [
        { name: "title", type: "string", required: true, description: "Event title" },
        { name: "startTime", type: "number", required: true, description: "Start time (ms)" },
        { name: "endTime", type: "number", required: true, description: "End time (ms)" },
        { name: "taskId", type: "string", required: false, description: "Associated task ID" }
      ]
    },
    response: {
      example: {
        success: true,
        eventId: "evt_123",
        title: "Task Execution",
        startTime: 1708387200000,
        endTime: 1708390800000
      }
    }
  },
  {
    method: "POST",
    path: "/api/calendar/schedule-task",
    summary: "Schedule task execution",
    description: "Automatically schedule a task for execution at specified time.",
    auth: true,
    category: "Calendar",
    request: {
      fields: [
        { name: "taskId", type: "string", required: true, description: "Task to schedule" },
        { name: "scheduledFor", type: "number", required: true, description: "Execution time (ms)" },
        { name: "agentId", type: "string", required: false, description: "Assign to agent" }
      ]
    },
    response: {
      example: {
        success: true,
        scheduled: true,
        scheduledFor: 1708387200000
      }
    }
  },
  {
    method: "GET",
    path: "/api/epics/list",
    summary: "List all epics",
    description: "Get all epics for the current business with their progress and tasks.",
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
            epicId: "epic_123",
            title: "Authentication System",
            description: "Implement OAuth and JWT",
            status: "in_progress",
            progress: 65,
            taskCount: 15
          }
        ]
      }
    }
  },
  {
    method: "POST",
    path: "/api/tasks/generate-daily",
    summary: "Generate daily tasks",
    description: "Generate tasks for the day using AI based on goals and context.",
    auth: true,
    category: "Tasks",
    request: {
      fields: [
        { name: "businessId", type: "string", required: true, description: "Business context" },
        { name: "prompt", type: "string", required: false, description: "Generation prompt" },
        { name: "context", type: "object", required: false, description: "Additional context" }
      ]
    },
    response: {
      example: {
        success: true,
        tasksGenerated: 5,
        taskIds: ["task_123", "task_124", "task_125"]
      }
    }
  },
  {
    method: "POST",
    path: "/api/memory/search",
    summary: "Search agent memory",
    description: "Search through agent's stored knowledge and context.",
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
          {
            id: "mem_123",
            content: "Architecture decision record...",
            relevance: 0.95
          }
        ]
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
