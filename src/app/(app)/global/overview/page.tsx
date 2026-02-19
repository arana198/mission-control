import { DashboardTabClientContent } from "../../../../components/DashboardTab";

/**
 * Global Overview Page
 * URL: /global/overview
 * Fallback overview when no business is selected
 */
export default function GlobalOverviewPage() {
  return <DashboardTabClientContent tab="overview" />;
}
