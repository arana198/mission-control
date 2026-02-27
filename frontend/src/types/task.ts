/**
 * Task Type Definition
 * Represents a task in the Mission Control system
 */

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: number;
}

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
  createdAt?: number;
  createdBy?: string;
  blockedBy?: string[];
  blocks?: string[];
  ticketNumber?: string;
  timeEstimate?: string;
  dueDate?: number;
  subtaskIds?: string[];
  doneChecklist?: ChecklistItem[];
  metadata?: Record<string, any>;
}
