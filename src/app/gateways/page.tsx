"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useBusiness } from "@/components/BusinessProvider";
import { GatewayForm } from "@/components/GatewayForm";
import { GatewaySessionsPanel } from "@/components/GatewaySessionsPanel";
import { GatewayHealthBadge } from "@/components/GatewayHealthBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useGatewaySessions } from "@/hooks/useGatewaySessions";
import { useGatewayHealth } from "@/hooks/useGatewayHealth";
import { usePageActive } from "@/hooks/usePageActive";
import { useRole } from "@/hooks/useRole";
import { useNotification } from "@/hooks/useNotification";
import { Plus, Trash2, Edit2, Lock } from "lucide-react";

/**
 * Gateway Sessions Panel with Hook
 * Wraps GatewaySessionsPanel with useGatewaySessions and useGatewayHealth hooks
 */
function GatewaySessionsPanelWithHook({
  gatewayId,
  isPageActive
}: {
  gatewayId: string;
  isPageActive: boolean;
}) {
  const { sessions, isLoading, error, sendMessage, fetchHistory, refresh } =
    useGatewaySessions(gatewayId, isPageActive);

  const { isHealthy, lastChecked } = useGatewayHealth(gatewayId, isPageActive);

  return (
    <div className="p-6">
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">
            <div className="animate-spin inline-block mr-2">⟳</div>
            Loading sessions...
          </div>
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded p-4 text-destructive text-sm">
          Error: {error}
        </div>
      )}

      {!isLoading && !error && (
        <GatewaySessionsPanel
          gatewayId={gatewayId}
          sessions={sessions}
          isLoading={isLoading}
          error={error}
          isHealthy={isHealthy}
          lastHealthCheck={lastChecked}
          onSendMessage={sendMessage}
          onFetchHistory={fetchHistory}
          onRefresh={refresh}
        />
      )}
    </div>
  );
}

/**
 * Gateways Admin Page
 * URL: /gateways
 * Lists all gateways with live health status and session management
 * Phase 4: Complete UI Integration with polling and page visibility detection
 */
