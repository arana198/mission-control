"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Save, X } from "lucide-react";

/**
 * Gateway Form Component
 * Phase 4 UI: Create/edit gateway configurations
 */
interface GatewayFormProps {
  businessId: Id<"businesses">;
  onClose: () => void;
  onSuccess?: () => void;
}

export function GatewayForm({ businessId, onClose, onSuccess }: GatewayFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    url: "wss://",
    token: "",
    workspaceRoot: "/workspace",
    disableDevicePairing: false,
    allowInsecureTls: false,
  });

  const [error, setError] = useState<string | null>(null);

  const createGateway = useMutation(api.gateways.createGateway);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate
    if (!formData.name) {
      setError("Gateway name is required");
      return;
    }
    if (!formData.url.startsWith("ws://") && !formData.url.startsWith("wss://")) {
      setError("URL must start with ws:// or wss://");
      return;
    }

    try {
      await createGateway({
        businessId,
        name: formData.name,
        url: formData.url,
        token: formData.token || undefined,
        workspaceRoot: formData.workspaceRoot,
        disableDevicePairing: formData.disableDevicePairing,
        allowInsecureTls: formData.allowInsecureTls,
      });

      onSuccess?.();
      onClose();
    } catch (err) {
      setError((err as Error).message);
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
        <div className="bg-red-900/30 border border-red-700 rounded p-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Gateway Name */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Gateway Name *</label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="e.g., Production Gateway"
          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* WebSocket URL */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">WebSocket URL *</label>
        <input
          type="text"
          name="url"
          value={formData.url}
          onChange={handleChange}
          placeholder="wss://gateway.example.com:443"
          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">Must start with ws:// or wss://</p>
      </div>

      {/* Auth Token */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Auth Token (Optional)</label>
        <input
          type="password"
          name="token"
          value={formData.token}
          onChange={handleChange}
          placeholder="Leave empty if no auth required"
          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Workspace Root */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Workspace Root *</label>
        <input
          type="text"
          name="workspaceRoot"
          value={formData.workspaceRoot}
          onChange={handleChange}
          placeholder="/workspace"
          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono text-sm"
        />
      </div>

      {/* Options */}
      <div className="space-y-2 pt-2 border-t border-slate-700">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="disableDevicePairing"
            checked={formData.disableDevicePairing}
            onChange={handleChange}
            className="w-4 h-4 rounded border-slate-600 bg-slate-900"
          />
          <span className="text-sm text-gray-300">Disable Device Pairing (connect as control_ui mode)</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="allowInsecureTls"
            checked={formData.allowInsecureTls}
            onChange={handleChange}
            className="w-4 h-4 rounded border-slate-600 bg-slate-900"
          />
          <span className="text-sm text-gray-300">Allow Insecure TLS (for self-signed certs)</span>
        </label>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t border-slate-700">
        <button
          type="submit"
          className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded px-4 py-2 font-medium transition-colors"
        >
          <Save size={18} />
          Create Gateway
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white rounded px-4 py-2 font-medium transition-colors"
        >
          <X size={18} />
          Cancel
        </button>
      </div>
    </form>
  );
}
