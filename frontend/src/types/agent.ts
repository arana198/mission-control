/**
 * Agent Type Definition
 * Represents an autonomous agent in the Mission Control system
 */

export interface Agent {
  _id: string;
  _creationTime: number;
  workspaceId: string;
  name: string;
  role: string;
  level?: string;
  status?: 'active' | 'idle' | 'blocked';
  emoji?: string;
  apiKey?: string;
  lastHeartbeat?: number;
  metadata?: Record<string, any>;
}
