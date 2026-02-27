/**
 * OpenAPI Spec Generator (RESTful)
 *
 * Generates OpenAPI 3.0 specification for all API endpoints
 * Follows REST architectural best practices with resource-based URLs
 */

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  paths: Record<string, any>;
  components: {
    schemas: Record<string, any>;
    securitySchemes: Record<string, any>;
  };
  tags: Array<{
    name: string;
    description: string;
  }>;
}

/**
 * Helper: Inject examples into schemas recursively
 */
function injectExample(value: any): any {
  if (!value) return value;

  if (value.example || value.examples) {
    return value;
  }

  if (value.type === 'object' && value.properties) {
    const example: any = {};
    for (const [key, prop] of Object.entries(value.properties)) {
      example[key] = generateExampleForSchema(prop as any);
    }
    return { ...value, example };
  }

  if (value.type === 'array' && value.items) {
    return {
      ...value,
      example: [generateExampleForSchema(value.items)],
    };
  }

  return value;
}

/**
 * Generate example value from schema
 */
function generateExampleForSchema(schema: any): any {
  if (schema.example || schema.examples) {
    return schema.example || schema.examples[0];
  }

  if (schema.enum && schema.enum.length > 0) {
    return schema.enum[0];
  }

  switch (schema.type) {
    case 'string':
      return schema.minLength ? 'a'.repeat(schema.minLength + 1) : 'string';
    case 'integer':
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'array':
      return [generateExampleForSchema(schema.items || {})];
    case 'object':
      if (!schema.properties) return {};
      const obj: any = {};
      for (const [key, prop] of Object.entries(schema.properties)) {
        obj[key] = generateExampleForSchema(prop as any);
      }
      return obj;
    default:
      return null;
  }
}

/**
 * Build Health endpoint paths
 */
function buildHealthPaths(): Record<string, any> {
  return {
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check endpoint',
        description: 'Returns application health status for monitoring and Docker healthchecks',
        responses: {
          '200': {
            description: 'Application is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['healthy'] },
                    timestamp: { type: 'number', example: Date.now() },
                    uptime: { type: 'number', description: 'Process uptime in seconds' },
                    environment: { type: 'string', example: 'production' },
                    version: { type: 'string', example: '1.0.0' },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

/**
 * Build Gateway endpoint paths
 */
function buildGatewayPaths(): Record<string, any> {
  return {
    '/api/gateway/{gatewayId}': {
      get: {
        tags: ['Gateways'],
        summary: 'Get gateway status and sessions',
        description: 'Retrieve gateway connection status, active sessions, and metadata',
        parameters: [
          {
            name: 'gatewayId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'action',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['status', 'sessions', 'history'],
            },
            description: 'Gateway action: status (default) | sessions | history',
          },
        ],
        responses: {
          '200': {
            description: 'Gateway status retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    connected: { type: 'boolean' },
                    sessions: { type: 'array', items: { type: 'object' } },
                  },
                  example: {
                    connected: true,
                    sessions: [{ key: 'session-1', label: 'Main Session' }],
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Gateways'],
        summary: 'Send action to gateway',
        description: 'Execute actions on gateway: send message, provision agent, sync templates',
        parameters: [
          {
            name: 'gatewayId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  action: {
                    type: 'string',
                    enum: ['message', 'provision', 'sync'],
                    description: 'Gateway action to execute',
                  },
                  content: { type: 'string', description: 'Message content' },
                  sessionKey: { type: 'string', description: 'Target session key' },
                },
                required: ['action'],
                example: {
                  action: 'message',
                  sessionKey: 'session-1',
                  content: 'Deploy to production',
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Action executed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    result: { type: 'object' },
                  },
                  example: { ok: true, result: {} },
                },
              },
            },
          },
        },
      },
    },
  };
}

/**
 * Build Wiki endpoint paths
 */
