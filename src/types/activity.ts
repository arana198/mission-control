/**
 * Shared Activity type used across components
 */

export interface Activity {
  _id: string;
  type: string;
  message: string;
  agentName?: string;
  agentId?: string;
  taskId?: string;
  timestamp?: number;
  createdAt?: number;
  metadata?: Record<string, any>;
}
