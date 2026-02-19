import { DashboardTabClientContent } from "../../../../components/DashboardTab";

interface PageProps {
  params: Promise<{
    businessSlug: string;
  }>;
}

/**
 * Business-specific Overview Page
 * URL: /<businessSlug>/overview
 * Shows overview dashboard for the selected business
 */
export default async function BusinessOverviewPage({ params }: PageProps) {
  const { businessSlug } = await params;

  // TODO: Validate businessSlug exists via BusinessProvider context
  // For now, pass tab="overview" to existing component
  return <DashboardTabClientContent tab="overview" businessSlug={businessSlug} />;
}
