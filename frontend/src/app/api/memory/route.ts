import { homedir } from 'os';
import { promises as fs } from 'fs';
import { join } from 'path';
import { NextResponse } from 'next/server';

/**
 * GET /api/memory
 * List all memory files in the workspace
 *
 * This endpoint consolidates the previous POST /api/memory/search
 * (search should stay as POST for complex queries)
 * and GET /api/memory/list (now GET /api/memory for listing)
 */
export async function GET() {
  try {
    const memoryDir = join(homedir(), '.openclaw', 'workspace', 'memory');
    const files = await fs.readdir(memoryDir, { recursive: true });

    const markdownFiles = files
      .filter((f) => f.toString().endsWith('.md'))
      .map((f) => f.toString());

    return NextResponse.json({ files: markdownFiles });
  } catch (error) {
    return NextResponse.json({ files: [] }, { status: 500 });
  }
}
