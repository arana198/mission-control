import { DashboardTabClientContent } from "../../../components/DashboardTab";

interface PageProps {
  params: Promise<{
    businessSlug: string;
  }>;
}

/**
 * Business-specific Documents Page
 * URL: /<businessSlug>/documents
 * Shows deliverables and documents for the selected business
 */
export default async function BusinessDocumentsPage({ params }: PageProps) {
  const { businessSlug } = await params;

  return <DashboardTabClientContent tab="documents" businessSlug={businessSlug} />;
}
