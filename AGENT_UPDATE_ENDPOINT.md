# Agent Update Endpoint

## Overview

The Agent Update endpoint allows agents to self-service update their own details, including workspace paths and configuration.

**Endpoint:** `PUT /api/agents/{agentId}/update`

## Authentication

The endpoint requires agent authentication via API key:

```bash
# Method 1: Bearer token in Authorization header
curl -X PUT http://localhost:3000/api/agents/AGENT_ID/update \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"workspacePath": "/new/path"}'

# Method 2: API key in request body
curl -X PUT http://localhost:3000/api/agents/AGENT_ID/update \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "YOUR_API_KEY",
    "workspacePath": "/new/path"
  }'
```

## Request Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agentId` | string | Yes (URL) | The agent's Convex ID (from URL path) |
| `apiKey` | string | Yes | Agent's API key for authentication |
| `workspacePath` | string | No | Path to agent's workspace directory |
| `model` | string | No | LLM model identifier (max 100 chars) |
| `personality` | string | No | Agent personality description (max 2000 chars) |
| `capabilities` | array | No | List of capability strings (each max 100 chars) |

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "agentId": "agent123",
    "agentName": "monica-gellar",
    "updated": true,
    "updatedFields": ["workspacePath", "model"],
    "agent": {
      "name": "monica-gellar",
      "role": "Project Manager",
      "level": "specialist",
      "workspacePath": "/Users/arana/.openclaw/workspace",
      "model": "gpt-4-turbo",
      "personality": "Professional and detail-oriented",
      "capabilities": ["project-management", "stakeholder-communication"],
      "status": "idle"
    }
  }
}
```

### Error Responses

#### Authentication Error (401 Unauthorized)

```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_ERROR",
    "message": "Invalid API key or agent ID"
  }
}
```

#### Validation Error (400 Bad Request)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [
      {
        "code": "too_long",
        "maximum": 100,
        "type": "string",
        "path": ["model"],
        "message": "String must contain at most 100 character(s)"
      }
    ]
  }
}
```

#### Not Found (404)

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Agent not found"
  }
}
```

## Usage Examples

### Update Workspace Path

```bash
curl -X PUT http://localhost:3000/api/agents/jd78k6hdfmhr3wgd5a31pg7a6h81frer/update \
  -H "Authorization: Bearer your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "workspacePath": "/Users/arana/.openclaw/workspace"
  }'
```

### Update Model and Personality

```bash
curl -X PUT http://localhost:3000/api/agents/jd78k6hdfmhr3wgd5a31pg7a6h81frer/update \
  -H "Authorization: Bearer your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4-turbo",
    "personality": "Professional, detail-oriented, excellent communicator"
  }'
```

### Update Capabilities

```bash
curl -X PUT http://localhost:3000/api/agents/jd78k6hdfmhr3wgd5a31pg7a6h81frer/update \
  -H "Authorization: Bearer your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "capabilities": [
      "project-management",
      "stakeholder-communication",
      "risk-assessment",
      "timeline-planning"
    ]
  }'
```

### Update Multiple Fields

```bash
curl -X PUT http://localhost:3000/api/agents/jd78k6hdfmhr3wgd5a31pg7a6h81frer/update \
  -H "Authorization: Bearer your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "workspacePath": "/Users/arana/.openclaw/workspace",
    "model": "gpt-4-turbo",
    "personality": "Professional and detail-oriented",
    "capabilities": ["project-management", "communication"]
  }'
```

## TypeScript/JavaScript Usage

```typescript
// Using fetch
const response = await fetch(
  `http://localhost:3000/api/agents/${agentId}/update`,
  {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      workspacePath: '/new/workspace/path',
      model: 'gpt-4-turbo',
      capabilities: ['task1', 'task2']
    })
  }
);

const data = await response.json();
if (data.success) {
  console.log('Agent updated:', data.data.agent);
} else {
  console.error('Update failed:', data.error);
}
```

## Partial Updates

The endpoint supports partial updates - you only need to provide the fields you want to change:

```bash
# Only update workspace path (other fields unchanged)
curl -X PUT http://localhost:3000/api/agents/AGENT_ID/update \
  -H "Authorization: Bearer API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"workspacePath": "/new/path"}'
```

The response will indicate which fields were updated in the `updatedFields` array.

## Field Constraints

### Workspace Path
- **Required:** Yes (when updating)
- **Type:** String
- **Min length:** 1 character
- **Example:** `/Users/arana/.openclaw/workspace`

### Model
- **Required:** No
- **Type:** String
- **Max length:** 100 characters
- **Example:** `gpt-4-turbo`, `claude-3-sonnet`, `gemini-pro`

### Personality
- **Required:** No
- **Type:** String
- **Max length:** 2000 characters
- **Example:** `"Professional, detail-oriented developer with 10+ years experience"`

### Capabilities
- **Required:** No
- **Type:** Array of strings
- **Items max length:** 100 characters each
- **Example:** `["python", "typescript", "system-design"]`

## Error Handling

### Common Errors

1. **Invalid API Key**: Returns 401 Unauthorized
   - Verify the API key is correct
   - Check that it matches the agent's stored key

2. **Agent Not Found**: Returns 404 Not Found
   - Verify the agent ID is correct
   - Ensure the agent exists in the database

3. **Validation Error**: Returns 400 Bad Request
   - Check field lengths and formats
   - Ensure required fields are provided

## Security

- API keys are required for all updates
- Agents can only update their own details (enforced via API key verification)
- All inputs are validated before processing
- Updates are logged for audit purposes

## Related Endpoints

- `POST /api/agents/register` - Initial agent registration
- `GET /api/agents/list` - List all agents
- `POST /api/admin/agents/setup-workspace` - Admin endpoint to configure workspace paths
- `GET /api/agents/workspace/structure` - View agent's workspace files

## Notes

- Updates are applied immediately
- Partial updates don't affect unmodified fields
- The response includes the complete updated agent object
- API calls are logged for debugging and monitoring
