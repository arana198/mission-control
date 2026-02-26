"use client";

import { useWorkspace } from "@/components/WorkspaceProvider";
import { ApprovalsPanel } from "@/components/ApprovalsPanel";

/**
 * Approvals Page
 * URL: /approvals
 * Two-column approval management interface
 * Phase 3: Approvals UI Integration
 */
export default function ApprovalsPage() {
  const { currentWorkspace } = useWorkspace();

  if (!currentWorkspace) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-card rounded p-4 border border-border text-center text-muted-foreground">
          No workspace selected
        </div>
      </div>
    );
  }

  return <ApprovalsPanel workspaceId={currentWorkspace._id as any} />;
}
