/**
 * Shared Agent type used across components
 */

export interface Agent {
  _id: string;
  name: string;
  role: string;
  status?: "active" | "blocked" | "idle";
  emoji?: string;
  currentTaskId?: string;
  level?: "lead" | "specialist" | "intern";
  sessionKey?: string;
  lastHeartbeat?: number;
  personality?: string;
  capabilities?: string[];
  createdAt?: number;
  updatedAt?: number;
}
