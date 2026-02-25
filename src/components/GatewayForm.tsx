"use client";

import React, { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Save, X, Eye, EyeOff, Check, AlertCircle, Loader2 } from "lucide-react";

/**
 * Gateway Form Component
 * Phase 5: Create/edit gateway configurations with connection validation
 */
interface GatewayFormProps {
  businessId: Id<"businesses">;
  gateway?: {
    _id: Id<"gateways">;
    name: string;
    url: string;
    token?: string;
    workspaceRoot: string;
    disableDevicePairing: boolean;
    allowInsecureTls: boolean;
  };
  onClose: () => void;
  onSuccess?: () => void;
}

export function GatewayForm({ businessId, gateway, onClose, onSuccess }: GatewayFormProps) {
  const isEditMode = !!gateway;

  const [formData, setFormData] = useState({
    name: gateway?.name ?? "",
    url: gateway?.url ?? "wss://",
    token: "",
    workspaceRoot: gateway?.workspaceRoot ?? "/workspace",
    disableDevicePairing: gateway?.disableDevicePairing ?? false,
    allowInsecureTls: gateway?.allowInsecureTls ?? false,
  });

  const [error, setError] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testConnectionResult, setTestConnectionResult] = useState<{
    success: boolean;
    latencyMs?: number;
    error?: string;
  } | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const createGateway = useMutation(api.gateways.createGateway);
  const updateGateway = useMutation(api.gateways.updateGateway);

  const handleTestConnection = async () => {
    if (!formData.url) {
      setError("Please enter a WebSocket URL first");
      return;
    }

    setIsTestingConnection(true);
    setTestConnectionResult(null);

    try {
      const gatewayId = gateway?._id || "temp";
      const response = await fetch(`/api/gateway/${gatewayId}?action=validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: formData.url,
          allowInsecureTls: formData.allowInsecureTls,
        }),
      });

      const result = await response.json();
      setTestConnectionResult(result);
    } catch (err) {
      setTestConnectionResult({
        success: false,
        error: (err as Error).message,
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    // Validate
    if (!formData.name) {
      setError("Gateway name is required");
      setIsSubmitting(false);
      return;
    }
    if (!formData.url.startsWith("ws://") && !formData.url.startsWith("wss://")) {
      setError("URL must start with ws:// or wss://");
      setIsSubmitting(false);
      return;
    }

    try {
      if (isEditMode && gateway) {
        await updateGateway({
          gatewayId: gateway._id,
          name: formData.name,
          url: formData.url,
          token: formData.token || undefined,
          workspaceRoot: formData.workspaceRoot,
          disableDevicePairing: formData.disableDevicePairing,
          allowInsecureTls: formData.allowInsecureTls,
        } as any);
      } else {
        await createGateway({
          businessId,
          name: formData.name,
          url: formData.url,
          token: formData.token || undefined,
          workspaceRoot: formData.workspaceRoot,
          disableDevicePairing: formData.disableDevicePairing,
          allowInsecureTls: formData.allowInsecureTls,
        });
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-destructive/20 border border-destructive/70 rounded p-3 text-destructive/70 text-sm">
          {error}
        </div>
      )}

      {/* Gateway Name */}
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">Gateway Name *</label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="e.g., Production Gateway"
          className="w-full px-3 py-2 bg-card border border-border rounded text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
        />
      </div>

      {/* WebSocket URL */}
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">WebSocket URL *</label>
        <input
          type="text"
          name="url"
          value={formData.url}
          onChange={handleChange}
          placeholder="wss://gateway.example.com:443"
          className="w-full px-3 py-2 bg-card border border-border rounded text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground mt-1">Must start with ws:// or wss://</p>
      </div>

      {/* Auth Token */}
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">Auth Token (Optional)</label>
        <div className="flex gap-2">
          <input
            type={showToken ? "text" : "password"}
            name="token"
            value={isEditMode && gateway?.token && !formData.token ? "••••••••" : formData.token}
            onChange={handleChange}
            placeholder="Leave empty if no auth required"
            className="flex-1 px-3 py-2 bg-card border border-border rounded text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={() => setShowToken(!showToken)}
            aria-label="Toggle token visibility"
            className="px-3 py-2 bg-muted hover:bg-muted/80 rounded text-muted-foreground hover:text-foreground transition-colors"
          >
            {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      {/* Workspace Root */}
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">Workspace Root *</label>
        <input
          type="text"
          name="workspaceRoot"
          value={formData.workspaceRoot}
          onChange={handleChange}
          placeholder="/workspace"
          className="w-full px-3 py-2 bg-card border border-border rounded text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary font-mono text-sm"
        />
      </div>

      {/* Options */}
      <div className="space-y-2 pt-2 border-t border-border">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="disableDevicePairing"
            checked={formData.disableDevicePairing}
            onChange={handleChange}
            className="w-4 h-4 rounded border-border bg-card"
          />
          <span className="text-sm text-muted-foreground">Disable Device Pairing (connect as control_ui mode)</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="allowInsecureTls"
            checked={formData.allowInsecureTls}
            onChange={handleChange}
            className="w-4 h-4 rounded border-border bg-card"
          />
          <span className="text-sm text-muted-foreground">Allow Insecure TLS (for self-signed certs)</span>
        </label>
      </div>

      {/* Test Connection Result */}
      {testConnectionResult && (
        <div className={`p-3 rounded border flex items-center gap-2 ${
          testConnectionResult.success
            ? "bg-success/20 border-success/70 text-success/70"
            : "bg-destructive/20 border-destructive/70 text-destructive/70"
        }`}>
          {testConnectionResult.success ? (
            <>
              <Check size={16} />
              <span className="text-sm">✓ Connected ({testConnectionResult.latencyMs}ms)</span>
            </>
          ) : (
            <>
              <AlertCircle size={16} />
              <span className="text-sm">✗ {testConnectionResult.error}</span>
            </>
          )}
        </div>
      )}

      {/* Test Connection Button */}
      <div className="pt-2 pb-2 border-b border-border">
        <button
          type="button"
          onClick={handleTestConnection}
          disabled={isTestingConnection || isSubmitting}
          className="w-full flex items-center justify-center gap-2 bg-muted hover:bg-muted/80 disabled:bg-muted/50 disabled:opacity-50 text-foreground rounded px-4 py-2 font-medium transition-colors"
        >
          {isTestingConnection ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Testing Connection...
            </>
          ) : (
            "Test Connection"
          )}
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t border-border">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 flex items-center justify-center gap-2 bg-success hover:bg-success/90 disabled:bg-success/80 disabled:opacity-50 text-success-foreground rounded px-4 py-2 font-medium transition-colors"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              {isEditMode ? "Saving..." : "Creating..."}
            </>
          ) : (
            <>
              <Save size={18} />
              {isEditMode ? "Save Changes" : "Create Gateway"}
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="flex-1 flex items-center justify-center gap-2 bg-muted hover:bg-muted/80 disabled:bg-muted/50 disabled:opacity-50 text-foreground rounded px-4 py-2 font-medium transition-colors"
        >
          <X size={18} />
          Cancel
        </button>
      </div>
    </form>
  );
}