function buildWikiPaths(): Record<string, any> {
  return {
    '/api/agents/{agentId}/wiki/pages': {
      get: {
        tags: ['Wiki'],
        summary: 'List wiki pages',
        description: 'Retrieve all wiki pages for an agent',
        parameters: [
          {
            name: 'agentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Wiki pages retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      title: { type: 'string' },
                      content: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Wiki'],
        summary: 'Create wiki page',
        description: 'Create a new wiki page',
        parameters: [
          {
            name: 'agentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  content: { type: 'string' },
                },
                required: ['title'],
                example: { title: 'Getting Started', content: '# Guide' },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Wiki page created',
          },
        },
      },
    },
    '/api/agents/{agentId}/wiki/pages/{pageId}': {
      get: {
        tags: ['Wiki'],
        summary: 'Get wiki page',
        description: 'Retrieve a specific wiki page',
        parameters: [
          {
            name: 'agentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'pageId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Wiki page retrieved',
          },
        },
      },
      patch: {
        tags: ['Wiki'],
        summary: 'Update wiki page',
        description: 'Update an existing wiki page',
        parameters: [
          {
            name: 'agentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'pageId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  content: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Wiki page updated',
          },
        },
      },
    },
  };
}

/**
 * Build State Engine endpoint paths
 */
function buildStateEnginePaths(): Record<string, any> {
  return {
    '/api/state-engine/alerts': {
      get: {
        tags: ['State Engine'],
        summary: 'List alerts',
        description: 'Retrieve system alerts and anomalies',
        responses: {
          '200': {
            description: 'Alerts retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      type: { type: 'string' },
                      severity: { type: 'string', enum: ['info', 'warning', 'critical'] },
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/state-engine/decisions': {
      get: {
        tags: ['State Engine'],
        summary: 'List management decisions',
        description: 'Retrieve audit trail of management decisions and actions',
        responses: {
          '200': {
            description: 'Decisions retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      action: { type: 'string' },
                      reason: { type: 'string' },
                      decidedAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/state-engine/metrics': {
      get: {
        tags: ['State Engine'],
        summary: 'Get system metrics',
        description: 'Retrieve aggregated system performance metrics',
        responses: {
          '200': {
            description: 'Metrics retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    executionsPerHour: { type: 'number' },
                    averageCompletionTime: { type: 'number' },
                    failureRate: { type: 'number' },
                  },
                  example: {
                    executionsPerHour: 42,
                    averageCompletionTime: 120,
                    failureRate: 0.02,
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

/**
 * Build Admin endpoint paths
 */
function buildAdminPaths(): Record<string, any> {
  return {
    '/api/admin/agents/setup-workspace': {
      post: {
        tags: ['Admin'],
        summary: 'Setup agent workspace',
        description: 'Initialize and configure agent workspace directory',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  agentId: { type: 'string' },
                  workspacePath: { type: 'string' },
                },
                required: ['agentId', 'workspacePath'],
                example: {
                  agentId: 'agent-123',
                  workspacePath: '/home/agent/workspace',
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Workspace setup complete',
          },
        },
      },
    },
    '/api/admin/migrations/agent-workspace-paths': {
      post: {
        tags: ['Admin'],
        summary: 'Migrate agent workspace paths',
        description: 'Update agent workspace paths during migration',
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  dryRun: { type: 'boolean' },
                },
                example: { dryRun: false },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Migration completed',
          },
        },
      },
    },
  };
}

/**
 * Build Calendar endpoint paths (enhanced)
 */
function buildCalendarEnhancedPaths(): Record<string, any> {
  return {
    '/api/calendar/create-event': {
      post: {
        tags: ['Calendar'],
        summary: 'Create calendar event',
        description: 'Create a new calendar event or task deadline',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  startTime: { type: 'string', format: 'date-time' },
                  endTime: { type: 'string', format: 'date-time' },
                  taskId: { type: 'string' },
                },
                required: ['title', 'startTime'],
                example: {
                  title: 'Sprint Planning',
                  startTime: '2024-03-01T10:00:00Z',
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Calendar event created',
          },
        },
      },
    },
    '/api/calendar/find-slots': {
      get: {
        tags: ['Calendar'],
        summary: 'Find available time slots',
        description: 'Query for available scheduling slots',
        parameters: [
          {
            name: 'duration',
            in: 'query',
            schema: { type: 'integer', description: 'Duration in minutes' },
          },
          {
            name: 'startDate',
            in: 'query',
            schema: { type: 'string', format: 'date' },
          },
        ],
        responses: {
          '200': {
            description: 'Available slots retrieved',
          },
        },
      },
    },
    '/api/calendar/mark-executed': {
      post: {
        tags: ['Calendar'],
        summary: 'Mark task as executed',
        description: 'Mark a scheduled task as executed',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  taskId: { type: 'string' },
                  completedAt: { type: 'string', format: 'date-time' },
                },
                required: ['taskId'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Task marked as executed',
          },
        },
      },
    },
    '/api/calendar/schedule-task': {
      post: {
        tags: ['Calendar'],
        summary: 'Schedule a task',
        description: 'Create a new scheduled task in calendar',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  taskId: { type: 'string' },
                  scheduledFor: { type: 'string', format: 'date-time' },
                  recurring: { type: 'boolean' },
                },
                required: ['taskId', 'scheduledFor'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Task scheduled',
          },
        },
      },
    },
  };
}

/**
 * Build Agent Key Management endpoint paths
 */
function buildAgentKeyManagementPaths(): Record<string, any> {
  return {
    '/api/agents/{agentId}/rotate-key': {
      post: {
        tags: ['Agent Key Management'],
        summary: 'Rotate agent API key',
        description: 'Generate new API key for agent and invalidate old one',
        parameters: [
          {
            name: 'agentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'API key rotated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    newKey: { type: 'string' },
                    expiresAt: { type: 'string', format: 'date-time' },
                  },
                  example: {
                    newKey: 'key_new_...',
                    expiresAt: '2024-12-31T23:59:59Z',
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

/**
 * Build Task execution paths (enhanced)
 */
function buildTaskExecutionEnhancedPaths(): Record<string, any> {
  return {
    '/api/tasks/execute': {
      get: {
        tags: ['Agent Tasks'],
        summary: 'Poll for executable tasks',
        description: 'Poll work queue for tasks eligible for execution (agent heartbeat)',
        parameters: [
          {
            name: 'agentId',
            in: 'query',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 5 },
          },
        ],
        responses: {
          '200': {
            description: 'Executable tasks returned',
          },
        },
      },
    },
  };
}

/**
 * Build default tags with expanded categories
 */
function buildDefaultTags(): Array<{
  name: string;
  description: string;
}> {
  return [
    {
      name: 'Agents',
      description: 'Agent lifecycle and management',
    },
    {
      name: 'Tasks',
      description: 'Task management and execution',
    },
    {
      name: 'Agent Tasks',
      description: 'Task polling and execution for agents',
    },
    {
      name: 'Epics',
      description: 'Epic and roadmap management',
    },
    {
      name: 'Memory',
      description: 'Workspace memory and knowledge base',
    },
    {
      name: 'Reports',
      description: 'Strategic reports and analytics',
    },
    {
      name: 'Calendar',
      description: 'Calendar and scheduling',
    },
    {
      name: 'Businesses',
      description: 'Business management and configuration',
    },
    {
      name: 'State Engine',
      description: 'System state, metrics, and decision management',
    },
    {
      name: 'Audit',
      description: 'Audit trail and action history',
    },
    {
      name: 'Admin',
      description: 'Administrative operations and setup',
    },
    {
      name: 'API',
      description: 'API metadata and documentation',
    },
    {
      name: 'Gateways',
      description: 'Gateway orchestration and distributed execution',
    },
    {
      name: 'Health',
      description: 'Application health and monitoring',
    },
    {
      name: 'Wiki',
      description: 'Wiki pages and documentation',
    },
    {
      name: 'Agent Key Management',
      description: 'Agent authentication key management',
    },
    {
      name: 'Agent Workspace',
      description: 'Agent workspace configuration and setup',
    },
    {
      name: 'Webhooks',
      description: 'Webhook and event integrations',
    },
  ];
}

/**
 * Generate OpenAPI specification
 * Consolidates 40+ endpoints into RESTful resource structure
 */
export function generateOpenAPISpec(): OpenAPISpec {
  // Keep existing paths (from the original generator)
  const existingPaths = {
    // ============= AGENT MANAGEMENT =============
    '/api/agents': {
      post: {
        tags: ['Agents'],
        summary: 'Register new agent',
        description: 'Register a new AI agent or retrieve existing agent credentials',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', minLength: 2, maxLength: 50 },
                  role: { type: 'string' },
                  level: { type: 'string', enum: ['lead', 'specialist', 'intern'] },
                  sessionKey: { type: 'string' },
                  capabilities: { type: 'array', items: { type: 'string' } },
                  model: { type: 'string' },
                  personality: { type: 'string' },
                },
                required: ['name', 'role', 'level', 'sessionKey'],
                example: {
                  name: 'CodeBot',
                  role: 'developer',
                  level: 'specialist',
                  sessionKey: 'session-abc123',
                  capabilities: ['coding', 'testing'],
                  model: 'gpt-4',
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Agent registered successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        agentId: { type: 'string' },
                        apiKey: { type: 'string' },
                        isNew: { type: 'boolean' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/api/agents/{agentId}': {
      get: {
        tags: ['Agents'],
        summary: 'Get agent details',
        description: 'Retrieve agent profile, status, and metadata',
        parameters: [
          {
            name: 'agentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Agent details retrieved',
          },
        },
      },
    },

    '/api/agents/{agentId}/heartbeat': {
      post: {
        tags: ['Agents'],
        summary: 'Agent heartbeat ping',
        description: 'Record agent heartbeat and update last-seen timestamp',
        parameters: [
          {
            name: 'agentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Heartbeat recorded',
          },
        },
      },
    },

    '/api/agents/{agentId}/poll': {
      post: {
        tags: ['Agents'],
        summary: 'Poll for work queue updates',
        description: 'Long-poll for new tasks or commands for the agent',
        parameters: [
          {
            name: 'agentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Work queue updates returned',
          },
        },
      },
    },

    '/api/agents/{agentId}/tasks': {
      get: {
        tags: ['Agent Tasks'],
        summary: 'Get agent tasks',
        description: 'Retrieve all tasks assigned to this agent',
        parameters: [
          {
            name: 'agentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Agent tasks retrieved',
          },
        },
      },
    },

    '/api/agents/{agentId}/tasks/{taskId}': {
      get: {
        tags: ['Agent Tasks'],
        summary: 'Get task details',
        description: 'Retrieve specific task assigned to agent',
        parameters: [
          {
            name: 'agentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'taskId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Task details retrieved',
          },
        },
      },
      put: {
        tags: ['Agent Tasks'],
        summary: 'Update task',
        description: 'Update task properties (title, status, priority, progress, dueDate)',
        parameters: [
          {
            name: 'agentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'taskId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string', description: 'Task title' },
                  description: { type: 'string', description: 'Task description' },
                  status: {
                    type: 'string',
                    enum: ['pending', 'in_progress', 'completed'],
                    description: 'Task status',
                  },
                  priority: {
                    type: 'string',
                    enum: ['low', 'normal', 'high'],
                    description: 'Task priority',
                  },
                  progress: {
                    type: 'number',
                    minimum: 0,
                    maximum: 100,
                    description: 'Task progress percentage',
                  },
                  dueDate: {
                    type: 'string',
                    format: 'date',
                    description: 'Task due date (ISO format)',
                  },
                },
                example: {
                  title: 'Updated task title',
                  status: 'in_progress',
                  priority: 'high',
                  progress: 50,
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Task updated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        title: { type: 'string' },
                        description: { type: 'string' },
                        status: { type: 'string' },
                        priority: { type: 'string' },
                        progress: { type: 'number' },
                        dueDate: { type: ['string', 'null'] },
                        updatedAt: { type: 'string', format: 'date-time' },
                      },
                    },
                    requestId: { type: 'string' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Bad request - Invalid field values',
          },
          '404': {
            description: 'Task not found',
          },
        },
      },
      patch: {
        tags: ['Agent Tasks'],
        summary: 'Update task status',
        description: 'Update task status, progress, or add execution results',
        parameters: [
          {
            name: 'agentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'taskId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['in_progress', 'done', 'failed'] },
                  result: { type: 'object' },
                  error: { type: 'string' },
                },
                example: {
                  status: 'done',
                  result: { output: 'Task completed successfully' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Task updated',
          },
        },
      },
    },

    '/api/agents/{agentId}/tasks/{taskId}/comments': {
      post: {
        tags: ['Agent Tasks'],
        summary: 'Add task comment',
        description: 'Add comment or note to a task',
        parameters: [
          {
            name: 'agentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'taskId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  content: { type: 'string' },
                },
                required: ['content'],
                example: { content: 'Working on implementation...' },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Comment added',
          },
        },
      },
    },

    // ============= TASKS =============
    '/api/tasks/{taskId}': {
      get: {
        tags: ['Tasks'],
        summary: 'Get task details',
        description: 'Retrieve full task record with all metadata',
        parameters: [
          {
            name: 'taskId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Task retrieved',
          },
        },
      },
      patch: {
        tags: ['Tasks'],
        summary: 'Update task',
        description: 'Update task metadata, status, or dependencies',
        parameters: [
          {
            name: 'taskId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Task updated',
          },
        },
      },
    },

    '/api/tasks/{taskId}/calendar-events': {
      get: {
        tags: ['Calendar'],
        summary: 'Get task calendar events',
        description: 'Retrieve calendar events linked to this task',
        parameters: [
          {
            name: 'taskId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Calendar events retrieved',
          },
        },
      },
    },

    '/api/tasks/generate-daily': {
      post: {
        tags: ['Tasks'],
        summary: 'Generate daily tasks',
        description: 'Use AI to generate recommended tasks for the day',
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  businessId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Daily tasks generated',
          },
        },
      },
    },

    // ============= EPICS =============
    '/api/epics': {
      get: {
        tags: ['Epics'],
        summary: 'List epics',
        description: 'Retrieve all epics with their associated tasks',
        responses: {
          '200': {
            description: 'Epics retrieved',
          },
        },
      },
      post: {
        tags: ['Epics'],
        summary: 'Create epic',
        description: 'Create a new epic (feature grouping)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                },
                required: ['title'],
                example: { title: 'Q1 2024 Goals', description: 'First quarter initiatives' },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Epic created',
          },
        },
      },
    },

    // ============= MEMORY =============
    '/api/memory': {
      get: {
        tags: ['Memory'],
        summary: 'Get memory index',
        description: 'Retrieve memory file index and metadata',
        responses: {
          '200': {
            description: 'Memory index retrieved',
          },
        },
      },
    },

    '/api/memory/files': {
      get: {
        tags: ['Memory'],
        summary: 'List memory files',
        description: 'List all memory files in workspace',
        responses: {
          '200': {
            description: 'Memory files listed',
          },
        },
      },
    },

    '/api/memory/search': {
      get: {
        tags: ['Memory'],
        summary: 'Search memory',
        description: 'Semantic search across memory files',
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Search results returned',
          },
        },
      },
    },

    '/api/memory/context': {
      get: {
        tags: ['Memory'],
        summary: 'Get memory context',
        description: 'Retrieve contextual memory for task execution',
        responses: {
          '200': {
            description: 'Memory context retrieved',
          },
        },
      },
    },

    // ============= REPORTS =============
    '/api/reports': {
      get: {
        tags: ['Reports'],
        summary: 'List strategic reports',
        description: 'Retrieve weekly strategic analysis reports',
        responses: {
          '200': {
            description: 'Reports retrieved',
          },
        },
      },
    },

    // ============= CALENDAR =============
    '/api/calendar/events': {
      get: {
        tags: ['Calendar'],
        summary: 'List calendar events',
        description: 'Retrieve calendar events for the business',
        responses: {
          '200': {
            description: 'Calendar events retrieved',
          },
        },
      },
      post: {
        tags: ['Calendar'],
        summary: 'Create calendar event',
        description: 'Create a new calendar event',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  startTime: { type: 'string', format: 'date-time' },
                },
                required: ['title', 'startTime'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Calendar event created',
          },
        },
      },
    },

    '/api/calendar/events/{eventId}': {
      get: {
        tags: ['Calendar'],
        summary: 'Get calendar event',
        description: 'Retrieve specific calendar event',
        parameters: [
          {
            name: 'eventId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Calendar event retrieved',
          },
        },
      },
      patch: {
        tags: ['Calendar'],
        summary: 'Update calendar event',
        description: 'Update calendar event details',
        parameters: [
          {
            name: 'eventId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Calendar event updated',
          },
        },
      },
      delete: {
        tags: ['Calendar'],
        summary: 'Delete calendar event',
        description: 'Delete a calendar event',
        parameters: [
          {
            name: 'eventId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '204': {
            description: 'Calendar event deleted',
          },
        },
      },
    },

    '/api/calendar/slots': {
      get: {
        tags: ['Calendar'],
        summary: 'Find available slots',
        description: 'Query for available time slots',
        parameters: [
          {
            name: 'duration',
            in: 'query',
            schema: { type: 'integer' },
          },
        ],
        responses: {
          '200': {
            description: 'Available slots retrieved',
          },
        },
      },
    },

    // ============= BUSINESSES =============
    '/api/businesses': {
      get: {
        tags: ['Businesses'],
        summary: 'List businesses',
        description: 'Retrieve all businesses',
        responses: {
          '200': {
            description: 'Businesses retrieved',
          },
        },
      },
      post: {
        tags: ['Businesses'],
        summary: 'Create business',
        description: 'Create a new business',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  slug: { type: 'string' },
                },
                required: ['name', 'slug'],
                example: { name: 'ACME Corp', slug: 'acme' },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Business created',
          },
        },
      },
    },

    // ============= STATE ENGINE (ORIGINAL - FIXED PATHS) =============
    '/api/state-engine/alerts': {
      get: {
        tags: ['State Engine'],
        summary: 'List system alerts',
        description: 'Retrieve operational alerts and anomalies',
        responses: {
          '200': {
            description: 'Alerts retrieved',
          },
        },
      },
    },

    '/api/state-engine/decisions': {
      get: {
        tags: ['State Engine'],
        summary: 'List management decisions',
        description: 'Retrieve audit trail of decisions',
        responses: {
          '200': {
            description: 'Decisions retrieved',
          },
        },
      },
    },

    '/api/state-engine/metrics': {
      get: {
        tags: ['State Engine'],
        summary: 'Get system metrics',
        description: 'Retrieve aggregated performance metrics',
        responses: {
          '200': {
            description: 'Metrics retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    executionsPerHour: { type: 'number' },
                    failureRate: { type: 'number' },
                  },
                  example: {
                    executionsPerHour: 42,
                    failureRate: 0.02,
                  },
                },
              },
            },
          },
        },
      },
    },

    // ============= AUDIT =============
    '/api/audit-trail': {
      get: {
        tags: ['Audit'],
        summary: 'Get audit trail',
        description: 'Retrieve audit log of system actions',
        responses: {
          '200': {
            description: 'Audit trail retrieved',
          },
        },
      },
    },

    // ============= ADMIN =============
    '/api/admin/goals/seed': {
      post: {
        tags: ['Admin'],
        summary: 'Seed demo goals',
        description: 'Populate database with demo goal data',
        responses: {
          '200': {
            description: 'Demo goals seeded',
          },
        },
      },
    },

    '/api/admin/goals/demo': {
      delete: {
        tags: ['Admin'],
        summary: 'Delete demo goals',
        description: 'Remove all demo goal data',
        responses: {
          '200': {
            description: 'Demo goals deleted',
          },
        },
      },
    },

    // ============= WORKSPACE =============
    '/api/agents/workspace/structure': {
      get: {
        tags: ['Agent Workspace'],
        summary: 'Get workspace structure',
        description: 'Retrieve agent workspace directory structure',
        responses: {
          '200': {
            description: 'Workspace structure retrieved',
          },
        },
      },
    },

    // ============= EXECUTION =============
    '/api/tasks/execute': {
      post: {
        tags: ['Tasks'],
        summary: 'Execute task',
        description: 'Trigger immediate task execution',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  taskId: { type: 'string' },
                },
                required: ['taskId'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Task execution started',
          },
        },
      },
    },

    // ============= API =============
    '/api/openapi': {
      get: {
        tags: ['API'],
        summary: 'Get OpenAPI specification',
        description: 'Retrieve OpenAPI 3.0 specification for this API',
        responses: {
          '200': {
            description: 'OpenAPI spec retrieved',
          },
        },
      },
    },

    // ============= V1 API - REST Foundation =============
    '/api/v1/workspaces/{workspaceId}/agents/{agentId}/tasks/{taskId}': {
      get: {
        tags: ['V1 Agent Tasks'],
        summary: 'Get task detail',
        description: 'Retrieve specific task assigned to agent',
        parameters: [
          {
            name: 'workspaceId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Workspace identifier',
          },
          {
            name: 'agentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Agent identifier',
          },
          {
            name: 'taskId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Task identifier',
          },
        ],
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Task details retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        title: { type: 'string' },
                        description: { type: 'string' },
                        status: { type: 'string' },
                        priority: { type: 'string' },
                        progress: { type: 'number' },
                      },
                    },
                    requestId: { type: 'string' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Task not found',
          },
        },
      },
      put: {
        tags: ['V1 Agent Tasks'],
        summary: 'Update task',
        description: 'Update task properties (title, description, status, priority, progress, dueDate)',
        parameters: [
          {
            name: 'workspaceId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'agentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'taskId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  status: {
                    type: 'string',
                    enum: ['pending', 'in_progress', 'completed'],
                  },
                  priority: {
                    type: 'string',
                    enum: ['low', 'normal', 'high'],
                  },
                  progress: {
                    type: 'number',
                    minimum: 0,
                    maximum: 100,
                  },
                  dueDate: { type: 'string', format: 'date' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Task updated successfully',
          },
          '400': {
            description: 'Validation error - Invalid field values',
          },
          '404': {
            description: 'Task not found',
          },
        },
      },
    },

    '/api/v1/workspaces/{workspaceId}/agents/{agentId}/tasks/{taskId}/comments': {
      get: {
        tags: ['V1 Agent Task Comments'],
        summary: 'List task comments',
        description: 'Retrieve paginated list of comments for a task',
        parameters: [
          {
            name: 'workspaceId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'agentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'taskId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'number', default: 20, minimum: 1, maximum: 100 },
            description: 'Number of items to return',
          },
          {
            name: 'cursor',
            in: 'query',
            schema: { type: 'string' },
            description: 'Pagination cursor',
          },
        ],
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Comments retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          content: { type: 'string' },
                          authorId: { type: 'string' },
                          createdAt: { type: 'string', format: 'date-time' },
                        },
                      },
                    },
                    pagination: {
                      type: 'object',
                      properties: {
                        total: { type: 'number' },
                        cursor: { type: ['string', 'null'] },
                        hasMore: { type: 'boolean' },
                      },
                    },
                    requestId: { type: 'string' },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Task not found',
          },
        },
      },
      post: {
        tags: ['V1 Agent Task Comments'],
        summary: 'Create task comment',
        description: 'Add a new comment to a task',
        parameters: [
          {
            name: 'workspaceId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'agentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'taskId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  content: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 5000,
                    description: 'Comment content',
                  },
                },
                required: ['content'],
                example: { content: 'This is a task comment' },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Comment created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        content: { type: 'string' },
                        authorId: { type: 'string' },
                        createdAt: { type: 'string', format: 'date-time' },
                      },
                    },
                    requestId: { type: 'string' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error - Invalid comment content',
          },
          '404': {
            description: 'Task not found',
          },
        },
      },
    },

    '/api/v1/workspaces/{workspaceId}/agents/{agentId}/tasks/{taskId}/comments/{commentId}': {
      get: {
        tags: ['V1 Agent Task Comments'],
        summary: 'Get comment detail',
        description: 'Retrieve a specific comment on a task',
        parameters: [
          {
            name: 'workspaceId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'agentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'taskId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'commentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Comment identifier',
          },
        ],
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Comment retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        content: { type: 'string' },
                        authorId: { type: 'string' },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                      },
                    },
                    requestId: { type: 'string' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Comment not found',
          },
        },
      },
      put: {
        tags: ['V1 Agent Task Comments'],
        summary: 'Update comment',
        description: 'Modify the content of an existing comment',
        parameters: [
          {
            name: 'workspaceId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'agentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'taskId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'commentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  content: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 5000,
                    description: 'Updated comment content',
                  },
                },
                required: ['content'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Comment updated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        content: { type: 'string' },
                        authorId: { type: 'string' },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                      },
                    },
                    requestId: { type: 'string' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error - Invalid comment content',
          },
          '404': {
            description: 'Comment not found',
          },
        },
      },
      delete: {
        tags: ['V1 Agent Task Comments'],
        summary: 'Delete comment',
        description: 'Remove a comment from a task',
        parameters: [
          {
            name: 'workspaceId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'agentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'taskId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'commentId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Comment deleted successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        deleted: { type: 'boolean' },
                      },
                    },
                    requestId: { type: 'string' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Comment not found',
          },
        },
      },
    },

    // ============= V1 API - Workspace Tasks (Routes 14-18) =============
    '/api/v1/workspaces/{workspaceId}/tasks': {
      get: {
        tags: ['V1 Workspace Tasks'],
        summary: 'List workspace tasks',
        description: 'Retrieve all tasks in a workspace with pagination and optional status filtering',
        parameters: [
          {
            name: 'workspaceId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Workspace identifier',
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 },
            description: 'Number of tasks per page (default 20)',
          },
          {
            name: 'cursor',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Pagination cursor for next page',
          },
          {
            name: 'status',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
            description: 'Optional status filter',
          },
        ],
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Tasks retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          title: { type: 'string' },
                          description: { type: 'string' },
                          priority: { type: 'string', enum: ['low', 'normal', 'high'] },
                          status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
                          createdAt: { type: 'number' },
                        },
                      },
                    },
                    pagination: {
                      type: 'object',
                      properties: {
                        total: { type: 'integer' },
                        cursor: { type: 'string' },
                        hasMore: { type: 'boolean' },
                      },
                    },
                    requestId: { type: 'string' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Workspace not found',
          },
        },
      },
      post: {
        tags: ['V1 Workspace Tasks'],
        summary: 'Create task',
        description: 'Create a new task in a workspace',
        parameters: [
          {
            name: 'workspaceId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Workspace identifier',
          },
        ],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title'],
                properties: {
                  title: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 200,
                    description: 'Task title (required, 1-200 chars)',
                  },
                  description: {
                    type: 'string',
                    maxLength: 5000,
                    description: 'Task description (optional, max 5000 chars)',
                  },
                  priority: {
                    type: 'string',
                    enum: ['low', 'normal', 'high'],
                    default: 'normal',
                    description: 'Task priority level (optional, default "normal")',
                  },
                  status: {
                    type: 'string',
                    enum: ['pending', 'in_progress', 'completed'],
                    default: 'pending',
                    description: 'Task status (optional, default "pending")',
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Task created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        title: { type: 'string' },
                        description: { type: 'string' },
                        priority: { type: 'string' },
                        status: { type: 'string' },
                        createdAt: { type: 'number' },
                      },
                    },
                    requestId: { type: 'string' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error - Invalid request body',
          },
          '404': {
            description: 'Workspace not found',
          },
        },
      },
    },

    '/api/v1/workspaces/{workspaceId}/tasks/{taskId}': {
      get: {
        tags: ['V1 Workspace Tasks'],
        summary: 'Get task detail',
        description: 'Retrieve a specific task from a workspace',
        parameters: [
          {
            name: 'workspaceId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Workspace identifier',
          },
          {
            name: 'taskId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Task identifier',
          },
        ],
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Task details retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        title: { type: 'string' },
                        description: { type: 'string' },
                        priority: { type: 'string' },
                        status: { type: 'string' },
                        createdAt: { type: 'number' },
                        updatedAt: { type: 'number' },
                      },
                    },
                    requestId: { type: 'string' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Task or workspace not found',
          },
        },
      },
      put: {
        tags: ['V1 Workspace Tasks'],
        summary: 'Update task',
        description: 'Update task properties (title, description, priority, status)',
        parameters: [
          {
            name: 'workspaceId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Workspace identifier',
          },
          {
            name: 'taskId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Task identifier',
          },
        ],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 200,
                    description: 'Task title (1-200 chars)',
                  },
                  description: {
                    type: 'string',
                    maxLength: 5000,
                    description: 'Task description (max 5000 chars)',
                  },
                  priority: {
                    type: 'string',
                    enum: ['low', 'normal', 'high'],
                    description: 'Task priority level',
                  },
                  status: {
                    type: 'string',
                    enum: ['pending', 'in_progress', 'completed'],
                    description: 'Task status',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Task updated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        title: { type: 'string' },
                        description: { type: 'string' },
                        priority: { type: 'string' },
                        status: { type: 'string' },
                        createdAt: { type: 'number' },
                        updatedAt: { type: 'number' },
                      },
                    },
                    requestId: { type: 'string' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error - Invalid request body',
          },
          '404': {
            description: 'Task or workspace not found',
          },
        },
      },
      delete: {
        tags: ['V1 Workspace Tasks'],
        summary: 'Delete task',
        description: 'Remove a task from a workspace',
        parameters: [
          {
            name: 'workspaceId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Workspace identifier',
          },
          {
            name: 'taskId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Task identifier',
          },
        ],
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Task deleted successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        deleted: { type: 'boolean' },
                        taskId: { type: 'string' },
                      },
                    },
                    requestId: { type: 'string' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Task or workspace not found',
          },
        },
      },
    },
  };

  // Merge all path builders
  const allPaths = {
    ...existingPaths,
    ...buildHealthPaths(),
    ...buildGatewayPaths(),
    ...buildWikiPaths(),
    ...buildAgentKeyManagementPaths(),
    ...buildCalendarEnhancedPaths(),
    ...buildAdminPaths(),
    ...buildTaskExecutionEnhancedPaths(),
  };

  return {
    openapi: '3.0.0',
    info: {
      title: 'Mission Control API',
      version: '3.0.0',
      description:
        'RESTful API for autonomous agent management, state engine, and task orchestration. Follows REST best practices with resource-based URLs and HTTP method semantics.',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://mission-control.example.com',
        description: 'Production server',
      },
    ],
    paths: allPaths,
    components: {
      schemas: {
        Error: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
            details: { type: 'object' },
          },
        },
      },
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Agent-Key',
          description: 'Agent API key for authentication',
        },
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'Bearer token authentication',
        },
      },
    },
    tags: buildDefaultTags(),
  };
}
