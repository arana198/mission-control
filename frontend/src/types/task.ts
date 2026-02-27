/**
 * Task Type Definition
 * Represents a task in the Mission Control system
 */

export interface Task {
  _id: string;
  _creationTime: number;
  workspaceId: string;
  title: string;
  description?: string;
  status?: 'backlog' | 'ready' | 'in_progress' | 'review' | 'blocked' | 'done';
  priority?: 'P0' | 'P1' | 'P2' | 'P3';
  assignedTo?: string;
  assigneeIds: string[];
  epicId?: string;
  createdBy?: string;
  metadata?: Record<string, any>;
}
