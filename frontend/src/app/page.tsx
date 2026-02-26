"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { LoadingSkeleton } from "@/components/LoadingSkeletons";

/**
 * Root page redirects to default workspace overview
 * In multi-workspace mode, always goes to /<workspaceSlug>/overview
 * Falls back to /global/overview if no default workspace exists
 */
export default function Home() {
  const router = useRouter();
  const defaultWorkspace = useQuery(api.workspaces.getDefaultWorkspace);
  const savedSlug = typeof window !== "undefined" ? localStorage.getItem("mission-control:workspaceSlug") : null;
  const allWorkspaces = useQuery(api.workspaces.getAll);

  useEffect(() => {
    // Redirect to workspace-scoped overview
    // Priority: saved slug → default workspace → first workspace
    let targetSlug = savedSlug;

    if (!targetSlug && defaultWorkspace) {
      targetSlug = defaultWorkspace.slug;
    }

    if (!targetSlug && allWorkspaces?.length) {
      targetSlug = allWorkspaces[0].slug;
    }

    if (targetSlug) {
      router.push(`/${targetSlug}`);
    } else {
      // No workspaces exist, redirect to workspace creation
      router.push("/workspaces/new");
    }
  }, [router, defaultWorkspace, savedSlug, allWorkspaces]);

  return <LoadingSkeleton />;
}
