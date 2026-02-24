/**
 * Phase 5: Shared Domain Types
 *
 * Centralized type definitions to eliminate scattered interfaces and `as any` casts.
 * These types are used across multiple Convex functions for consistency and type safety.
 */

import { Id, Doc } from "./_generated/dataModel";

// ─── Activity Logging ─────────────────────────────────────────────────────
export const ACTIVITY_TYPES = [
  "task_created",
  "task_updated",
  "task_completed",
  "task_assigned",
  "task_blocked",
  "task_unblocked",
  "task_deleted",
  "epic_created",
  "epic_updated",
  "epic_completed",
  "goal_created",
  "goal_updated",
  "goal_completed",
  "agent_status_changed",
  "agent_assigned",
  "comment_added",
  "mention_received",
] as const;

export type ActivityType = typeof ACTIVITY_TYPES[number];

export interface ActivityPayload {
  businessId?: Id<"businesses">;
  type: ActivityType;
  agentId: string;
  agentName: string;
  agentRole?: string;
  taskId?: Id<"tasks">;
  taskTitle?: string;
  ticketNumber?: string;
  epicId?: Id<"epics">;
  epicTitle?: string;
  message: string;
  oldValue?: string;
  newValue?: string;
  createdAt: number;
}

// ─── Anomaly Detection ────────────────────────────────────────────────────
export type AnomalyType =
  | "duration_deviation"
  | "error_rate"
  | "skill_mismatch"
  | "status_spike";

export type Severity = "low" | "medium" | "high";

export interface AnomalyRecord {
  agentId: Id<"agents">;
  type: AnomalyType;
  severity: Severity;
  score: number;
  message: string;
  createdAt: number;
}

// ─── Task Operations ─────────────────────────────────────────────────────
export type TaskPatchField =
  | "title"
  | "description"
  | "status"
  | "priority"
  | "assigneeIds"
  | "epicId"
  | "dueDate"
  | "tags"
  | "timeEstimate"
  | "updatedAt"
  | "completionNotes"
  | "doneChecklist";

export type TaskPatch = Partial<Pick<Doc<"tasks">, TaskPatchField>>;

// ─── Messages ───────────────────────────────────────────────────────────
export type MessageSenderId = Id<"agents"> | string;

export interface MessageCreateArgs {
  senderId: MessageSenderId;
  content: string;
  taskId: Id<"tasks">;
  parentId?: Id<"messages">;
}

// ─── Pagination ────────────────────────────────────────────────────────
export interface PaginatedResult<T> {
  items: T[];
  hasMore: boolean;
  nextCursor: string | null;
}

// ─── Actor Resolution ────────────────────────────────────────────────────
export type ActorType = "user" | "system" | "agent";

export interface ResolvedActor {
  type: ActorType;
  name: string;
  id: string;
}
