import { homedir } from 'os';
import { promises as fs } from 'fs';
import { join } from 'path';
import { NextRequest, NextResponse } from 'next/server';

interface SearchResult {
  path: string;
  snippet: string;
  relevance: number;
  keywords: string[];
}

/**
 * POST /api/memory/search
 * Server-side memory search (uses Node.js fs)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, limit = 10 } = body;

    if (!query) {
      return NextResponse.json({ results: [] });
    }

    const memoryDir = join(homedir(), '.openclaw', 'workspace');
    const results: SearchResult[] = [];

    // Search MEMORY.md
    try {
      const memoryPath = join(memoryDir, 'MEMORY.md');
      const content = await fs.readFile(memoryPath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.toLowerCase().includes(query.toLowerCase())) {
          const snippet = lines.slice(Math.max(0, i - 1), i + 2).join('\n');
          const relevance = calculateRelevance(query, snippet);

          results.push({
            path: 'MEMORY.md',
            snippet,
            relevance,
            keywords: extractKeywords(line),
          });
        }
      }
    } catch (e) {
      // Error logged in system: 'Error reading MEMORY.md:', e);
    }

    // Search memory/ subdirectory
    try {
      const memorySubDir = join(memoryDir, 'memory');
      const files = await fs.readdir(memorySubDir, { recursive: true });

      for (const file of files) {
        if (!file.toString().endsWith('.md')) continue;

        try {
          const filePath = join(memorySubDir, file.toString());
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.toLowerCase().includes(query.toLowerCase())) {
              const snippet = lines.slice(Math.max(0, i - 1), i + 2).join('\n');
              const relevance = calculateRelevance(query, snippet);

              results.push({
                path: `memory/${file.toString()}`,
                snippet,
                relevance,
                keywords: extractKeywords(line),
              });
            }
          }
        } catch (e) {
          // Skip individual file errors
        }
      }
    } catch (e) {
      // Error logged in system: 'Error reading memory directory:', e);
    }

    // Sort by relevance and limit
    const sorted = results.sort((a, b) => b.relevance - a.relevance).slice(0, limit);

    return NextResponse.json({ results: sorted });
  } catch (error) {
    // Error logged in system: 'Memory search error:', error);
    return NextResponse.json({ results: [], error: 'Search failed' }, { status: 500 });
  }
}

function calculateRelevance(query: string, text: string): number {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  let relevance = 0;

  // Exact match bonus
  if (lowerText.includes(lowerQuery)) {
    relevance += 0.5;
  }

  // Word match bonus
  const words = lowerQuery.split(/\s+/);
  const matches = words.filter((w) => lowerText.includes(w)).length;
  relevance += (matches / words.length) * 0.5;

  return Math.min(relevance, 1);
}

function extractKeywords(text: string): string[] {
  const words = text.match(/\b\w+\b/g) || [];
  return words
    .filter((w) => w.length > 3)
    .map((w) => w.toLowerCase())
    .slice(0, 5);
}
