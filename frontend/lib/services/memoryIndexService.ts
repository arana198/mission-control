/**
 * Memory Index Service
 * Links tasks, goals, and events to memory files
 */

import { api } from "../../convex/_generated/api";
import { useQuery, useMutation } from "convex/react";

export interface MemoryIndexEntry {
  _id: string;
  entityType: "goal" | "task" | "event" | "note";
  entityId: string;
  memoryPath: string;
  memoryLineRange?: { from: number; to: number };
  keywords: string[];
  relatedMemoryPaths: string[];
  lastSynced: number;
}

// Hook to get all memory links
export function useMemoryIndex() {
  return useQuery(api.memoryIndex.getAll);
}

// Hook to search memories
export function useMemorySearch(query: string) {
  if (!query) return undefined;
  return useQuery(api.memoryIndex.search as any, { query });
}

// Hook to get memory links for an entity
export function useEntityMemory(entityType: string, entityId: string) {
  return useQuery(api.memoryIndex.getByEntity as any, { 
    entityType: entityType as any,
    entityId 
  });
}

// Hook to get all memory paths
export function useMemoryPaths() {
  return useQuery(api.memoryIndex.getMemoryPaths);
}

// Hook to find related memories
export function useRelatedMemory(memoryPath: string) {
  return useQuery(api.memoryIndex.findRelated, { memoryPath });
}

// Mutation hooks
export function useLinkMemory() {
  return useMutation(api.memoryIndex.linkMemory);
}

export function useUnlinkMemory() {
  return useMutation(api.memoryIndex.unlinkMemory);
}

/**
 * Extract keywords from text
 */
export function extractKeywords(text: string): string[] {
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3);
  
  // Return unique words
  return [...new Set(words)].slice(0, 10);
}

/**
 * Auto-link a task to memory based on keywords
 */
export async function autoLinkTask(
  taskId: string,
  taskTitle: string,
  taskDescription: string,
  linkMemory: (args: any) => Promise<any>,
  memoryPaths: string[]
) {
  const keywords = extractKeywords(taskTitle + ' ' + taskDescription);
  
  // Find matching memory paths
  const matchingPaths = memoryPaths.filter(path => 
    keywords.some(k => path.toLowerCase().includes(k))
  );
  
  // Link to best match or create new
  if (matchingPaths.length > 0) {
    await linkMemory({
      entityType: "task",
      entityId: taskId,
      memoryPath: matchingPaths[0],
      keywords,
    });
    return matchingPaths[0];
  }
  
  return null;
}
