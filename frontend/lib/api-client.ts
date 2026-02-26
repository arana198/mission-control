/**
 * Mission Control API Client
 *
 * Type-safe TypeScript client generated from OpenAPI 3.0 specification.
 * Use this client in frontend components and backend services to interact with the API.
 *
 * Example usage:
 * ```typescript
 * const client = new MissionControlAPIClient('http://localhost:3000');
 *
 * // Escalate a task
 * await client.tasks.escalate(taskId, {
 *   businessId: 'biz_123',
 *   reason: 'blocking_other_tasks',
 *   decidedBy: 'openclaw'
 * });
 *
 * // Complete a task
 * await client.tasks.complete(taskId, {
 *   action: 'complete',
 *   agentId: 'agent_1',
 *   agentKey: 'key_xyz',
 *   completionNotes: 'Task completed successfully',
 *   timeSpent: 45
 * });
 *
 * // List epics
 * const epics = await client.epics.list({ businessId: 'biz_123' });
 * ```
 */

export interface ApiClientConfig {
  baseUrl: string;
  timeout?: number;
  headers?: Record<string, string>;
}

// ============= TYPE DEFINITIONS =============

export interface TaskActionRequest {
  action:
    | 'assign'
    | 'complete'
    | 'update-status'
    | 'update-tags'
    | 'escalate'
    | 'reassign'
    | 'unblock'
    | 'mark-executed';
  // Agent-facing actions
  agentKey?: string;
  agentId?: string;
  assigneeIds?: string[];
  completionNotes?: string;
  timeSpent?: number;
  status?: string;
  tags?: string[];
  tagsToAdd?: string[];
  tagsToRemove?: string[];
  // State-engine actions
  businessId?: string;
  reason?: string;
  decidedBy?: string;
  toAgent?: string;
  outcome?: string;
}

export interface TaskActionResponse {
  success: boolean;
  action?: string;
  taskId?: string;
  message?: string;
  [key: string]: any;
}

export interface AgentRegistrationRequest {
  name: string;
  role: string;
  level: 'lead' | 'specialist' | 'intern';
  sessionKey: string;
  capabilities?: string[];
  model?: string;
  personality?: string;
}

export interface AgentRegistrationResponse {
  success: boolean;
  data: {
    agentId: string;
    apiKey: string;
    isNew: boolean;
  };
}

export interface EpicsListResponse {
  success: boolean;
  epics: Array<{
    id: string;
    title: string;
    description: string;
    status: string;
    progress: number;
    taskCount: number;
  }>;
  message: string;
}

export interface MemoryListResponse {
  files: string[];
}

export interface MemoryFileResponse {
  content: string;
}

export interface MemoryContextResponse {
  entity: string;
  type?: string;
  relevantSections: any[];
  relatedGoals: any[];
  priorStrategies: any[];
  recommendations: any[];
}

export interface ReportResponse {
  [key: string]: any;
}

export interface CalendarEventResponse {
  [key: string]: any;
}

export interface ApiError {
  code?: string;
  message: string;
  details?: any;
}

// ============= MAIN CLIENT CLASS =============

export class MissionControlAPIClient {
  private baseUrl: string;
  private timeout: number;
  private headers: Record<string, string>;

  constructor(config: ApiClientConfig | string) {
    if (typeof config === 'string') {
      this.baseUrl = config;
      this.timeout = 30000;
      this.headers = { 'Content-Type': 'application/json' };
    } else {
      this.baseUrl = config.baseUrl;
      this.timeout = config.timeout || 30000;
      this.headers = {
        'Content-Type': 'application/json',
        ...config.headers,
      };
    }
  }

  /**
   * Make HTTP request with timeout support
   */
  private async request<T>(
    method: string,
    path: string,
    body?: any,
    options?: { headers?: Record<string, string>; params?: Record<string, string> }
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);

