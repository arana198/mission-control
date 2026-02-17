/**
 * Shared Epic type used across components
 */

export interface Epic {
  _id: string;
  title: string;
  name?: string;
  description?: string;
  status: "planning" | "active" | "completed" | "archived";
  startDate?: number;
  endDate?: number;
  progress?: number;
  taskIds?: string[];
  createdAt?: number;
  updatedAt?: number;
}
