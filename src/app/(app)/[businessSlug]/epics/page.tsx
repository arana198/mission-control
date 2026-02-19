import { DashboardTabClientContent } from "../../../../components/DashboardTab";

interface PageProps {
  params: Promise<{
    businessSlug: string;
  }>;
}

/**
 * Business-specific Roadmap/Epics Page
 * URL: /<businessSlug>/epics
 * Shows strategic epics and roadmap for the selected business
 */
export default async function BusinessEpicsPage({ params }: PageProps) {
  const { businessSlug } = await params;

  return <DashboardTabClientContent tab="epics" businessSlug={businessSlug} />;
}
