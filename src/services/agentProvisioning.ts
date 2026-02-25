import { call } from "./gatewayRpc";
import WebSocket from "ws";

/**
 * Agent Provisioning Service
 *
 * Handles:
 * - Agent registration on gateway (idempotent)
 * - Template file provisioning (IDENTITY.md, SOUL.md, etc.)
 * - Session key generation
 * - Configuration sync
 *
 * Template Variables (simple string interpolation):
 * - agentName, agentId, agentKey
 * - boardId, boardName, businessId
 * - sessionKey, workspacePath
 * - baseUrl, authToken
 * - otherAgents (JSON array)
 */

export interface AgentProvisioningParams {
  gatewayId: string;
  agent: {
    _id: string;
    name: string;
    role: string;
    level?: number;
    isBoardLead?: boolean;
    isGatewayMain?: boolean;
  };
  business: {
    _id: string;
    name: string;
    slug: string;
  };
  otherAgents: Array<{
    _id: string;
    name: string;
    role: string;
  }>;
  baseUrl: string;
  authToken: string;
}

/**
 * Get the session key for an agent
 * Pattern: board-{businessId} for leads, board-agent-{agentId} for members
 */
export function getSessionKey(
  agent: {
    isBoardLead?: boolean;
    isGatewayMain?: boolean;
    _id?: string;
  },
  businessId: string,
  gatewayId?: string
): string {
  if (agent.isGatewayMain && gatewayId) {
    return `gateway-${gatewayId}-main`;
  }
  if (agent.isBoardLead) {
    return `board-lead-${businessId}`;
  }
  return `board-agent-${agent._id}`;
}

/**
 * Get the agent key (internal identifier on gateway)
 * Pattern: mc-{slugified-name}-{agentIdSuffix}
 */
export function getAgentKey(agent: { name: string; _id?: string; isGatewayMain?: boolean }, gatewayId?: string): string {
  if (agent.isGatewayMain && gatewayId) {
    return `mc-gateway-${gatewayId}`;
  }

  const suffix = agent._id ? agent._id.slice(-6) : "unknown";
  const slug = slugify(agent.name);
  return `${slug}-${suffix}`;
}

/**
 * Provision an agent on the gateway
 *
 * Steps:
 * 1. agents.create (idempotent by agentKey)
 * 2. agents.update with name/workspace
 * 3. config.patch to register in main agent list
 * 4. agents.files.list to get current files
 * 5. agents.files.set for each template
 * 6. sessions.patch to label the session
 * 7. chat.send greeting message
 */
export async function provisionAgent(ws: WebSocket, params: AgentProvisioningParams): Promise<void> {
  const { agent, business, otherAgents, baseUrl, authToken } = params;

  const agentKey = getAgentKey(agent, params.gatewayId);
  const sessionKey = getSessionKey(agent, business._id, params.gatewayId);

  // Template variables
  const vars = {
    agentName: agent.name,
    agentId: agent._id,
    agentKey,
    boardId: business._id,
    boardName: business.name,
    businessId: business._id,
    sessionKey,
    workspacePath: `/workspace/${business.slug}/${agent.name}`,
    baseUrl,
    authToken,
    otherAgents: JSON.stringify(otherAgents),
  };

  try {
    // Step 1: Create agent (idempotent)
    await call(ws, "agents.create", {
      name: agentKey,
      workspace: vars.workspacePath,
    });

    // Step 2: Update agent
    await call(ws, "agents.update", {
      agentId: agentKey,
      name: agent.name,
      workspace: vars.workspacePath,
    });

    // Step 3: Register in config
    await call(ws, "config.patch", {
      agents: {
        list: [
          {
            id: agentKey,
            workspace: vars.workspacePath,
            heartbeat: true,
          },
        ],
      },
    });

    // Step 4: Get current files
    const fileList = await call(ws, "agents.files.list", {
      agentId: agentKey,
    });

    // Step 5: Provision template files
    const templates = [
      { name: "IDENTITY.md", content: identityTemplate(vars) },
      { name: "SOUL.md", content: soulTemplate(vars) },
      { name: "BOOTSTRAP.md", content: bootstrapTemplate(vars) },
      { name: "HEARTBEAT.md", content: heartbeatTemplate(vars) },
      { name: "AGENTS.md", content: agentsTemplate(vars) },
    ];

    // Add board-lead-specific templates
    if (agent.isBoardLead) {
      templates.push({ name: "LEAD.md", content: leadTemplate(vars) });
      templates.push({ name: "ROUTING.md", content: routingTemplate(vars) });
      templates.push({ name: "STATUS.md", content: statusTemplate(vars) });
    }

    for (const template of templates) {
      await call(ws, "agents.files.set", {
        agentId: agentKey,
        path: template.name,
        content: template.content,
      });
    }

    // Step 6: Patch session
    await call(ws, "sessions.patch", {
      key: sessionKey,
      label: agent.name,
    });

    // Step 7: Send greeting
    await call(ws, "chat.send", {
      sessionKey,
      message: `Hello ${agent.name}. Your workspace has been provisioned at ${vars.workspacePath}. You are a ${agent.role} on the ${business.name} board.`,
    });
  } catch (error) {
    throw new Error(`Failed to provision agent ${agentKey}: ${(error as Error).message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Template Functions (simple string interpolation)
// ─────────────────────────────────────────────────────────────────────────────

function interpolate(template: string, vars: Record<string, any>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`));
}

