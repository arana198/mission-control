/**
 * Agent Key Management Dashboard
 * Allows agents to view, rotate, and manage their API keys
 */

"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Copy, Eye, EyeOff, RotateCcw, AlertTriangle, CheckCircle } from "lucide-react";

interface RotateKeyResponse {
  success: boolean;
  data?: {
    newApiKey: string;
    rotatedAt: number;
    oldKeyExpiresAt: number;
    gracePeriodSeconds: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

interface KeyManagementProps {
  agentId: string;
  currentApiKey: string;
}

export function AgentKeyManagement({ agentId, currentApiKey }: KeyManagementProps) {
  const [showKey, setShowKey] = useState(false);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [rotationReason, setRotationReason] = useState<
    "scheduled" | "compromised" | "deployment" | "refresh"
  >("refresh");
  const [gracePeriod, setGracePeriod] = useState(0);
  const [rotationResult, setRotationResult] = useState<RotateKeyResponse | null>(null);

  // Fetch agent details (for rotation history, etc.)
  const agent = useQuery(api.agents.getAgentById, { agentId: agentId as any });

  const handleCopyKey = async () => {
    await navigator.clipboard.writeText(currentApiKey);
    setCopiedToClipboard(true);
    setTimeout(() => setCopiedToClipboard(false), 2000);
  };

  const handleRotateKey = async () => {
    setIsRotating(true);
    try {
      const response = await fetch(`/api/agents/${agentId}/rotate-key`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentApiKey}`,
        },
        body: JSON.stringify({
          reason: rotationReason,
          gracePeriodSeconds: gracePeriod,
        }),
      });

      const data = (await response.json()) as RotateKeyResponse;
      setRotationResult(data);

      if (data.success) {
        // In production, you'd refresh the agent data here
        // to get the new key and update the UI
      }
    } catch (error) {
      setRotationResult({
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message: `Failed to rotate key: ${error instanceof Error ? error.message : "Unknown error"}`,
        },
      });
    } finally {
      setIsRotating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Current API Key Section */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            Current API Key
            <span className="text-sm font-normal px-2 py-1 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
              Active
            </span>
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Use this key to authenticate with the Mission Control API. Keep it secure.
          </p>
        </div>
        <div className="px-6 py-4 space-y-4">
          {/* Key Display */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              API Key
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3">
              <code className="flex-1 font-mono text-sm text-gray-700 dark:text-gray-300">
                {showKey ? currentApiKey : "•".repeat(32)}
              </code>
              <button
                onClick={() => setShowKey(!showKey)}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title={showKey ? "Hide key" : "Show key"}
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                )}
              </button>
              <button
                onClick={handleCopyKey}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title={copiedToClipboard ? "Copied!" : "Copy to clipboard"}
              >
                {copiedToClipboard ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Rotate your key regularly for security
            </p>
          </div>

          {/* Security Info */}
          <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 p-3 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Never share your API key in public repositories or with untrusted parties.
            </p>
          </div>

          {/* Rotation History (if available) */}
          {agent && agent.lastKeyRotationAt && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-sm bg-gray-50 dark:bg-gray-900">
              <p className="font-medium text-gray-700 dark:text-gray-300">Last Rotation</p>
              <p className="text-gray-600 dark:text-gray-400">
                {new Date(agent.lastKeyRotationAt).toLocaleString()}
              </p>
              {agent.keyRotationCount && (
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  Total rotations: {agent.keyRotationCount}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Key Rotation Section */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Rotate API Key
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Generate a new API key. The old key will expire after the grace period.
          </p>
        </div>
        <div className="px-6 py-4 space-y-4">
          {/* Rotation Reason */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Reason for Rotation
            </label>
            <select
              value={rotationReason}
              onChange={(e) =>
                setRotationReason(
                  e.target.value as "scheduled" | "compromised" | "deployment" | "refresh"
                )
              }
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"
            >
              <option value="refresh">Regular Refresh</option>
              <option value="scheduled">Scheduled Rotation</option>
              <option value="deployment">New Deployment</option>
              <option value="compromised">Key Compromised (Emergency)</option>
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              This helps track rotation patterns and security incidents
            </p>
          </div>

          {/* Grace Period */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Grace Period
            </label>
            <select
              value={gracePeriod.toString()}
              onChange={(e) => setGracePeriod(parseInt(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"
            >
              <option value="0">Immediate (0 seconds)</option>
              <option value="30">30 seconds</option>
              <option value="60">1 minute</option>
              <option value="120">2 minutes</option>
              <option value="300">5 minutes</option>
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Time window for old key to remain valid during transition
            </p>
          </div>

          {/* Rotation Status */}
          {rotationResult && (
            <div
              className={`rounded-lg border p-3 flex gap-3 ${
                rotationResult.success
                  ? "border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950"
                  : "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950"
              }`}
            >
              {rotationResult.success ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-green-800 dark:text-green-200">
                    {rotationResult.data && (
                      <div className="space-y-1">
                        <p className="font-medium">Key rotated successfully!</p>
                        <p className="text-sm">
                          Old key expires in {rotationResult.data.gracePeriodSeconds} seconds
                        </p>
                        <p className="text-sm font-mono text-xs break-all bg-green-100 dark:bg-green-900 p-2 rounded mt-1">
                          {rotationResult.data.newApiKey}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-800 dark:text-red-200">
                    <p className="font-medium">{rotationResult.error?.code}</p>
                    <p className="text-sm">{rotationResult.error?.message}</p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Rotation Button */}
          <button
            onClick={handleRotateKey}
            disabled={isRotating}
            className="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isRotating ? (
              <>
                <RotateCcw className="h-4 w-4 animate-spin" />
                Rotating Key...
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4" />
                Rotate API Key
              </>
            )}
          </button>
        </div>
      </div>

      {/* Rate Limiting Notice */}
      <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950 p-3 flex gap-3">
        <AlertTriangle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 dark:text-blue-200">
          You can rotate your key maximum 3 times per hour. Exceeding this limit will temporarily
          block key rotation requests.
        </p>
      </div>
    </div>
  );
}
