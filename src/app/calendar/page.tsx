import { DashboardTabClientContent } from "@/components/DashboardTab";

/**
 * Global Calendar Page
 * URL: /global/calendar
 * Shows globally shared calendar (all businesses, no filter)
 * Agents use this to check scheduling conflicts across all businesses
 */
export default function GlobalCalendarPage() {
  return <DashboardTabClientContent tab="calendar" />;
}
