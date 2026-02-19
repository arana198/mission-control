import { DashboardTabClientContent } from "../../../../components/DashboardTab";

interface PageProps {
  params: Promise<{
    businessSlug: string;
  }>;
}

/**
 * Business-specific Task Board Page
 * URL: /<businessSlug>/board
 * Shows Kanban board for the selected business
 */
export default async function BusinessBoardPage({ params }: PageProps) {
  const { businessSlug } = await params;

  return <DashboardTabClientContent tab="board" businessSlug={businessSlug} />;
}
