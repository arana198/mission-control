"use client";

import { useWorkspace } from "@/components/WorkspaceProvider";
import { MembersPanel } from "@/components/MembersPanel";

/**
 * Members Settings Page
 * URL: /settings/members
 * Shows organization members with roles (admin-only)
 * Phase 2: RBAC UI Integration
 */
export default function MembersSettingsPage() {
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

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <MembersPanel workspaceId={currentWorkspace._id as any} />
    </div>
  );
}
