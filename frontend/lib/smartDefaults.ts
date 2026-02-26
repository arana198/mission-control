import { Agent } from "@/types/agent";
import { Task } from "@/types/task";
import { Epic } from "@/types/epic";

const PRIORITY_KEYWORDS: Record<"P0" | "P1" | "P3", string[]> = {
  P0: ["urgent", "critical", "blocker", "emergency", "asap", "hotfix", "p0"],
  P1: ["important", "high priority", "high-priority", "breaking", "severe", "p1"],
  P3: ["low", "minor", "nice to have", "someday", "p3"],
};

/**
 * Extract priority from task title keywords
 * P0: urgent, critical, blocker, emergency, asap, hotfix
 * P1: important, high priority, breaking, severe
 * P3: low, minor, nice to have, someday
 * Default: P2
 */
export function extractPriorityFromText(title: string): "P0" | "P1" | "P2" | "P3" {
  const lower = title.toLowerCase();
  for (const [priority, keywords] of Object.entries(PRIORITY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return priority as "P0" | "P1" | "P3";
    }
  }
  return "P2";
}

/**
 * Detect epic from task title by matching epic name words
 * Skips words < 4 chars to avoid "the", "for", "and" false matches
 */
export function detectEpicFromTitle(title: string, epics: Epic[]): string | null {
  const lower = title.toLowerCase();
  for (const epic of epics) {
    const epicWords = (epic.title || epic.name || "")
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 4);
    if (epicWords.some((word) => lower.includes(word))) {
      return epic._id;
    }
  }
  return null;
}

/**
 * Find least-loaded agent by counting in_progress + review tasks
 * Returns the agent with fewest active tasks
 */
export function findLeastLoadedAgent(agents: Agent[], tasks: Task[]): string | null {
  if (agents.length === 0) return null;

  const counts = new Map<string, number>(agents.map((a) => [a._id, 0]));

  for (const task of tasks) {
    if (task.status === "in_progress" || task.status === "review") {
      for (const id of task.assigneeIds) {
        if (counts.has(id)) {
          counts.set(id, (counts.get(id) ?? 0) + 1);
        }
      }
    }
  }

  let minCount = Infinity;
  let leastLoadedId: string | null = null;
  for (const [id, count] of counts.entries()) {
    if (count < minCount) {
      minCount = count;
      leastLoadedId = id;
    }
  }
  return leastLoadedId;
}

/**
 * Estimate task duration based on description length
 * XS: < 100 chars (1h)
 * S: 100-299 chars (4h)
 * M: 300-699 chars (1 day)
 * L: 700-1499 chars (3 days)
 * XL: 1500+ chars (1 week)
 */
export function estimateTimeFromDescription(
  description: string
): "XS" | "S" | "M" | "L" | "XL" | null {
  const len = description.trim().length;
  if (len === 0) return null;
  if (len < 100) return "XS";
  if (len < 300) return "S";
  if (len < 700) return "M";
  if (len < 1500) return "L";
  return "XL";
}
