import { homedir } from 'os';
import { promises as fs } from 'fs';
import { join } from 'path';
import { NextResponse } from 'next/server';

/**
 * GET /api/memory/list
 * List all memory files
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
    // Error logged in system: 'List memory files error:', error);
    return NextResponse.json({ files: [] }, { status: 500 });
  }
}
