import { DashboardTabClientContent } from "../../../components/DashboardTab";

/**
 * Global Activity Feed Page
 * URL: /global/activity
 * Shows activity across all businesses (with business filter and labels)
 */
export default function GlobalActivityPage() {
  return <DashboardTabClientContent tab="activity" />;
}