    if (options?.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const response = await Promise.race([
      fetch(url.toString(), {
        method,
        headers: { ...this.headers, ...options?.headers },
        body: body ? JSON.stringify(body) : undefined,
      }),
      new Promise<Response>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Request timeout after ${this.timeout}ms`)),
          this.timeout
        )
      ),
    ]);

    const data = await response.json();

    if (!response.ok) {
      const error: ApiError = data.error || { message: response.statusText };
      throw new Error(JSON.stringify(error));
    }

    return data as T;
  }

  // ============= AGENTS API =============

  agents = {
    register: async (req: AgentRegistrationRequest): Promise<AgentRegistrationResponse> => {
      return this.request('POST', '/api/agents', req);
    },

    list: async (headers: { agentId: string; agentKey: string }): Promise<any> => {
      return this.request('GET', '/api/agents', undefined, { headers });
    },

    get: async (agentId: string, agentKey: string): Promise<any> => {
      return this.request('GET', `/api/agents/${agentId}`, undefined, {
        params: { agentKey },
      });
    },

    update: async (
      agentId: string,
      updates: {
        agentKey: string;
        workspace?: string;
        model?: string;
        personality?: string;
        capabilities?: string[];
      }
    ): Promise<any> => {
      return this.request('PATCH', `/api/agents/${agentId}`, updates);
    },

    heartbeat: async (
      agentId: string,
      data: {
        agentKey: string;
        currentTaskId?: string;
        status?: 'idle' | 'active' | 'blocked';
      }
    ): Promise<any> => {
      return this.request('POST', `/api/agents/${agentId}/heartbeat`, data);
    },

    poll: async (
      agentId: string,
      data: {
        agentKey: string;
        businessId: string;
        limit?: number;
      }
    ): Promise<any> => {
      return this.request('POST', `/api/agents/${agentId}/poll`, data);
    },

    getTasks: async (
      agentId: string,
      businessId: string,
      agentKey?: string
    ): Promise<any> => {
      return this.request('GET', `/api/agents/${agentId}/tasks`, undefined, {
        params: { businessId, ...(agentKey && { agentKey }) },
      });
    },

    getTask: async (
      agentId: string,
      taskId: string,
      agentKey: string
    ): Promise<any> => {
      return this.request('GET', `/api/agents/${agentId}/tasks/${taskId}`, undefined, {
        params: { agentKey },
      });
    },

    addComment: async (
      agentId: string,
      taskId: string,
      data: {
        agentKey: string;
        text: string;
      }
    ): Promise<any> => {
      return this.request(
        'POST',
        `/api/agents/${agentId}/tasks/${taskId}/comments`,
        data
      );
    },
  };

  // ============= TASKS API =============

  tasks = {
    /**
     * Unified task action endpoint
     * Supports: assign, complete, update-status, update-tags, escalate, reassign, unblock, mark-executed
     */
    executeAction: async (
      taskId: string,
      action: TaskActionRequest
    ): Promise<TaskActionResponse> => {
      return this.request('PATCH', `/api/tasks/${taskId}`, action);
    },

    assign: async (
      taskId: string,
      data: {
        action: 'assign';
        agentId: string;
        agentKey: string;
        assigneeIds: string[];
      }
    ): Promise<TaskActionResponse> => {
      return this.tasks.executeAction(taskId, data);
    },

    complete: async (
      taskId: string,
      data: {
        action: 'complete';
        agentId: string;
        agentKey: string;
        completionNotes?: string;
        timeSpent?: number;
      }
    ): Promise<TaskActionResponse> => {
      return this.tasks.executeAction(taskId, data);
    },

    escalate: async (
      taskId: string,
      data: {
        action: 'escalate';
        businessId: string;
        reason: string;
        decidedBy: string;
      }
    ): Promise<TaskActionResponse> => {
      return this.tasks.executeAction(taskId, data);
    },

    reassign: async (
      taskId: string,
      data: {
        action: 'reassign';
        toAgent: string;
        reason: string;
        decidedBy: string;
        fromAgent?: string;
      }
    ): Promise<TaskActionResponse> => {
      return this.tasks.executeAction(taskId, data);
    },

    unblock: async (
      taskId: string,
      data: {
        action: 'unblock';
        reason: string;
        decidedBy: string;
      }
    ): Promise<TaskActionResponse> => {
      return this.tasks.executeAction(taskId, data);
    },

    markExecuted: async (
      taskId: string,
      data: {
        action: 'mark-executed';
        outcome: string;
        decidedBy: string;
      }
    ): Promise<TaskActionResponse> => {
      return this.tasks.executeAction(taskId, data);
    },

    getCalendarEvents: async (taskId: string): Promise<CalendarEventResponse[]> => {
      return this.request('GET', `/api/tasks/${taskId}/calendar-events`);
    },

    execute: async (data: {
      taskId: string;
      goalIds?: string[];
      timeout?: number;
    }): Promise<any> => {
      return this.request('POST', '/api/tasks/execute', data);
    },

    generateDaily: async (data: {
      businessId: string;
      date?: string;
    }): Promise<any> => {
      return this.request('POST', '/api/tasks/generate-daily', data);
    },
  };

  // ============= RESOURCES API =============

  epics = {
    list: async (businessId: string): Promise<EpicsListResponse> => {
      return this.request('GET', '/api/epics', undefined, { params: { businessId } });
    },
  };

  memory = {
    list: async (): Promise<MemoryListResponse> => {
      return this.request('GET', '/api/memory');
    },

    getFile: async (path: string): Promise<MemoryFileResponse> => {
      return this.request('GET', '/api/memory/files', undefined, { params: { path } });
    },

    search: async (query: string, limit?: number): Promise<any> => {
      return this.request('POST', '/api/memory/search', { query, limit });
    },

    getContext: async (entity: string, type?: string): Promise<MemoryContextResponse> => {
      return this.request('GET', '/api/memory/context', undefined, {
        params: { entity, ...(type && { type }) },
      });
    },
  };

  reports = {
    fetch: async (type: string, week: number, year?: number): Promise<ReportResponse> => {
      return this.request('GET', '/api/reports', undefined, {
        params: { type, week: String(week), ...(year && { year: String(year) }) },
      });
    },

    generate: async (data: {
      type: string;
      businessId: string;
      startDate?: string;
      endDate?: string;
    }): Promise<ReportResponse> => {
      return this.request('POST', '/api/reports', data);
    },
  };

  calendar = {
    listEvents: async (): Promise<CalendarEventResponse[]> => {
      return this.request('GET', '/api/calendar/events');
    },

    getEvent: async (eventId: string): Promise<CalendarEventResponse> => {
      return this.request('GET', `/api/calendar/events/${eventId}`);
    },

    getSlots: async (): Promise<any> => {
      return this.request('GET', '/api/calendar/slots');
    },
  };

  businesses = {
    list: async (): Promise<any> => {
      return this.request('GET', '/api/businesses');
    },
  };

  state = {
    metrics: async (agentId?: string): Promise<any> => {
      return this.request('GET', '/api/state/metrics', undefined, {
        params: { ...(agentId && { agentId }) },
      });
    },

    alerts: async (severity?: string): Promise<any> => {
      return this.request('GET', '/api/state/alerts', undefined, {
        params: { ...(severity && { severity }) },
      });
    },
  };

  admin = {
    seedGoals: async (): Promise<any> => {
      return this.request('POST', '/api/admin/goals/seed');
    },

    cleanupGoals: async (): Promise<any> => {
      return this.request('DELETE', '/api/admin/goals/demo');
    },
  };

  // ============= HEALTH CHECK =============

  health = {
    getSpec: async (): Promise<any> => {
      return this.request('GET', '/api/openapi');
    },
  };
}

// ============= SINGLETON EXPORT =============

let globalClient: MissionControlAPIClient | null = null;

export function getApiClient(baseUrl?: string): MissionControlAPIClient {
  if (!globalClient) {
    const url =
      baseUrl ||
      (typeof window !== 'undefined'
        ? window.location.origin
        : process.env.API_BASE_URL || 'http://localhost:3000');
    globalClient = new MissionControlAPIClient(url);
  }
  return globalClient;
}

export function createApiClient(config: ApiClientConfig | string): MissionControlAPIClient {
  return new MissionControlAPIClient(config);
}
