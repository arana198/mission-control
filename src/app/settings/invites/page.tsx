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
        <div className="bg-card rounded p-4 border border-border text-center text-muted-foreground">
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
