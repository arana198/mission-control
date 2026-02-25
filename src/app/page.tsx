"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { LoadingSkeleton } from "@/components/LoadingSkeletons";

/**
 * Root page redirects to default business overview
 * In multi-business mode, always goes to /<businessSlug>/overview
 * Falls back to /global/overview if no default business exists
 */
export default function Home() {
  const router = useRouter();
  const defaultBusiness = useQuery(api.businesses.getDefault);
  const localStorage_slug = typeof window !== "undefined" ? localStorage.getItem("mission-control:businessSlug") : null;
  const businesses = useQuery(api.businesses.getAll);

  useEffect(() => {
    // Simply redirect to overview - business context is handled by BusinessProvider
    router.push("/overview");
  }, [router]);

  return <LoadingSkeleton />;
}
