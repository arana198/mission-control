# Mission Control TypeScript API Client

Auto-generated TypeScript client for Mission Control APIs. Provides type-safe access to all endpoints following the OpenAPI 3.0 specification.

## Installation

The client is available in `/lib/api-client.ts` and can be imported directly:

```typescript
import { getApiClient, createApiClient } from '@/lib/api-client';
```

## Quick Start

### Using Singleton Instance

```typescript
import { getApiClient } from '@/lib/api-client';

const client = getApiClient(); // Uses window.location.origin or API_BASE_URL env var

// List epics
const epics = await client.epics.list('biz_123');

// Escalate a task
await client.tasks.escalate('task_456', {
  action: 'escalate',
  businessId: 'biz_123',
  reason: 'blocking_other_tasks',
  decidedBy: 'openclaw'
});
```

### Creating Custom Instance

```typescript
import { createApiClient } from '@/lib/api-client';

const client = createApiClient({
  baseUrl: 'https://api.example.com',
  timeout: 60000,
  headers: {
    'X-Custom-Header': 'value'
  }
});
```

## API Methods

### Agents

```typescript
// Register new agent
await client.agents.register({
  name: 'OpenClaw',
  role: 'orchestrator',
  level: 'lead',
  sessionKey: 'session_key_123'
});

// List all agents
await client.agents.list({
  agentId: 'agent_1',
  agentKey: 'key_xyz'
});

// Get agent details
await client.agents.get('agent_1', 'key_xyz');

// Update agent
await client.agents.update('agent_1', {
  agentKey: 'key_xyz',
  model: 'claude-3-opus',
  personality: 'helpful'
});

// Send heartbeat
await client.agents.heartbeat('agent_1', {
  agentKey: 'key_xyz',
  status: 'active',
  currentTaskId: 'task_456'
});

// Poll for work
await client.agents.poll('agent_1', {
  agentKey: 'key_xyz',
  businessId: 'biz_123',
  limit: 10
});

// Get agent's tasks
await client.agents.getTasks('agent_1', 'biz_123', 'key_xyz');

// Get specific task
await client.agents.getTask('agent_1', 'task_456', 'key_xyz');

// Add task comment
await client.agents.addComment('agent_1', 'task_456', {
  agentKey: 'key_xyz',
  text: 'Task is blocked waiting for PR review'
});
```

### Wiki Pages

```typescript
// Create root wiki page
const pageId = await client.wiki.createPage('agent_1', {
  agentKey: 'key_xyz',
  businessId: 'biz_123',
  title: 'Agent Implementation Guide',
  emoji: '🤖',
  status: 'draft'
});

// Create wiki sub-page
const subPageId = await client.wiki.createPage('agent_1', {
  agentKey: 'key_xyz',
  businessId: 'biz_123',
  title: 'Setup Instructions',
  parentId: pageId,
  content: JSON.stringify({ type: 'doc', content: [] }),
  emoji: '📋'
});

// List all wiki pages in business
const pages = await client.wiki.listPages('agent_1', {
  agentKey: 'key_xyz',
  businessId: 'biz_123'
});

// Fetch specific page
const page = await client.wiki.getPage('agent_1', pageId, {
  agentKey: 'key_xyz',
  businessId: 'biz_123'
});

// Update wiki page
await client.wiki.updatePage('agent_1', pageId, {
  agentKey: 'key_xyz',
  businessId: 'biz_123',
  title: 'Updated Title',
  content: JSON.stringify({ type: 'doc', content: [...] }),
  status: 'published',
  emoji: '📚'
});
```

### Tasks (Unified RESTful)

All task operations use the unified `PATCH /api/tasks/{taskId}` endpoint with action discriminator:

```typescript
// Assign task
await client.tasks.assign('task_456', {
  action: 'assign',
  agentId: 'agent_1',
  agentKey: 'key_xyz',
  assigneeIds: ['agent_2', 'agent_3']
});

// Complete task
await client.tasks.complete('task_456', {
  action: 'complete',
  agentId: 'agent_1',
  agentKey: 'key_xyz',
  completionNotes: 'Task completed successfully',
  timeSpent: 45 // in minutes
});

// Escalate task
await client.tasks.escalate('task_456', {
  action: 'escalate',
  businessId: 'biz_123',
  reason: 'blocking_other_tasks',
  decidedBy: 'openclaw'
});

// Reassign task
await client.tasks.reassign('task_456', {
  action: 'reassign',
  toAgent: 'agent_2',
  reason: 'agent_1_overloaded',
  decidedBy: 'openclaw'
});

// Unblock task
await client.tasks.unblock('task_456', {
  action: 'unblock',
  reason: 'dependency_resolved',
  decidedBy: 'openclaw'
});

// Mark task as executed
await client.tasks.markExecuted('task_456', {
  action: 'mark-executed',
  outcome: 'Successfully deployed to production',
  decidedBy: 'openclaw'
});

// Execute task
await client.tasks.execute({
  taskId: 'task_456',
  goalIds: ['goal_1', 'goal_2'],
  timeout: 300000
});

// Generate daily tasks
await client.tasks.generateDaily({
  businessId: 'biz_123',
  date: '2026-02-19'
});

// Get task calendar events
await client.tasks.getCalendarEvents('task_456');
```

### Epics

```typescript
// List epics
const epics = await client.epics.list('biz_123');
```

### Memory

