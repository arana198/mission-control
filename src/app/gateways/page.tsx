"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";

/**
 * Gateways Admin Page
 * URL: /gateways
 * Lists all gateways with health status and controls
 */
export default function GatewaysPage() {
  // For now, show stub - full implementation in phase 4B
  // This would list gateways once we have business context

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-3xl font-bold text-white mb-6">🌐 Gateways</h2>

      <div className="bg-slate-800 rounded-lg p-8 border border-slate-700 text-center">
        <p className="text-gray-400 mb-4">Gateways management coming in Phase 4B</p>
        <p className="text-sm text-gray-500">
          Create and manage distributed runtime connections to Claude Code gateways
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
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
