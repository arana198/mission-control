/**
 * Shared Task type used across components
 */

export interface Task {
  _id: string;
  title: string;
  description?: string;
  status: string;
  priority: "P0" | "P1" | "P2" | "P3";
  timeEstimate?: "XS" | "S" | "M" | "L" | "XL";
  dueDate?: number;
  epicId?: string;
  assigneeIds: string[];
  subtaskIds?: string[];
  blockedBy?: string[];
  blocks?: string[];
  createdAt?: number;
  updatedAt?: number;
}