```typescript
// List memory files
const files = await client.memory.list();

// Get memory file content
const content = await client.memory.getFile('memory/notes.md');

// Search memory
const results = await client.memory.search('deployment process', 10);

// Get context for entity
const context = await client.memory.getContext('deploy-task', 'task');
```

### Reports

```typescript
// Fetch existing report
const report = await client.reports.fetch('strategic-weekly', 7, 2026);

// Generate new report
const generated = await client.reports.generate({
  type: 'strategic-weekly',
  businessId: 'biz_123',
  startDate: '2026-02-12',
  endDate: '2026-02-19'
});
```

### Calendar

```typescript
// List events
const events = await client.calendar.listEvents();

// Get event details
const event = await client.calendar.getEvent('event_123');

// Get available slots
const slots = await client.calendar.getSlots();
```

### Businesses

```typescript
// List businesses
const businesses = await client.businesses.list();
```

### State & Metrics

```typescript
// Get system metrics
const metrics = await client.state.metrics('agent_1');

// Get alerts
const alerts = await client.state.alerts('critical');
```

### Admin

```typescript
// Seed demo goals
await client.admin.seedGoals();

// Clean up demo goals
await client.admin.cleanupGoals();
```

## Error Handling

```typescript
import { getApiClient, ApiError } from '@/lib/api-client';

const client = getApiClient();

try {
  await client.tasks.escalate('task_456', {
    action: 'escalate',
    businessId: 'biz_123',
    reason: 'blocking',
    decidedBy: 'openclaw'
  });
} catch (error) {
  if (error instanceof Error) {
    try {
      const apiError = JSON.parse(error.message) as ApiError;
      console.error('API Error:', apiError.code, apiError.message);
    } catch {
      console.error('Request failed:', error.message);
    }
  }
}
```

## Type Definitions

All types are exported for use in your TypeScript code:

```typescript
import {
  TaskActionRequest,
  TaskActionResponse,
  AgentRegistrationRequest,
  AgentRegistrationResponse,
  EpicsListResponse,
  MemoryListResponse,
  MemoryContextResponse,
  ReportResponse,
  ApiError
} from '@/lib/api-client';
```

## Configuration

### Environment Variables

Set the API base URL via environment variable:

```bash
API_BASE_URL=https://api.example.com
```

Or pass it directly when creating a client:

```typescript
const client = createApiClient('https://api.example.com');
```

### Timeout

Default timeout is 30 seconds. Customize per client:

```typescript
const client = createApiClient({
  baseUrl: 'http://localhost:3000',
  timeout: 60000 // 60 seconds
});
```

### Custom Headers

Add custom headers to all requests:

```typescript
const client = createApiClient({
  baseUrl: 'http://localhost:3000',
  headers: {
    'Authorization': 'Bearer token_123',
    'X-Request-ID': 'unique_id'
  }
});
```

## OpenAPI Specification

The OpenAPI 3.0 specification is available at `/api/openapi` and describes all endpoints in detail. For interactive exploration, visit `/global/api-docs`.

## Migration from Old Endpoints

If migrating from the old non-RESTful endpoints, here are the mappings:

| Old Endpoint | New Endpoint | Migration |
|---|---|---|
| `POST /api/agents/{agentId}/tasks/{taskId}/assign` | `PATCH /api/tasks/{taskId}` | `client.tasks.assign(taskId, { action: 'assign', ... })` |
| `POST /api/agents/{agentId}/tasks/{taskId}/complete` | `PATCH /api/tasks/{taskId}` | `client.tasks.complete(taskId, { action: 'complete', ... })` |
| `GET /api/epics/list` | `GET /api/epics` | `client.epics.list(businessId)` |
| `POST /api/goals/seed-demo` | `POST /api/admin/goals/seed` | `client.admin.seedGoals()` |
| `POST /api/goals/cleanup-demo` | `DELETE /api/admin/goals/demo` | `client.admin.cleanupGoals()` |
| `GET /api/memory/list` | `GET /api/memory` | `client.memory.list()` |
| `POST /api/memory/content` | `GET /api/memory/files` | `client.memory.getFile(path)` |

## Raw HTTP Endpoints Reference

### Wiki Pages

**Create Page (Root or Sub-page)**
```
POST /api/agents/{agentId}/wiki/pages?agentKey={key}&businessId={businessId}
Content-Type: application/json

{
  "title": "Page Title",
  "content": "{...}",        // optional, TipTap JSON format
  "parentId": "pageId",      // optional, for sub-pages
  "emoji": "📄",             // optional
  "status": "draft"          // optional: draft|published|archived
}
```

**List Wiki Pages**
```
GET /api/agents/{agentId}/wiki/pages?agentKey={key}&businessId={businessId}
```

**Get Specific Page**
```
GET /api/agents/{agentId}/wiki/pages/{pageId}?agentKey={key}&businessId={businessId}
```

**Update Page**
```
PATCH /api/agents/{agentId}/wiki/pages/{pageId}?agentKey={key}&businessId={businessId}
Content-Type: application/json

{
  "title": "Updated Title",     // optional
  "content": "{...}",           // optional
  "contentText": "...",         // optional
  "status": "published",        // optional
  "emoji": "📚"                 // optional
}
```

## Contributing

To add new API endpoints:

1. Create route handler in `/src/app/api/...`
2. Follow the agent authentication pattern using `verifyAgent()`
3. Use `jsonResponse()` and `handleApiError()` for consistent response format
4. **Manually update this documentation** with endpoint details and examples
5. Run tests to verify: `npm test`
6. Build to verify: `npm run build`
