import { DashboardTabClientContent } from "./client";

type TabType = "overview" | "board" | "epics" | "agents" | "workload" | "activity" | "documents" | "calendar" | "brain" | "okr" | "bottlenecks" | "sync" | "analytics" | "settings";

const VALID_TABS: TabType[] = [
  "overview",
  "board",
  "epics",
  "agents",
  "workload",
  "activity",
  "documents",
  "calendar",
  "brain",
  "okr",
  "bottlenecks",
  "sync",
  "analytics",
  "settings"
];

interface PageProps {
  params: Promise<{
    tab: string;
  }>;
}

/**
 * Dashboard Tab Page (Server Component)
 *
 * Validates tab parameter and renders client component.
 * URL structure: /dashboard/[tab]
 */
export default async function DashboardTabPage({ params }: PageProps) {
  const { tab: rawTab } = await params;
  const tab = rawTab.toLowerCase() as TabType;

  if (!VALID_TABS.includes(tab)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Invalid Tab</h1>
          <p className="text-muted-foreground">The tab "{rawTab}" does not exist.</p>
          <a href="/dashboard/overview" className="mt-4 inline-block text-blue-600 hover:underline">
            Return to Overview
          </a>
        </div>
      </div>
    );
  }

  return <DashboardTabClientContent tab={tab} />;
}
