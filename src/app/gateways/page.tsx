"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useBusiness } from "@/components/BusinessProvider";
import { GatewayForm } from "@/components/GatewayForm";
import { GatewaySessionsPanel } from "@/components/GatewaySessionsPanel";
import { useGatewaySessions } from "@/hooks/useGatewaySessions";
import { Plus, Trash2, Activity } from "lucide-react";

/**
 * Gateway Sessions Panel with Hook
 * Wraps GatewaySessionsPanel with useGatewaySessions hook
 */
function GatewaySessionsPanelWithHook({ gatewayId }: { gatewayId: string }) {
  const { sessions, isLoading, error, sendMessage, fetchHistory } =
    useGatewaySessions(gatewayId);

  return (
    <div className="p-6">
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-400">
            <div className="animate-spin inline-block mr-2">⟳</div>
            Loading sessions...
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded p-4 text-red-300 text-sm">
          Error: {error}
        </div>
      )}

      {!isLoading && !error && (
        <GatewaySessionsPanel
          gatewayId={gatewayId}
          sessions={sessions}
          onSendMessage={sendMessage}
        />
      )}
    </div>
  );
}

/**
 * Gateways Admin Page
 * URL: /gateways
 * Lists all gateways with health status and controls
 * Phase 4: Gateways UI Integration
 */
export default function GatewaysPage() {
  const { currentBusiness } = useBusiness();
  const [showForm, setShowForm] = useState(false);
  const [selectedGatewayId, setSelectedGatewayId] = useState<string | null>(null);

  // Queries
  const gateways = useQuery(
    api.gateways.getByBusiness,
    currentBusiness ? { businessId: currentBusiness._id as any } : "skip"
  );

  // Mutations
  const deleteGateway = useMutation(api.gateways.deleteGateway);

  const handleDeleteGateway = async (gatewayId: string) => {
    if (confirm("Delete this gateway? This action cannot be undone.")) {
      try {
        await deleteGateway({ gatewayId: gatewayId as any });
        if (selectedGatewayId === gatewayId) {
          setSelectedGatewayId(null);
        }
      } catch (error) {
        console.error("Failed to delete gateway:", error);
      }
    }
  };

  const getHealthBadge = (isHealthy?: boolean) => {
    if (isHealthy === undefined)
      return (
        <span className="px-2 py-1 bg-slate-700 text-gray-300 text-xs rounded">
          Unknown
        </span>
      );
    return isHealthy ? (
      <span className="px-2 py-1 bg-green-900/30 text-green-300 text-xs rounded">
        🟢 Healthy
      </span>
    ) : (
      <span className="px-2 py-1 bg-red-900/30 text-red-300 text-xs rounded">
        🔴 Unhealthy
      </span>
    );
  };

  if (!currentBusiness) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="bg-slate-800 rounded p-4 border border-slate-700 text-center text-gray-400">
          No business selected
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white">🌐 Gateways</h2>
          <p className="text-sm text-gray-400 mt-1">
            Manage distributed runtime connections
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-2 font-medium transition-colors"
        >
          <Plus size={18} />
          New Gateway
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Create New Gateway</h3>
          <GatewayForm
            businessId={currentBusiness._id as any}
            onClose={() => setShowForm(false)}
            onSuccess={() => {
              setShowForm(false);
            }}
          />
        </div>
      )}

      {/* Gateway List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 border border-slate-700 rounded-lg bg-slate-900 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-700">
            <h3 className="font-semibold text-white">Gateways</h3>
            <p className="text-sm text-gray-400">
              {gateways?.length || 0} configured
            </p>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-700">
            {!gateways || gateways.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">
                No gateways configured yet
              </div>
            ) : (
              gateways.map((gateway) => (
                <button
                  key={gateway._id}
                  onClick={() => setSelectedGatewayId(gateway._id)}
                  className={`w-full text-left p-4 transition-colors ${
                    selectedGatewayId === gateway._id
                      ? "bg-blue-600"
                      : "hover:bg-slate-800"
                  }`}
                >
                  <div className="font-medium text-white mb-2">{gateway.name}</div>
                  <div className="text-xs text-gray-400 truncate mb-2">
                    {gateway.url}
                  </div>
                  <div className="flex items-center justify-between">
                    {getHealthBadge(gateway.isHealthy)}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteGateway(gateway._id);
                      }}
                      className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                      title="Delete gateway"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Detail View */}
        <div className="lg:col-span-2 border border-slate-700 rounded-lg bg-slate-900">
          {selectedGatewayId && gateways ? (
            <GatewaySessionsPanelWithHook
              gatewayId={selectedGatewayId}
            />
          ) : (
            <div className="h-full flex items-center justify-center p-8">
              <p className="text-gray-400 text-center">
                Select a gateway to view details and manage sessions
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
          <h3 className="font-semibold text-white mb-2">📋 Features</h3>
          <ul className="text-sm text-gray-400 space-y-1">
            <li>✓ WebSocket connection management</li>
            <li>✓ Health monitoring</li>
            <li>✓ Agent provisioning</li>
            <li>✓ Template sync</li>
          </ul>
        </div>

        <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
          <h3 className="font-semibold text-white mb-2">🔧 Configuration</h3>
          <ul className="text-sm text-gray-400 space-y-1">
            <li>• WebSocket URL (ws:// or wss://)</li>
            <li>• Optional auth token</li>
            <li>• Workspace root path</li>
            <li>• TLS settings</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
