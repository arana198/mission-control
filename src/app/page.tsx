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
    // Priority: localStorage → default → first business → global fallback
    let targetSlug: string | null = null;

    if (localStorage_slug && businesses) {
      const saved = businesses.find(b => b.slug === localStorage_slug);
      if (saved) targetSlug = saved.slug;
    }

    if (!targetSlug && defaultBusiness) {
      targetSlug = defaultBusiness.slug;
    }

    if (!targetSlug && businesses && businesses.length > 0) {
      targetSlug = businesses[0].slug;
    }

    // Redirect to the target business or global fallback
    const destination = targetSlug ? `/${targetSlug}/overview` : "/global/overview";
    router.push(destination);
  }, [defaultBusiness, businesses, localStorage_slug, router]);

  return <LoadingSkeleton />;
}
