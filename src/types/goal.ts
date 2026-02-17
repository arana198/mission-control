/**
 * Shared Goal type used across components
 */

export interface Goal {
  _id: string;
  title: string;
  description?: string;
  status: "draft" | "active" | "completed" | "archived";
  progress?: number;
  priority?: "P0" | "P1" | "P2" | "P3";
  startDate?: number;
  endDate?: number;
  ownerId?: string;
  createdAt?: number;
  updatedAt?: number;
}