export default function GatewaysPage() {
  const { currentBusiness } = useBusiness();
  const { isAdmin, isLoading: roleLoading } = useRole(
    currentBusiness?._id as any
  );
  const notif = useNotification();
  const [showForm, setShowForm] = useState(false);
  const [selectedGatewayId, setSelectedGatewayId] = useState<string | null>(null);
  const [editGatewayId, setEditGatewayId] = useState<string | null>(null);
  const [deleteConfirmGatewayId, setDeleteConfirmGatewayId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sortOrder, setSortOrder] = useState<"name" | "health" | "recent">("name");

  // Detect if page is active (visible/focused) to pause polling
  const { isActive } = usePageActive();

  // Queries
  const gateways = useQuery(
    api.gateways.getByBusiness,
    currentBusiness ? { businessId: currentBusiness._id as any } : "skip"
  );

  const editingGateway = useQuery(
    api.gateways.getById,
    editGatewayId ? { gatewayId: editGatewayId as any } : "skip"
  );

  // Mutations
  const deleteGateway = useMutation(api.gateways.deleteGateway);

  const handleDeleteGateway = async () => {
    if (!deleteConfirmGatewayId) return;

    setIsDeleting(true);
    try {
      await deleteGateway({ gatewayId: deleteConfirmGatewayId as any });
      if (selectedGatewayId === deleteConfirmGatewayId) {
        setSelectedGatewayId(null);
      }
      setDeleteConfirmGatewayId(null);
      notif.success("Gateway deleted");
    } catch (error) {
      console.error("Failed to delete gateway:", error);
      notif.error(
        error instanceof Error ? error.message : "Failed to delete gateway"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (!currentBusiness) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="bg-muted rounded p-4 border border-border text-center text-muted-foreground">
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
          <h2 className="text-3xl font-bold text-foreground">🌐 Gateways</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage distributed runtime connections
          </p>
          {!roleLoading && !isAdmin && (
            <div className="flex items-center gap-1 mt-2 text-xs text-warning">
              <Lock size={14} />
              <span>Read-only</span>
            </div>
          )}
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded px-4 py-2 font-medium transition-colors"
          >
            <Plus size={18} />
            New Gateway
          </button>
        )}
      </div>

      {/* Create Form */}
      {showForm && isAdmin && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Create New Gateway</h3>
          <GatewayForm
            businessId={currentBusiness._id as any}
            onClose={() => setShowForm(false)}
            onSuccess={() => {
              setShowForm(false);
              notif.success("Gateway created");
            }}
          />
        </div>
      )}

      {/* Gateway List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 border border-border rounded-lg bg-card overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-foreground">Gateways</h3>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                className="px-2 py-1 bg-muted border border-border rounded text-xs text-foreground focus:outline-none focus:border-primary"
              >
                <option value="name">Name (A-Z)</option>
                <option value="health">Health</option>
                <option value="recent">Recent</option>
              </select>
            </div>
            <p className="text-sm text-muted-foreground">
              {gateways?.length || 0} configured
            </p>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {!gateways || gateways.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                No gateways configured yet
              </div>
            ) : (
              (() => {
                let sortedGateways = [...gateways];

                if (sortOrder === "name") {
                  sortedGateways.sort((a, b) => a.name.localeCompare(b.name));
                } else if (sortOrder === "health") {
                  sortedGateways.sort((a, b) => {
                    const aHealthy = a.isHealthy === true ? 0 : a.isHealthy === false ? 2 : 1;
                    const bHealthy = b.isHealthy === true ? 0 : b.isHealthy === false ? 2 : 1;
                    return aHealthy - bHealthy;
                  });
                } else if (sortOrder === "recent") {
                  sortedGateways.sort((a, b) => b._creationTime - a._creationTime);
                }

                return sortedGateways.map((gateway) => (
                <button
                  key={gateway._id}
                  onClick={() => setSelectedGatewayId(gateway._id)}
                  className={`w-full text-left p-4 transition-colors ${
                    selectedGatewayId === gateway._id
                      ? "bg-primary"
                      : "hover:bg-muted"
                  }`}
                >
                  <div className="font-medium text-foreground mb-2">{gateway.name}</div>
                  <div className="text-xs text-muted-foreground truncate mb-2">
                    {gateway.url}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <GatewayHealthBadge
                      gatewayId={gateway._id}
                      isActive={isActive}
                    />
                    {isAdmin && (
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditGatewayId(gateway._id);
                          }}
                          className="p-1 text-primary hover:text-primary/80 hover:bg-primary/20 rounded transition-colors"
                          title="Edit gateway"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmGatewayId(gateway._id);
                          }}
                          className="p-1 text-destructive hover:text-destructive/80 hover:bg-destructive/20 rounded transition-colors"
                          title="Delete gateway"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </button>
              ));
              })()
            )}
          </div>
        </div>

        {/* Detail View */}
        <div className="lg:col-span-2 border border-border rounded-lg bg-card">
          {selectedGatewayId && gateways ? (
            <GatewaySessionsPanelWithHook
              gatewayId={selectedGatewayId}
              isPageActive={isActive}
            />
          ) : (
            <div className="h-full flex items-center justify-center p-8">
              <p className="text-muted-foreground text-center">
                Select a gateway to view details and manage sessions
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg p-6 border border-border">
          <h3 className="font-semibold text-foreground mb-2">📋 Features</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>✓ WebSocket connection management</li>
            <li>✓ Health monitoring</li>
            <li>✓ Agent provisioning</li>
            <li>✓ Template sync</li>
          </ul>
        </div>

        <div className="bg-card rounded-lg p-6 border border-border">
          <h3 className="font-semibold text-foreground mb-2">🔧 Configuration</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• WebSocket URL (ws:// or wss://)</li>
            <li>• Optional auth token</li>
            <li>• Workspace root path</li>
            <li>• TLS settings</li>
          </ul>
        </div>
      </div>

      {/* Edit Gateway Modal */}
      {editGatewayId && editingGateway && (
        <div className="fixed inset-0 bg-overlay/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-lg max-w-lg w-full p-6 border border-border">
            <h2 className="text-xl font-semibold text-foreground mb-4">Edit Gateway</h2>
            <GatewayForm
              businessId={currentBusiness!._id as any}
              gateway={editingGateway}
              onClose={() => setEditGatewayId(null)}
              onSuccess={() => {
                setEditGatewayId(null);
                notif.success("Gateway updated");
              }}
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmGatewayId && (
        <ConfirmDialog
          title="Delete Gateway?"
          description="This gateway and all its associated sessions will be permanently deleted. This action cannot be undone."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="destructive"
          isLoading={isDeleting}
          onConfirm={handleDeleteGateway}
          onCancel={() => setDeleteConfirmGatewayId(null)}
        />
      )}
    </div>
  );
}
