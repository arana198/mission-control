/**
 * Epic Type Definition
 * Represents an epic (large feature/initiative) in the Mission Control system
 */

export interface Epic {
  _id: string;
  _creationTime: number;
  workspaceId: string;
  name: string;
  title?: string;
  description?: string;
  status?: string;
  createdBy?: string;
  metadata?: Record<string, any>;
}
