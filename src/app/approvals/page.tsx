"use client";

import { useBusiness } from "@/components/BusinessProvider";
import { ApprovalsPanel } from "@/components/ApprovalsPanel";

/**
 * Approvals Page
 * URL: /approvals
 * Two-column approval management interface
 * Phase 3: Approvals UI Integration
 */
export default function ApprovalsPage() {
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

  return <ApprovalsPanel businessId={currentBusiness._id as any} />;
}
