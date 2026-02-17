/**
 * Memory Service (Client-side)
 * 
 * Type-safe wrapper for memory API calls
 * Reads from OpenClaw's MEMORY.md + memory/*.md via API route
 * (Node.js file operations moved to server-side route)
 */

export interface MemorySection {
  path: string;
  lineRange?: [number, number];
  snippet: string;
  relevance: number; // 0-1
  keywords: string[];
}

export interface EntityContext {
  relevantSections: MemorySection[];
  relatedGoals: string[];
  priorStrategies: string[];
  recommendations: string[];
}

class MemoryService {
  /**
   * Search memory via API (server-side)
   */
  async searchMemory(
    query: string,
    limit: number = 10
  ): Promise<MemorySection[]> {
    try {
      const response = await fetch('/api/memory/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit }),
      });

      if (!response.ok) {
        console.error('Memory search failed:', response.status);
        return [];
      }

      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Memory search error:', error);
      return [];
    }
  }

  /**
   * Get memory content for a specific file
   */
  async getMemoryContent(path: string): Promise<string> {
    try {
      const response = await fetch('/api/memory/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });

      if (!response.ok) return '';

      const data = await response.json();
      return data.content || '';
    } catch (error) {
      console.error('Failed to read memory:', error);
      return '';
    }
  }

  /**
   * Get context for an entity (goal, task, etc.)
   */
  async getEntityContext(
    entityName: string,
    type: 'goal' | 'task' | 'strategy'
  ): Promise<EntityContext> {
    try {
      const response = await fetch('/api/memory/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityName, type }),
      });

      if (!response.ok) {
        return {
          relevantSections: [],
          relatedGoals: [],
          priorStrategies: [],
          recommendations: [],
        };
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get entity context:', error);
      return {
        relevantSections: [],
        relatedGoals: [],
        priorStrategies: [],
        recommendations: [],
      };
    }
  }

  /**
   * List all memory files
   */
  async listMemoryFiles(): Promise<string[]> {
    try {
      const response = await fetch('/api/memory/list');

      if (!response.ok) return [];

      const data = await response.json();
      return data.files || [];
    } catch (error) {
      console.error('Failed to list memory files:', error);
      return [];
    }
  }
}

let instance: MemoryService | null = null;

export function getMemoryService(): MemoryService {
  if (!instance) {
    instance = new MemoryService();
  }
  return instance;
}

export default getMemoryService();
