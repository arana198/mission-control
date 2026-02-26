/**
 * Shared agent icon mapping by role.
 *
 * Instead of hardcoding agent names, agents are identified by their role.
 * This allows new agents to automatically get appropriate icons without code changes.
 */

import {
  Shield,
  Search,
  Flame,
  Eye,
  Feather,
  PenTool,
  Sparkles,
  Mail,
  Cpu,
  FileText,
  Bot,
} from "lucide-react";

export const ROLE_ICONS: Record<string, React.ComponentType<any>> = {
  "Squad Lead": Shield,
  "Tester": Search,
  "Researcher": Flame,
  "SEO Strategist": Eye,
  "Editor": Feather,
  "Community Manager": PenTool,
  "Designer": Sparkles,
  "Email Specialist": Mail,
  "Developer": Cpu,
  "Documentation": FileText,
};

/**
 * Get the appropriate icon component for an agent based on their role.
 * Falls back to Bot icon if role is not recognized.
 */
export function getAgentIcon(role: string): React.ComponentType<any> {
  return ROLE_ICONS[role] ?? Bot;
}
