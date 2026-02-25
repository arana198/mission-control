import { DashboardTabClientContent } from "@/components/DashboardTab";

/**
 * Global Analytics Dashboard Page
 * URL: /global/analytics
 * Shows strategic analytics across all businesses (with optional business filter)
 */
export default function GlobalAnalyticsPage() {
  return <DashboardTabClientContent tab="analytics" />;
}