function identityTemplate(vars: Record<string, any>): string {
  return interpolate(
    `# Identity: {agentName}

Agent ID: {agentId}
Agent Key: {agentKey}
Board: {boardName} ({boardId})
Role: {agentName}
Session Key: {sessionKey}

## Workspace
Path: {workspacePath}

## Auth
Base URL: {baseUrl}
Token: {authToken}

## Other Board Agents
{otherAgents}
`,
    vars
  );
}

function soulTemplate(vars: Record<string, any>): string {
  return interpolate(
    `# Soul: {agentName}

You are {agentName}, a collaborator on the {boardName} board.

Your purpose is to help orchestrate work, collaborate with other agents,
and contribute to the board's success.

You have access to:
- Task management
- Wiki documentation
- Board chat
- Other agents: {otherAgents}
`,
    vars
  );
}

function bootstrapTemplate(vars: Record<string, any>): string {
  return interpolate(
    `# Bootstrap Instructions

When initializing, complete the following:

1. Load identity from IDENTITY.md
2. Load soul from SOUL.md
3. Initialize session: {sessionKey}
4. Load agents list from AGENTS.md
5. Check workspace at {workspacePath}

All configuration is available via the gateway API.
Auth token: {authToken}
`,
    vars
  );
}

function heartbeatTemplate(vars: Record<string, any>): string {
  return interpolate(
    `# Heartbeat Protocol

Periodically signal health to the board:

GET {baseUrl}/api/agents/{agentId}/heartbeat
Headers:
  Authorization: Bearer {authToken}

Expected response:
  { ok: true, timestamp: number }

If heartbeat fails, reconnect and retry.
`,
    vars
  );
}

function agentsTemplate(vars: Record<string, any>): string {
  return interpolate(
    `# Board Agents

Other agents on this board:

{otherAgents}

You can communicate with them via board chat or direct RPC calls.
`,
    vars
  );
}

function leadTemplate(vars: Record<string, any>): string {
  return interpolate(
    `# Board Lead: {agentName}

You are the board lead. Responsibilities:

1. Route tasks to appropriate agents
2. Monitor board health
3. Escalate blockers
4. Maintain team status

Session key: {sessionKey}
`,
    vars
  );
}

function routingTemplate(vars: Record<string, any>): string {
  return interpolate(
    `# Task Routing Rules

As board lead, route tasks using these rules:

1. By agent expertise (role match)
2. By current workload (least busy)
3. By priority (high priority to seniors)

Available agents:
{otherAgents}
`,
    vars
  );
}

function statusTemplate(vars: Record<string, any>): string {
  return interpolate(
    `# Board Status

Updated at: {now}

Board: {boardName}
Session: {sessionKey}

Current metrics:
- Active agents: {agentCount}
- Pending tasks: {taskCount}
- Health: {health}
`,
    vars
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simple string slugifier
 */
function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 50);
}
