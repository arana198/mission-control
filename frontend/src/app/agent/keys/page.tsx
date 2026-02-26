/**
 * Agent API Key Management Page
 * Allows authenticated agents to manage their API keys
 */

import { Metadata } from "next";
import { AgentKeyManagement } from "@/components/agent/AgentKeyManagement";

export const metadata: Metadata = {
  title: "API Key Management | Mission Control",
  description: "View and manage your API key for Mission Control integration",
};

interface PageProps {
  searchParams: Promise<{
    agentId?: string;
    key?: string;
  }>;
}

export default async function KeyManagementPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const agentId = params.agentId;
  const apiKey = params.key;

  if (!agentId || !apiKey) {
    return (
      <div className="min-h-screen bg-muted py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6">
            <h1 className="text-lg font-bold text-destructive mb-2">
              Access Required
            </h1>
            <p className="text-destructive">
              This page requires both an agent ID and API key in the URL parameters. These should
              be provided after agent registration:
            </p>
            <code className="block mt-4 p-3 bg-destructive/10 rounded font-mono text-sm">
              /agent/keys?agentId=YOUR_AGENT_ID&key=YOUR_API_KEY
            </code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            API Key Management
          </h1>
          <p className="text-muted-foreground">
            Manage your Mission Control API key securely
          </p>
        </div>

        {/* Key Management Component */}
        <AgentKeyManagement agentId={agentId} currentApiKey={apiKey} />

        {/* Help Section */}
        <div className="mt-12 rounded-lg border border-border p-6 bg-card">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Common Tasks
          </h2>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <span className="text-primary">→</span>
              <span>
                <strong>View your key:</strong> Click the eye icon to show/hide your API key
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-primary">→</span>
              <span>
                <strong>Copy to clipboard:</strong> Click the copy icon to copy your key
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-primary">→</span>
              <span>
                <strong>Rotate your key:</strong> Generate a new key with a grace period for
                in-flight requests
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-primary">→</span>
              <span>
                <strong>Rate limiting:</strong> You can rotate your key 3 times per hour
              </span>
            </li>
          </ul>
        </div>

        {/* API Reference */}
        <div className="mt-8 rounded-lg border border-border p-6 bg-card">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            API Reference
          </h2>
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-mono font-bold text-primary mb-1">
                POST /api/agents/&#123;agentId&#125;/rotate-key
              </p>
              <p className="text-muted-foreground mb-2">
                Rotate your API key securely. Returns a new key that takes effect immediately.
              </p>
              <pre className="bg-muted p-3 rounded overflow-x-auto text-xs">
{`{
  "reason": "scheduled|compromised|deployment|refresh",
  "gracePeriodSeconds": 0-300
}`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
