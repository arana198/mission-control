/**
 * Activity Type Definition
 * Represents an activity log entry in the Mission Control system
 */

export interface Activity {
  _id: string;
  _creationTime: number;
  workspaceId?: string;
  actor?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, any>;
  timestamp?: number;
}
