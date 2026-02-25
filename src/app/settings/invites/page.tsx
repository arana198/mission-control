"use client";

import { useBusiness } from "@/components/BusinessProvider";
import { InvitesPanel } from "@/components/InvitesPanel";

/**
 * Invites Settings Page
 * URL: /settings/invites
 * Shows pending and accepted invites (admin-only)
 * Phase 2: RBAC UI Integration
 */
export default function InvitesSettingsPage() {
  const { currentBusiness } = useBusiness();

  if (!currentBusiness) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-slate-800 rounded p-4 border border-slate-700 text-center text-gray-400">
          No business selected
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <InvitesPanel businessId={currentBusiness._id as any} />
    </div>
  );
}
