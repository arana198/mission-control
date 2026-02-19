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
