import { DashboardTabClientContent } from "../../../components/DashboardTab";

interface PageProps {
  params: Promise<{
    businessSlug: string;
  }>;
}

/**
 * Business-specific Settings Page
 * URL: /<businessSlug>/settings
 * Shows business configuration: GitHub org/repo, ticket prefix, etc.
 */
export default async function BusinessSettingsPage({ params }: PageProps) {
  const { businessSlug } = await params;

  return <DashboardTabClientContent tab="settings" businessSlug={businessSlug} />;
}
