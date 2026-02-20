import { DashboardTabClientContent } from "../../../../components/DashboardTab";

interface PageProps {
  params: Promise<{
    businessSlug: string;
  }>;
}

/**
 * Business-specific Wiki Page
 * URL: /<businessSlug>/wiki
 * Shows wiki documentation for the selected business
 */
export default async function BusinessWikiPage({ params }: PageProps) {
  const { businessSlug } = await params;

  return <DashboardTabClientContent tab="wiki" businessSlug={businessSlug} />;
}
