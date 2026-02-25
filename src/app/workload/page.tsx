import { DashboardTabClientContent } from "@/components/DashboardTab";

/**
 * Global Workload Page
 * URL: /global/workload
 * Shows agent workload across all businesses (with optional workspace filter)
 */
export default function GlobalWorkloadPage() {
  return <DashboardTabClientContent tab="workload" />;
}
