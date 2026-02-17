"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { DashboardContent } from "./DashboardContent";

/**
 * Dashboard Wrapper Component
 *
 * Wraps DashboardContent in a Suspense boundary to handle useSearchParams().
 * This fixes Next.js 15+ dynamic rendering requirement.
 *
 * @see https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
 */
export function Dashboard() {
  return (
    <Suspense fallback={<DashboardLoadingFallback />}>
      <DashboardContent />
    </Suspense>
  );
}

/**
 * Loading Fallback Component
 */
function DashboardLoadingFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">Loading dashboard...</p>
      </div>
    </div>
  );
}
