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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 p-6">
            <h1 className="text-lg font-bold text-red-900 dark:text-red-100 mb-2">
              Access Required
            </h1>
            <p className="text-red-800 dark:text-red-200">
              This page requires both an agent ID and API key in the URL parameters. These should
              be provided after agent registration:
            </p>
            <code className="block mt-4 p-3 bg-red-100 dark:bg-red-900 rounded font-mono text-sm">
              /agent/keys?agentId=YOUR_AGENT_ID&key=YOUR_API_KEY
            </code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            API Key Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your Mission Control API key securely
          </p>
        </div>

        {/* Key Management Component */}
        <AgentKeyManagement agentId={agentId} currentApiKey={apiKey} />

        {/* Help Section */}
        <div className="mt-12 rounded-lg border border-gray-200 dark:border-gray-700 p-6 bg-white dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Common Tasks
          </h2>
          <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <li className="flex gap-3">
              <span className="text-blue-600 dark:text-blue-400">→</span>
              <span>
                <strong>View your key:</strong> Click the eye icon to show/hide your API key
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-blue-600 dark:text-blue-400">→</span>
              <span>
                <strong>Copy to clipboard:</strong> Click the copy icon to copy your key
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-blue-600 dark:text-blue-400">→</span>
              <span>
                <strong>Rotate your key:</strong> Generate a new key with a grace period for
                in-flight requests
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-blue-600 dark:text-blue-400">→</span>
              <span>
                <strong>Rate limiting:</strong> You can rotate your key 3 times per hour
              </span>
            </li>
          </ul>
        </div>

        {/* API Reference */}
        <div className="mt-8 rounded-lg border border-gray-200 dark:border-gray-700 p-6 bg-white dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            API Reference
          </h2>
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-mono font-bold text-blue-600 dark:text-blue-400 mb-1">
                POST /api/agents/&#123;agentId&#125;/rotate-key
              </p>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                Rotate your API key securely. Returns a new key that takes effect immediately.
              </p>
              <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded overflow-x-auto text-xs">
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
