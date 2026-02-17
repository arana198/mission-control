/**
 * Shared role-to-keywords mapping for agent assignment.
 * Used by both smartAssign and autoAssignBacklog to ensure consistent matching.
 */
export const ROLE_KEYWORDS: Record<string, string[]> = {
  "Product Analyst": [
    "research", "analysis", "competitor", "user persona",
    "persona", "market", "requirements"
  ],
  "Customer Researcher": [
    "customer", "research", "reviews", "feedback",
    "survey", "interview", "user research"
  ],
  "SEO Analyst": [
    "seo", "keyword", "search", "ranking",
    "optimization", "analytics", "google"
  ],
  "Content Writer": [
    "content", "writing", "copy", "blog",
    "article", "seo copy", "documentation"
  ],
  "Social Media Manager": [
    "social", "twitter", "linkedin", "tiktok",
    "content calendar", "post", "engagement"
  ],
  "Designer": [
    "design", "ui", "ux", "mockup",
    "wireframe", "visual", "graphic", "icon", "screenshot"
  ],
  "Email Marketing": [
    "email", "sequence", "drip", "campaign",
    "newsletter", "onboarding"
  ],
  "Developer": [
    "code", "backend", "frontend", "api",
    "database", "implementation", "integration", "build"
  ],
  "Documentation": [
    "docs", "documentation", "readme", "guide", "help", "wiki"
  ],
  "Squad Lead": [],
};
