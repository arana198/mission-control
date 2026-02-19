import { redirect } from "next/navigation";

/**
 * Root page redirects to default business overview
 * In multi-business mode, always goes to /<businessSlug>/overview
 * Falls back to /global/overview if no default business exists
 */
export default function Home() {
  // TODO: Implement dynamic default business lookup
  // For now, redirect to global overview (temporary fallback)
  // This will be replaced with BusinessProvider context once implemented
  redirect("/global/overview");
}
