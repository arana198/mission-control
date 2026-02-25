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
        <div className="bg-slate-800 rounded p-4 border border-slate-700 text-center text-gray-400">
          No business selected
        </div>
      </div>
    );
  }

  return <ApprovalsPanel businessId={currentBusiness._id as any} />;
}
