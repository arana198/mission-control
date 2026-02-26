"use client";

import { useParams } from "next/navigation";
import { DashboardTabClientContent } from "@/components/DashboardTab";

type TabType = "overview" | "board" | "epics" | "agents" | "workload" | "activity" | "wiki" | "calendar" | "brain" | "analytics" | "settings" | "api-docs" | "inbox";

/**
 * Workspace-Scoped Dashboard Page with Optional Tab
 * URL patterns:
 *   - /{workspaceSlug} → renders overview tab
 *   - /{workspaceSlug}/{tab} → renders specified tab
 */
export default function WorkspacePage() {
  const params = useParams();
  const workspaceSlug = params?.workspaceSlug as string;
  const slugArray = Array.isArray(params?.slug) ? params.slug : params?.slug ? [params.slug] : [];
  const tab = (slugArray?.[0] as string) || "overview";

  // Validate tab is a valid TabType
  const validTabs: TabType[] = [
    "overview",
    "board",
    "epics",
    "agents",
    "workload",
    "activity",
    "wiki",
    "calendar",
    "brain",
    "analytics",
    "settings",
    "api-docs",
    "inbox",
  ];

  const currentTab = (validTabs.includes(tab as TabType) ? tab : "overview") as TabType;

  return <DashboardTabClientContent tab={currentTab} businessSlug={workspaceSlug} />;
}
