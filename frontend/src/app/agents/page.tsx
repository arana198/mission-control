"use client";

import { Suspense } from "react";
import { DashboardTabClientContent } from "@/components/DashboardTab";
import { LoadingSkeleton } from "@/components/LoadingSkeletons";

/**
 * Global Agents Page
 * URL: /global/agents
 * Shows agent squad management (globally shared agent pool)
 */
export default function GlobalAgentsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <DashboardTabClientContent tab="agents" />
    </Suspense>
  );
}
