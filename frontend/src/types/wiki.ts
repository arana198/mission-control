/**
 * Wiki Type Definitions - Frontend
 *
 * Mirror of convex/wiki.ts return types
 * Used by wiki components to ensure type safety without importing backend source
 */

export interface WikiPage {
  _id: string;
  _creationTime: number;
  workspaceId?: string;
  title: string;
  content: string;
  parentId?: string;
  childIds: string[];
  position: number;
  type: 'department' | 'page';
  taskIds?: string[];
  epicId?: string;
  emoji?: string;
  status?: 'draft' | 'published' | 'archived';
  createdBy: string;
  createdByName: string;
  updatedBy: string;
  updatedByName: string;
  createdAt: number;
  updatedAt: number;
}

export interface WikiPageWithChildren extends WikiPage {
  children?: WikiPageWithChildren[];
}

export interface WikiComment {
  _id: string;
  _creationTime: number;
  workspaceId: string;
  pageId: string;
  fromId: string;
  fromName: string;
  content: string;
  parentId?: string;
  replyIds: string[];
  createdAt: number;
  editedAt?: number;
}

export interface WikiPageHistory {
  _id: string;
  _creationTime: number;
  workspaceId: string;
  title: string;
  content: string;
  version: number;
  savedByName: string;
  savedAt: number;
  createdAt: number;
}
